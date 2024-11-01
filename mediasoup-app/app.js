// Configuración básica del servidor y dependencias
import express from 'express'
import https from 'httpolyglot'
import fs from 'fs'
import path from 'path'
import { Server } from 'socket.io'
import mediasoup from 'mediasoup'

const app = express()
const __dirname = path.resolve()

// Configuración de Express para rutas
app.get('*', (req, res, next) => {
  const path = '/sfu/'
  if (req.path.indexOf(path) == 0 && req.path.length > path.length) return next()
  res.send(`You need to specify a room name in the path e.g. 'https://127.0.0.1:3000/sfu/room'`)
})

app.use('/sfu/:room', express.static(path.join(__dirname, 'public')))

// Configuración HTTPS
const options = {
  key: fs.readFileSync('./server/ssl/server.key', 'utf-8'),
  cert: fs.readFileSync('./server/ssl/server.crt', 'utf-8')
}

const httpsServer = https.createServer(options, app)
httpsServer.listen(3000, () => {
  console.log('Listening on port: ' + 3000)
})

/* Inicializa Socket.io para gestionar la comunicación en tiempo real, 
creando un espacio de nombres '/mediasoup' donde los clientes pueden conectarse. */
const io = new Server(httpsServer)
const connections = io.of('/mediasoup')

// Inicialización del Worker de MediaSoup y variables globales
let worker
let rooms = {}         
let peers = {}          
let transports = []    
let producers = []      
let consumers = []      

const createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2199,
  })
  console.log(`worker pid ${worker.pid}`)
  worker.on('died', error => {
    console.error('mediasoup worker has died')
    setTimeout(() => process.exit(1), 2000)
  })
  return worker
}

// Creamos un Worker en cuanto se inicia la aplicación
worker = createWorker()

// Definición de codecs
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
]

/* Manejo de conexiones de Socket.io
Al conectar un cliente, se emite un mensaje de éxito. */
connections.on('connection', async socket => {
  console.log(socket.id)
  socket.emit('connection-success', {
    socketId: socket.id,
  })

  const removeItems = (items, socketId, type) => {
    items.forEach(item => {
      if (item.socketId === socket.id) {
        item[type].close()
      }
    })
    items = items.filter(item => item.socketId !== socket.id)
    return items
  }

/* También se gestionan las desconexiones de los clientes, 
eliminando sus datos de las variables globales. */
  socket.on('disconnect', () => {
    console.log('peer disconnected')
    consumers = removeItems(consumers, socket.id, 'consumer')
    producers = removeItems(producers, socket.id, 'producer')
    transports = removeItems(transports, socket.id, 'transport')
    const { roomName } = peers[socket.id]
    delete peers[socket.id]
    rooms[roomName] = {
      router: rooms[roomName].router,
      peers: rooms[roomName].peers.filter(socketId => socketId !== socket.id)
    }
  })

// La función joinRoom permite que un cliente se una a una sala específica.
  socket.on('joinRoom', async ({ roomName }, callback) => {
    const router1 = await createRoom(roomName, socket.id)
    peers[socket.id] = { // Se almacena el cliente en el objeto peers
      socket,
      roomName,          
      transports: [],
      producers: [],
      consumers: [],
      peerDetails: {
        name: '',
        isAdmin: false,  
      }
    }
// Se envían las capacidades RTP (codecs y formatos) al cliente
    const rtpCapabilities = router1.rtpCapabilities
    callback({ rtpCapabilities })
  })

/* Se gestiona la creación de una sala y su router.
Si la sala ya existe, se reutiliza el router; de lo contrario, se crea un nuevo router usando createRouter. */
  const createRoom = async (roomName, socketId) => {
    let router1
    let peers = []
    if (rooms[roomName]) {
      router1 = rooms[roomName].router
      peers = rooms[roomName].peers || []
    } else {
      router1 = await worker.createRouter({ mediaCodecs, })
    }
    console.log(`Router ID: ${router1.id}`, peers.length)
    rooms[roomName] = {
      router: router1,
      peers: [...peers, socketId],
    }
    return router1
  }

/* Crea un WebRtcTransport, que gestiona la transmisión de medios. */  
  socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
    const roomName = peers[socket.id].roomName
    const router = rooms[roomName].router
    createWebRtcTransport(router).then(
      transport => {
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          }
        })
        addTransport(transport, roomName, consumer)
      },
      error => {
        console.log(error)
      })
  })

/* Estas funciones agregan los transportes, productores, y consumidores a sus listas respectivas
y actualizan el objeto peers para registrar los recursos asociados a cada cliente. */  
  const addTransport = (transport, roomName, consumer) => {
    transports = [
      ...transports,
      { socketId: socket.id, transport, roomName, consumer, }
    ]

    peers[socket.id] = {
      ...peers[socket.id],
      transports: [
        ...peers[socket.id].transports,
        transport.id,
      ]
    }
  }

  const addProducer = (producer, roomName) => {
    producers = [
      ...producers,
      { socketId: socket.id, producer, roomName, }
    ]

    peers[socket.id] = {
      ...peers[socket.id],
      producers: [
        ...peers[socket.id].producers,
        producer.id,
      ]
    }
  }

  const addConsumer = (consumer, roomName) => {
    consumers = [
      ...consumers,
      { socketId: socket.id, consumer, roomName, }
    ]

    peers[socket.id] = {
      ...peers[socket.id],
      consumers: [
        ...peers[socket.id].consumers,
        consumer.id,
      ]
    }
  }

/* Gestión de Productores y Consumidores */

/* Devuelve una lista de productores al cliente. 
Esto permite a un cliente saber qué flujos de medios están disponibles en la sala. */
  socket.on('getProducers', callback => {
    const { roomName } = peers[socket.id]
    let producerList = []
    producers.forEach(producerData => {
      if (producerData.socketId !== socket.id && producerData.roomName === roomName) {
        producerList = [...producerList, producerData.producer.id]
      }
    })
    callback(producerList)
  })

/* Informa a los consumidores en la sala cuando se une un nuevo productor, 
para que puedan consumir su flujo de medios. */
  const informConsumers = (roomName, socketId, id) => {
    console.log(`just joined, id ${id} ${roomName}, ${socketId}`)
    producers.forEach(producerData => {
      if (producerData.socketId !== socketId && producerData.roomName === roomName) {
        const producerSocket = peers[producerData.socketId].socket
        producerSocket.emit('new-producer', { producerId: id })
      }
    })
  }

  const getTransport = (socketId) => {
    const [producerTransport] = transports.filter(transport => transport.socketId === socketId && !transport.consumer)
    return producerTransport.transport
  }

/* Conecta el transporte WebRTC usando los parámetros DTLS proporcionados por el cliente. */
  socket.on('transport-connect', ({ dtlsParameters }) => {
    console.log('DTLS PARAMS... ', { dtlsParameters })
    
    getTransport(socket.id).connect({ dtlsParameters })
  })

/* Inicia la producción de medios (audio/video) en el transporte conectado y llama 
a informConsumers para notificar a otros participantes. */
  socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
    const producer = await getTransport(socket.id).produce({
      kind,
      rtpParameters,
    })
    const { roomName } = peers[socket.id]
    addProducer(producer, roomName)
    informConsumers(roomName, socket.id, producer.id)
    console.log('Producer ID: ', producer.id, producer.kind)
    producer.on('transportclose', () => {
      console.log('transport for this producer closed ')
      producer.close()
    })
// Devuelve el ID del productor al cliente para confirmar la producción.
    callback({
      id: producer.id,
      producersExist: producers.length>1 ? true : false
    })
  })

/*Consumo de Medios*/

// Conecta el transporte WebRTC de un consumidor.
  socket.on('transport-recv-connect', async ({ dtlsParameters, serverConsumerTransportId }) => {
    console.log(`DTLS PARAMS: ${dtlsParameters}`)
    const consumerTransport = transports.find(transportData => (
      transportData.consumer && transportData.transport.id == serverConsumerTransportId
    )).transport
    await consumerTransport.connect({ dtlsParameters })
  })

/* Crea un Consumer para consumir el flujo de un productor existente en la sala y 
devuelve los parámetros necesarios al cliente para recibir el flujo. */
  socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
    try {
      const { roomName } = peers[socket.id]
      const router = rooms[roomName].router
      let consumerTransport = transports.find(transportData => (
        transportData.consumer && transportData.transport.id == serverConsumerTransportId
      )).transport

      if (router.canConsume({
        producerId: remoteProducerId,
        rtpCapabilities
      })) {
        const consumer = await consumerTransport.consume({
          producerId: remoteProducerId,
          rtpCapabilities,
          paused: true,
        })
// transportclose y producerclose aseguran que el consumidor se cierre si el productor o el transporte se desconectan.
        consumer.on('transportclose', () => {
          console.log('transport close from consumer')
        })
        consumer.on('producerclose', () => {
          console.log('producer of consumer closed')
          socket.emit('producer-closed', { remoteProducerId })
          consumerTransport.close([])
          transports = transports.filter(transportData => transportData.transport.id !== consumerTransport.id)
          consumer.close()
          consumers = consumers.filter(consumerData => consumerData.consumer.id !== consumer.id)
        })
        addConsumer(consumer, roomName)
// del consumidor se extraen los siguientes parámetros para enviarlos al cliente
        const params = {
          id: consumer.id,
          producerId: remoteProducerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          serverConsumerId: consumer.id,
        }

// Se envian los parámetros al cliente
        callback({ params })
      }
    } catch (error) {
      console.log(error.message)
      callback({
        params: {
          error: error
        }
      })
    }
  })

  socket.on('consumer-resume', async ({ serverConsumerId }) => {
    console.log('consumer resume')
    const { consumer } = consumers.find(consumerData => consumerData.consumer.id === serverConsumerId)
    await consumer.resume()
  })
})

/* Crea y configura un WebRtcTransport */
const createWebRtcTransport = async (router) => {
  return new Promise(async (resolve, reject) => {
    try {
      const webRtcTransport_options = {
        listenIps: [
          {
            ip: '0.0.0.0', // Reemplazar con IP's relevantes
            announcedIp: '127.0.0.1', // ipconfig me da la ip del equipo
          }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      }

      let transport = await router.createWebRtcTransport(webRtcTransport_options)
      console.log(`transport id: ${transport.id}`)

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') {
          transport.close()
        }
      })

      transport.on('close', () => {
        console.log('transport closed')
      })

      resolve(transport)

    } catch (error) {
      reject(error)
    }
  })
}
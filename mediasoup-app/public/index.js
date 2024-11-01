/* Configuración de Socket.io y MediaSoup Client. */
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')
const roomName = window.location.pathname.split('/')[2]
const socket = io("/mediasoup")

/* Este evento confirma que el cliente está conectado al servidor,
y prepara al cliente para capturar el audio y video locales. */
socket.on('connection-success', ({ socketId }) => {
  console.log(socketId)
  getLocalStream()
})

/* Variables esenciales para gestionar la producción y el consumo de medios. */
let device
let rtpCapabilities
let producerTransport
let consumerTransports = []
let audioProducer
let videoProducer
let consumer
let isProducer = false

/* Estos parámetros optimizan la calidad de video ajustando el bitrate máximo. */
let params = {
  encodings: [
    {
      rid: 'r0',
      maxBitrate: 100000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r1',
      maxBitrate: 300000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r2',
      maxBitrate: 900000,
      scalabilityMode: 'S1T3',
    },
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
}

let audioParams;
let videoParams = { params };
let consumingTransports = [];

/* Esta función permite al cliente unirse a la sala una vez que ha capturado el
audio y video localmente, preparando los medios para su envío. */
const streamSuccess = (stream) => {
  localVideo.srcObject = stream

  audioParams = { track: stream.getAudioTracks()[0], ...audioParams };
  videoParams = { track: stream.getVideoTracks()[0], ...videoParams };

  joinRoom()
}

/* Conecta el cliente con el router de MediaSoup en la sala especificada. */
const joinRoom = () => {
  socket.emit('joinRoom', { roomName }, (data) => {
    console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)
    rtpCapabilities = data.rtpCapabilities
    createDevice()
  })
}

/* Captura los medios locales y prepara el flujo de datos para la transmisión en la sala. */
const getLocalStream = () => {
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      width: {
        min: 640,
        max: 1920,
      },
      height: {
        min: 400,
        max: 1080,
      }
    }
  })
  .then(streamSuccess)
  .catch(error => {
    console.log(error.message)
  })
}

/* Prepara el dispositivo con las capacidades necesarias para transmitir medios,
y luego llama a createSendTransport para crear el transporte que enviará audio/video al servidor. */
const createDevice = async () => {
  try {
    device = new mediasoupClient.Device()
    // Carga el dispositivo con las capacidades RTP del router (servidor)
    await device.load({
      routerRtpCapabilities: rtpCapabilities
    })
    console.log('Device RTP Capabilities', device.rtpCapabilities)
    // Después de cargar el dispositivo, crea el transporte para enviar medios
    createSendTransport()
  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

/* Solicita al servidor los detalles de transporte y los utiliza para crear 
un SendTransport, permitiendo al cliente transmitir medios al servidor. */
const createSendTransport = () => {
  socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(params)
    producerTransport = device.createSendTransport(params)
    // Asegura que el transporte esté configurado correctamente y confirma con el servidor que la conexión está establecida.
    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.emit('transport-connect', {
          dtlsParameters,
        })
        callback()
      } catch (error) {
        errback(error)
      }
    })
    /* Inicia la transmisión de medios al servidor y se asegura de que el servidor
    cree un Producer correspondiente en el lado del servidor. */
    producerTransport.on('produce', async (parameters, callback, errback) => {
      console.log(parameters)
      try {
        await socket.emit('transport-produce', {
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData,
        }, ({ id, producersExist }) => {
          callback({ id })
          if (producersExist) getProducers()
        })
      } catch (error) {
        errback(error)
      }
    })
    connectSendTransport()
  })
}

/* Esta función permite al cliente transmitir sus pistas de audio y video al servidor, 
gestionando eventos para casos en los que la pista o el transporte se detienen. */
const connectSendTransport = async () => {
  audioProducer = await producerTransport.produce(audioParams);
  videoProducer = await producerTransport.produce(videoParams);

  audioProducer.on('trackended', () => {
    console.log('audio track ended')
  })

  audioProducer.on('transportclose', () => {
    console.log('audio transport ended')
  })
  
  videoProducer.on('trackended', () => {
    console.log('video track ended')
  })

  videoProducer.on('transportclose', () => {
    console.log('video transport ended')
  })
}

const signalNewConsumerTransport = async (remoteProducerId) => {
  if (consumingTransports.includes(remoteProducerId)) return;
  consumingTransports.push(remoteProducerId);

  await socket.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {
    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(`PARAMS... ${params}`)

    let consumerTransport
    try {
      consumerTransport = device.createRecvTransport(params)
    } catch (error) {
      console.log(error)
      return
    }

    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.emit('transport-recv-connect', {
          dtlsParameters,
          serverConsumerTransportId: params.id,
        })
        callback()
      } catch (error) {
        errback(error)
      }
    })
    connectRecvTransport(consumerTransport, remoteProducerId, params.id)
  })
}

socket.on('new-producer', ({ producerId }) => signalNewConsumerTransport(producerId))

const getProducers = () => {
  socket.emit('getProducers', producerIds => {
    console.log(producerIds)
    producerIds.forEach(signalNewConsumerTransport)
  })
}

/* Esta función establece la conexión de recepción para consumir el flujo de medios de un productor remoto, 
crea el Consumer necesario, y lo muestra en el DOM como audio o video. */
const connectRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId) => {
  await socket.emit('consume', {
    rtpCapabilities: device.rtpCapabilities,
    remoteProducerId,
    serverConsumerTransportId,
  }, async ({ params }) => {
    if (params.error) {
      console.log('Cannot Consume')
      return
    }

    console.log(`Consumer Params ${params}`)
    const consumer = await consumerTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    })

    consumerTransports = [
      ...consumerTransports,
      {
        consumerTransport,
        serverConsumerTransportId: params.id,
        producerId: remoteProducerId,
        consumer,
      },
    ]

    const newElem = document.createElement('div')
    newElem.setAttribute('id', `td-${remoteProducerId}`)

    if (params.kind == 'audio') {
      newElem.innerHTML = '<audio id="' + remoteProducerId + '" autoplay></audio>'
    } else {
      newElem.setAttribute('class', 'remoteVideo')
      newElem.innerHTML = '<video id="' + remoteProducerId + '" autoplay class="video" ></video>'
    }
    videoContainer.appendChild(newElem)
    const { track } = consumer
    document.getElementById(remoteProducerId).srcObject = new MediaStream([track])
    socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId })
  })
}

/* Esta función maneja la desconexión de un productor remoto, limpiando los recursos de transporte y eliminando el elemento multimedia correspondiente en el cliente. */
socket.on('producer-closed', ({ remoteProducerId }) => {
  const producerToClose = consumerTransports.find(transportData => transportData.producerId === remoteProducerId)
  producerToClose.consumerTransport.close()
  producerToClose.consumer.close()
  consumerTransports = consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId)
  videoContainer.removeChild(document.getElementById(`td-${remoteProducerId}`))
})
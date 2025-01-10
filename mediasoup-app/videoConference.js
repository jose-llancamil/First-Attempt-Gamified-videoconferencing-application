import mediasoup from 'mediasoup';

// Variables globales para MediaSoup
let worker;
let rooms = {};
let peers = {};
let transports = [];
let producers = [];
let consumers = [];

// Configuración de códecs
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
];

// Crear un Worker de MediaSoup
const createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2199,
  });
  console.log(`worker pid ${worker.pid}`);
  worker.on('died', error => {
    console.error('mediasoup worker has died');
    setTimeout(() => process.exit(1), 2000);
  });
  return worker;
};

// Crear un transporte WebRTC
const createWebRtcTransport = async (router) => {
  return new Promise(async (resolve, reject) => {
    try {
      const webRtcTransport_options = {
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: '127.0.0.1',
          }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      };

      let transport = await router.createWebRtcTransport(webRtcTransport_options);
      console.log(`transport id: ${transport.id}`);

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      transport.on('close', () => {
        console.log('transport closed');
      });

      resolve(transport);

    } catch (error) {
      reject(error);
    }
  });
};

const handleVideoconference = async (io) => {
  // Inicializar el Worker
  worker = await createWorker();
  
  // Crear namespace para MediaSoup
  const connections = io.of('/mediasoup');

  connections.on('connection', async socket => {
    console.log(socket.id);
    socket.emit('connection-success', {
      socketId: socket.id,
    });

    const removeItems = (items, socketId, type) => {
      items.forEach(item => {
        if (item.socketId === socket.id) {
          item[type].close();
        }
      });
      items = items.filter(item => item.socketId !== socket.id);
      return items;
    };

    socket.on('disconnect', () => {
      console.log('peer disconnected');
      consumers = removeItems(consumers, socket.id, 'consumer');
      producers = removeItems(producers, socket.id, 'producer');
      transports = removeItems(transports, socket.id, 'transport');
      
      if (peers[socket.id]) {
        const { roomName } = peers[socket.id];
        delete peers[socket.id];
        if (rooms[roomName]) {
          rooms[roomName] = {
            router: rooms[roomName].router,
            peers: rooms[roomName].peers.filter(socketId => socketId !== socket.id)
          };
        }
      }
    });

    // Función para crear una sala y su router
    const createRoom = async (roomName, socketId) => {
      let router1;
      let peers = [];
      if (rooms[roomName]) {
        router1 = rooms[roomName].router;
        peers = rooms[roomName].peers || [];
      } else {
        router1 = await worker.createRouter({ mediaCodecs });
      }
      console.log(`Router ID: ${router1.id}`, peers.length);
      rooms[roomName] = {
        router: router1,
        peers: [...peers, socketId],
      };
      return router1;
    };

    // Función para unirse a una sala
    socket.on('joinRoom', async ({ roomName }, callback) => {
      const router1 = await createRoom(roomName, socket.id);
      peers[socket.id] = {
        socket,
        roomName,
        transports: [],
        producers: [],
        consumers: [],
        peerDetails: {
          name: '',
          isAdmin: false,
        }
      };
      const rtpCapabilities = router1.rtpCapabilities;
      callback({ rtpCapabilities });
    });

    // Crear un transporte WebRTC
    socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
      const roomName = peers[socket.id].roomName;
      const router = rooms[roomName].router;
      
      try {
        const transport = await createWebRtcTransport(router);
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          }
        });
        addTransport(transport, roomName, consumer);
      } catch (error) {
        console.log(error);
        callback({ error });
      }
    });

    // Funciones auxiliares para gestionar transportes, productores y consumidores
    const addTransport = (transport, roomName, consumer) => {
      transports = [
        ...transports,
        { socketId: socket.id, transport, roomName, consumer }
      ];

      peers[socket.id] = {
        ...peers[socket.id],
        transports: [
          ...peers[socket.id].transports,
          transport.id,
        ]
      };
    };

    const addProducer = (producer, roomName) => {
      producers = [
        ...producers,
        { socketId: socket.id, producer, roomName }
      ];

      peers[socket.id] = {
        ...peers[socket.id],
        producers: [
          ...peers[socket.id].producers,
          producer.id,
        ]
      };
    };

    const addConsumer = (consumer, roomName) => {
      consumers = [
        ...consumers,
        { socketId: socket.id, consumer, roomName }
      ];

      peers[socket.id] = {
        ...peers[socket.id],
        consumers: [
          ...peers[socket.id].consumers,
          consumer.id,
        ]
      };
    };

    const getTransport = (socketId) => {
      const [producerTransport] = transports.filter(transport => 
        transport.socketId === socketId && !transport.consumer
      );
      return producerTransport.transport;
    };

    // Resto de event handlers
    socket.on('transport-connect', ({ dtlsParameters }) => {
      console.log('DTLS PARAMS... ', { dtlsParameters });
      getTransport(socket.id).connect({ dtlsParameters });
    });

    socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
      const producer = await getTransport(socket.id).produce({
        kind,
        rtpParameters,
      });
      
      const { roomName } = peers[socket.id];
      addProducer(producer, roomName);
      informConsumers(roomName, socket.id, producer.id);
      
      console.log('Producer ID: ', producer.id, producer.kind);
      producer.on('transportclose', () => {
        console.log('transport for this producer closed ');
        producer.close();
      });
      
      callback({
        id: producer.id,
        producersExist: producers.length > 1
      });
    });

    const informConsumers = (roomName, socketId, id) => {
      console.log(`just joined, id ${id} ${roomName}, ${socketId}`);
      producers.forEach(producerData => {
        if (producerData.socketId !== socketId && producerData.roomName === roomName) {
          const producerSocket = peers[producerData.socketId].socket;
          producerSocket.emit('new-producer', { producerId: id });
        }
      });
    };

    socket.on('transport-recv-connect', async ({ dtlsParameters, serverConsumerTransportId }) => {
      console.log(`DTLS PARAMS: ${dtlsParameters}`);
      const consumerTransport = transports.find(transportData => (
        transportData.consumer && transportData.transport.id == serverConsumerTransportId
      )).transport;
      await consumerTransport.connect({ dtlsParameters });
    });

    socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
      try {
        const { roomName } = peers[socket.id];
        const router = rooms[roomName].router;
        let consumerTransport = transports.find(transportData => (
          transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport;

        if (router.canConsume({
          producerId: remoteProducerId,
          rtpCapabilities
        })) {
          const consumer = await consumerTransport.consume({
            producerId: remoteProducerId,
            rtpCapabilities,
            paused: true,
          });
          
          consumer.on('transportclose', () => {
            console.log('transport close from consumer');
          });
          
          consumer.on('producerclose', () => {
            console.log('producer of consumer closed');
            socket.emit('producer-closed', { remoteProducerId });
            consumerTransport.close([]);
            transports = transports.filter(transportData => 
              transportData.transport.id !== consumerTransport.id
            );
            consumer.close();
            consumers = consumers.filter(consumerData => 
              consumerData.consumer.id !== consumer.id
            );
          });
          
          addConsumer(consumer, roomName);
          const params = {
            id: consumer.id,
            producerId: remoteProducerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            serverConsumerId: consumer.id,
          };

          callback({ params });
        }
      } catch (error) {
        console.log(error.message);
        callback({
          params: {
            error: error
          }
        });
      }
    });

    socket.on('consumer-resume', async ({ serverConsumerId }) => {
      console.log('consumer resume');
      const { consumer } = consumers.find(consumerData => 
        consumerData.consumer.id === serverConsumerId
      );
      await consumer.resume();
    });

    socket.on('getProducers', callback => {
      const { roomName } = peers[socket.id];
      let producerList = [];
      producers.forEach(producerData => {
        if (producerData.socketId !== socket.id && producerData.roomName === roomName) {
          producerList = [...producerList, producerData.producer.id];
        }
      });
      callback(producerList);
    });
  });
};

export default handleVideoconference;
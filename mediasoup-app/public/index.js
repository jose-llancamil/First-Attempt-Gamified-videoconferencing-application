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
let isAudioMuted = false;
let isVideoHidden = false;
let localStream = null;

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
  localStream = stream;
  localVideo.srcObject = stream

  audioParams = { track: stream.getAudioTracks()[0], ...audioParams };
  videoParams = { track: stream.getVideoTracks()[0], ...videoParams };

  setupMediaControls();

  joinRoom()
}

// Función para configurar los controles de medios
const setupMediaControls = () => {
  const muteButton = document.getElementById('mute-button');
  const hideButton = document.getElementById('hide-button');

  muteButton.addEventListener('click', toggleAudio);
  hideButton.addEventListener('click', toggleVideo);
}

// Función para alternar el audio
const toggleAudio = async () => {
  if (!audioProducer) return;

  const muteButton = document.getElementById('mute-button');
  isAudioMuted = !isAudioMuted;

  if (isAudioMuted) {
    await audioProducer.pause();
    muteButton.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Unmute</span>';
    muteButton.classList.add('muted');
  } else {
    await audioProducer.resume();
    muteButton.innerHTML = '<i class="fas fa-microphone"></i><span>Mute</span>';
    muteButton.classList.remove('muted');
  }

  // También silenciamos el track local
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isAudioMuted;
    });
  }
}

// Función para alternar el video
const toggleVideo = async () => {
  if (!videoProducer) return;

  const hideButton = document.getElementById('hide-button');
  isVideoHidden = !isVideoHidden;

  if (isVideoHidden) {
    await videoProducer.pause();
    hideButton.innerHTML = '<i class="fas fa-video-slash"></i><span>Show</span>';
    hideButton.classList.add('hidden');
    // Opcionalmente, mostrar una imagen o fondo negro cuando el video está oculto
    localVideo.classList.add('video-hidden');
  } else {
    await videoProducer.resume();
    hideButton.innerHTML = '<i class="fas fa-video"></i><span>Hide</span>';
    hideButton.classList.remove('hidden');
    localVideo.classList.remove('video-hidden');
  }

  // También deshabilitamos el track de video local
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoHidden;
    });
  }
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

  // Si estaban muteados/ocultos antes de la reconexión, aplicar el estado
  if (isAudioMuted && audioProducer) {
    await audioProducer.pause();
  }
  if (isVideoHidden && videoProducer) {
    await videoProducer.pause();
  }

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

const codeSocket = io("/code-editor")

// configuración del editor
document.addEventListener('DOMContentLoaded', () => {
    let editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        mode: 'python',
        theme: 'monokai',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true
    });

    // Configurar tamaño inicial
    editor.setSize(null, '100%');

    // Conectar con la sala del editor
    codeSocket.emit('join-editor-room', roomName);

    // Manejar cambios en el editor
    let timeout = null;
    editor.on('change', (cm, change) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            codeSocket.emit('code-change', {
                roomName,
                code: cm.getValue()
            });
        }, 500);
    });

    // Manejar actualizaciones de código
    codeSocket.on('code-update', (code) => {
        if (editor && code !== editor.getValue()) {
            const cursor = editor.getCursor();
            editor.setValue(code);
            editor.setCursor(cursor);
        }
    });

    // Manejar resultados de ejecución
    codeSocket.on('execution-result', (result) => {
        const outputDiv = document.getElementById('code-output');
        if (result.error) {
            outputDiv.innerHTML = `Error: ${result.error}`;
            outputDiv.className = 'error-output';
        } else {
            outputDiv.innerHTML = result.output || 'Ejecución completada';
            outputDiv.className = 'success-output';
        }
    });

    // Configurar botones
    document.getElementById('run-code').addEventListener('click', () => {
        const code = editor.getValue();
        const outputDiv = document.getElementById('code-output');
        outputDiv.innerHTML = 'Ejecutando código...';
        outputDiv.className = '';

        codeSocket.emit('execute-code', {
            roomName,
            code
        });
    });
});
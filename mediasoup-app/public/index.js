// Bibliotecas y dependencias
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')

// Configuraciones iniciales
const roomName = window.location.pathname.split('/')[2]
const socket = io("/mediasoup")

// Conexión exitosa
socket.on('connection-success', ({ socketId }) => {
  console.log(socketId)
  getLocalStream()
})

// Nuevo productor
socket.on('new-producer', ({ producerId }) => signalNewConsumerTransport(producerId))

// Productor cerrado
socket.on('producer-closed', ({ remoteProducerId }) => {
  const producerToClose = consumerTransports.find(transportData => transportData.producerId === remoteProducerId)
  producerToClose.consumerTransport.close()
  producerToClose.consumer.close()
  consumerTransports = consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId)
  videoContainer.removeChild(document.getElementById(`td-${remoteProducerId}`))
})

// Variables Globales
let device
let rtpCapabilities
let producerTransport
let consumerTransports = []
let audioProducerz
let videoProducer
let isAudioMuted = false;
let isVideoHidden = false;
let localStream = null;
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

// Obtener el stream local
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

// Manejo de éxito del stream
const streamSuccess = (stream) => {
  localStream = stream;
  localVideo.srcObject = stream

  audioParams = { track: stream.getAudioTracks()[0], ...audioParams };
  videoParams = { track: stream.getVideoTracks()[0], ...videoParams };

  setupMediaControls();
  joinRoom()
}

// Configurar controles de medios
const setupMediaControls = () => {
  const muteButton = document.getElementById('mute-button');
  const hideButton = document.getElementById('hide-button');

  muteButton.addEventListener('click', toggleAudio);
  hideButton.addEventListener('click', toggleVideo);
}

// Alternar audio
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

  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isAudioMuted;
    });
  }
}

// Alternar video
const toggleVideo = async () => {
  if (!videoProducer) return;

  const hideButton = document.getElementById('hide-button');
  isVideoHidden = !isVideoHidden;

  if (isVideoHidden) {
    await videoProducer.pause();
    hideButton.innerHTML = '<i class="fas fa-video-slash"></i><span>Show</span>';
    hideButton.classList.add('hidden');
    localVideo.classList.add('video-hidden');
  } else {
    await videoProducer.resume();
    hideButton.innerHTML = '<i class="fas fa-video"></i><span>Hide</span>';
    hideButton.classList.remove('hidden');
    localVideo.classList.remove('video-hidden');
  }

  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoHidden;
    });
  }
}

// Unirse a la sala
const joinRoom = () => {
  socket.emit('joinRoom', { roomName }, (data) => {
    console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)
    rtpCapabilities = data.rtpCapabilities
    createDevice()
  })
}

// Crear dispositivo
const createDevice = async () => {
  try {
    device = new mediasoupClient.Device()
    await device.load({
      routerRtpCapabilities: rtpCapabilities
    })
    console.log('Device RTP Capabilities', device.rtpCapabilities)
    createSendTransport()
  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

// Crear transporte de envío
const createSendTransport = () => {
  socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(params)
    producerTransport = device.createSendTransport(params)

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

// Conectar transporte de envío
const connectSendTransport = async () => {
  audioProducer = await producerTransport.produce(audioParams);
  videoProducer = await producerTransport.produce(videoParams);

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

// Señalar nuevo transporte de consumo
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

// Obtener productores
const getProducers = () => {
  socket.emit('getProducers', producerIds => {
    console.log(producerIds)
    producerIds.forEach(signalNewConsumerTransport)
  })
}

// Conectar transporte de recepción
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

// Editor de código

// Declaración de variables globales
let editor;
let usuarioId = null;

// Eventos al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/session");
    if (!response.ok) throw new Error("Error obteniendo la sesión del usuario.");

    const userData = await response.json();
    usuarioId = userData.id;
  } catch (error) {
    console.error("Error al obtener el usuario:", error);
    alert("Error al obtener el usuario. Inicia sesión nuevamente.");
    window.location.href = "/";
  }
});

const codeSocket = io("/code-editor");

// Inicialización del editor
document.addEventListener("DOMContentLoaded", () => {
  editor = CodeMirror.fromTextArea(
    document.getElementById("code-editor"),
    {
      mode: "python",
      theme: "monokai",
      lineNumbers: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      lineWrapping: true,
    }
  );

  editor.setSize(null, "100%");
  codeSocket.emit("sync-request");
  let timeout = null;

  // Sincronización del código
  editor.on("change", (cm, change) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      codeSocket.emit("code-change", cm.getValue());
    }, 500);
  });

  codeSocket.on("code-update", (code) => {
    if (editor && code !== editor.getValue()) {
      const cursor = editor.getCursor();
      editor.setValue(code);
      editor.setCursor(cursor);
    }
  });

  // Manejo de Ejecución de Código
  const runButton = document.getElementById("run-code");
  const outputDiv = document.getElementById("code-output");

  runButton.addEventListener("click", () => {
    outputDiv.innerHTML = "Ejecutando código...";
    outputDiv.className = "";

    codeSocket.emit("execute-code");
  });

  codeSocket.on("execution-result", (result) => {
    if (result.error) {
      outputDiv.innerHTML = `Error: ${result.error}`;
      outputDiv.className = "error-output";
    } else {
      const formattedOutput = result.output
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .join("\n");
      outputDiv.innerHTML = `<pre>${formattedOutput}</pre>`;
      outputDiv.className = "success-output";
    }
  });

  // Manejo de Finalización de Tareas
  const finishButton = document.getElementById("finish-task");
  const evaluationPopup = document.getElementById("evaluation-popup");
  const evaluationResult = document.getElementById("evaluation-result");
  const closePopupButton = document.getElementById("close-popup");

  finishButton.addEventListener("click", async () => {
    const problemaId = getSelectedProblemId();

    if (!problemaId) {
      alert("Por favor, selecciona un problema.");
      return;
    }

    const userCode = editor?.getValue()?.trim();

    if (!userCode) {
      alert("El código no puede estar vacío.");
      return;
    }

    finishButton.disabled = true;
    finishButton.textContent = "Evaluando...";

    try {
      const response = await fetch("/api/respuestas/evaluar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuarioId,
          problema_id: problemaId,
          respuesta: userCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error en la evaluación");
      }

      // Aquí manejamos el estado ya_resuelto
      if (result.estado === "ya_resuelto") {
        alert(result.mensaje);
        return;
      }


      // Muestra los resultados en el popup
      evaluationResult.innerHTML = `
        <p class="mb-2">Estado: <strong>${result.estado}</strong></p>
        <p class="mb-2">Experiencia Otorgada: <strong>${result.experienciaOtorgada}</strong></p>
        <p>Monedas Otorgadas: <strong>${result.monedasOtorgadas}</strong></p>
      `;

      evaluationPopup.classList.remove("hidden");
    } catch (error) {
      console.error("Error en la evaluación:", error);
      evaluationResult.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
      evaluationPopup.classList.remove("hidden");
    } finally {
      finishButton.disabled = false;
      finishButton.innerHTML = '<i class="fas fa-paper-plane"></i> Finish';
    }
  });

  // Obtener el ID del problema seleccionado
  function getSelectedProblemId() {
    const problemsContainer = document.getElementById("problems-container");
    if (!problemsContainer) return null;

    const problemId = problemsContainer.getAttribute("data-problem-id");
    return problemId ? parseInt(problemId, 10) : null;
  }

  // Cerrar el popup de evaluación
  closePopupButton.addEventListener("click", () => {
    evaluationPopup.classList.add("hidden");
  });
});

// Notificación de recompensa canjeada
socket.on(`reward-redeemed-${userId}`, (data) => {
  alert(`Recompensa canjeada: ${data.recompensa.nombre}`);
  document.getElementById('user-summary').querySelector('.coins').textContent = data.nuevoSaldo;
});
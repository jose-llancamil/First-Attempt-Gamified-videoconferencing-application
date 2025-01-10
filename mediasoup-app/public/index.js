// -----------------------------
// IMPORTS AND INITIALIZATION
// -----------------------------
const io = require('socket.io-client');
const mediasoupClient = require('mediasoup-client');
const roomName = window.location.pathname.split('/')[2];

const socket = io("/mediasoup");

// -----------------------------
// MEDIASOUP VARIABLES
// -----------------------------
let device;
let rtpCapabilities;
let producerTransport;
let consumerTransports = [];
let audioProducer;
let videoProducer;
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
};

let audioParams;
let videoParams = { params };
let consumingTransports = [];

// -----------------------------
// SOCKET EVENT HANDLERS
// -----------------------------
socket.on('connection-success', ({ socketId }) => {
  console.log(socketId);
  getLocalStream();
});

socket.on('new-producer', ({ producerId }) => signalNewConsumerTransport(producerId));

socket.on('producer-closed', ({ remoteProducerId }) => {
  const producerToClose = consumerTransports.find(transportData => transportData.producerId === remoteProducerId);
  producerToClose.consumerTransport.close();
  producerToClose.consumer.close();
  consumerTransports = consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId);
  videoContainer.removeChild(document.getElementById(`td-${remoteProducerId}`));
});

// -----------------------------
// MEDIA STREAM FUNCTIONS
// -----------------------------
const streamSuccess = (stream) => {
  localStream = stream;
  localVideo.srcObject = stream;

  audioParams = { track: stream.getAudioTracks()[0], ...audioParams };
  videoParams = { track: stream.getVideoTracks()[0], ...videoParams };

  setupMediaControls();
  joinRoom();
};

const setupMediaControls = () => {
  const muteButton = document.getElementById('mute-button');
  const hideButton = document.getElementById('hide-button');

  muteButton.addEventListener('click', toggleAudio);
  hideButton.addEventListener('click', toggleVideo);
};

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
};

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
};

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
      console.log(error.message);
    });
};

// -----------------------------
// MEDIASOUP ROOM FUNCTIONS
// -----------------------------
const joinRoom = () => {
  socket.emit('joinRoom', { roomName }, (data) => {
    console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`);
    rtpCapabilities = data.rtpCapabilities;
    createDevice();
  });
};

const createDevice = async () => {
  try {
    device = new mediasoupClient.Device();
    await device.load({
      routerRtpCapabilities: rtpCapabilities
    });
    console.log('Device RTP Capabilities', device.rtpCapabilities);
    createSendTransport();
  } catch (error) {
    console.log(error);
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported');
  }
};

const createSendTransport = () => {
  socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
    if (params.error) {
      console.log(params.error);
      return;
    }
    console.log(params);
    producerTransport = device.createSendTransport(params);

    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.emit('transport-connect', {
          dtlsParameters,
        });
        callback();
      } catch (error) {
        errback(error);
      }
    });

    producerTransport.on('produce', async (parameters, callback, errback) => {
      console.log(parameters);
      try {
        await socket.emit('transport-produce', {
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData,
        }, ({ id, producersExist }) => {
          callback({ id });
          if (producersExist) getProducers();
        });
      } catch (error) {
        errback(error);
      }
    });
    connectSendTransport();
  });
};

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
    console.log('audio track ended');
  });

  audioProducer.on('transportclose', () => {
    console.log('audio transport ended');
  });

  videoProducer.on('trackended', () => {
    console.log('video track ended');
  });

  videoProducer.on('transportclose', () => {
    console.log('video transport ended');
  });
};

const getProducers = () => {
  socket.emit('getProducers', producerIds => {
    console.log(producerIds);
    producerIds.forEach(signalNewConsumerTransport);
  });
};

// -----------------------------
// CONSUMER TRANSPORT FUNCTIONS
// -----------------------------
const signalNewConsumerTransport = async (remoteProducerId) => {
  if (consumingTransports.includes(remoteProducerId)) return;
  consumingTransports.push(remoteProducerId);

  await socket.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {
    if (params.error) {
      console.log(params.error);
      return;
    }
    console.log(`PARAMS... ${params}`);

    let consumerTransport;
    try {
      consumerTransport = device.createRecvTransport(params);
    } catch (error) {
      console.log(error);
      return;
    }

    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.emit('transport-recv-connect', {
          dtlsParameters,
          serverConsumerTransportId: params.id,
        });
        callback();
      } catch (error) {
        errback(error);
      }
    });
    connectRecvTransport(consumerTransport, remoteProducerId, params.id);
  });
};

const connectRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId) => {
  await socket.emit('consume', {
    rtpCapabilities: device.rtpCapabilities,
    remoteProducerId,
    serverConsumerTransportId,
  }, async ({ params }) => {
    if (params.error) {
      console.log('Cannot Consume');
      return;
    }

    console.log(`Consumer Params ${params}`);
    const consumer = await consumerTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    });

    consumerTransports = [
      ...consumerTransports,
      {
        consumerTransport,
        serverConsumerTransportId: params.id,
        producerId: remoteProducerId,
        consumer,
      },
    ];

    const newElem = document.createElement('div');
    newElem.setAttribute('id', `td-${remoteProducerId}`);

    if (params.kind == 'audio') {
      newElem.innerHTML = '<audio id="' + remoteProducerId + '" autoplay></audio>';
    } else {
      newElem.setAttribute('class', 'remoteVideo');
      newElem.innerHTML = '<video id="' + remoteProducerId + '" autoplay class="video" ></video>';
    }
    videoContainer.appendChild(newElem);
    const { track } = consumer;
    document.getElementById(remoteProducerId).srcObject = new MediaStream([track]);
    socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });
  });
};

// -----------------------------
// CODE EDITOR SETUP
// -----------------------------
let editor;
let usuarioId = null;
const codeSocket = io("/code-editor");

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/session");
    if (!response.ok) throw new Error("Error obteniendo la sesión del usuario.");

    const userData = await response.json();
    usuarioId = userData.id;

    // Initialize CodeMirror
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

    // Code editor event handlers
    codeSocket.emit("sync-request");

    let timeout = null;
    editor.on("change", (cm, change) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        codeSocket.emit("code-change", cm.getValue());
      }, 500);
    });

    setupCodeEditorEvents();

  } catch (error) {
    console.error("Error al obtener el usuario:", error);
    alert("Error al obtener el usuario. Inicia sesión nuevamente.");
    window.location.href = "/";
  }
});

// Code socket event handlers
codeSocket.on("code-update", (code) => {
  if (editor && code !== editor.getValue()) {
    const cursor = editor.getCursor();
    editor.setValue(code);
    editor.setCursor(cursor);
  }
});

codeSocket.on("execution-result", (result) => {
  const outputDiv = document.getElementById("code-output");
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

const setupCodeEditorEvents = () => {
  const runButton = document.getElementById("run-code");
  const outputDiv = document.getElementById("code-output");
  const finishButton = document.getElementById("finish-task");
  const evaluationPopup = document.getElementById("evaluation-popup");
  const evaluationResult = document.getElementById("evaluation-result");
  const closePopupButton = document.getElementById("close-popup");

  runButton.addEventListener("click", () => {
    outputDiv.innerHTML = "Ejecutando código...";
    outputDiv.className = "";
    codeSocket.emit("execute-code");
  });

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

      if (result.estado === "ya_resuelto") {
        alert(result.mensaje);
        return;
      }

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

  closePopupButton.addEventListener("click", () => {
    evaluationPopup.classList.add("hidden");
  });
};

// Utility function for getting selected problem ID
const getSelectedProblemId = () => {
  const problemsContainer = document.getElementById("problems-container");
  if (!problemsContainer) return null;

  const problemId = problemsContainer.getAttribute("data-problem-id");
  return problemId ? parseInt(problemId, 10) : null;
};

// -----------------------------
// REWARD HANDLING
// -----------------------------
socket.on(`reward-redeemed-${userId}`, (data) => {
  alert(`Recompensa canjeada: ${data.recompensa.nombre}`);
  document.getElementById('user-summary').querySelector('.coins').textContent = data.nuevoSaldo;
});
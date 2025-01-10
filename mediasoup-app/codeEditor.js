import { PythonShell } from 'python-shell';
import path from 'path';
import fs from 'fs';
import RespuestaService from './services/RespuestaService.js';

const handleCodeEditor = (io, sessionMiddleware) => {
  const codeEditor = io.of('/code-editor');
  const userCode = new Map();

  codeEditor.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  codeEditor.on('connection', (socket) => {
    console.log('Code editor client connected:', socket.id);
    userCode.set(socket.id, '');

    // Sync request
    socket.on('sync-request', () => {
      console.log('Sync requested for user:', socket.id);
      const currentCode = userCode.get(socket.id) || '';
      socket.emit('code-update', currentCode);
    });

    // Handle code changes
    socket.on('code-change', (code) => {
      console.log('Code changed by user:', socket.id);
      userCode.set(socket.id, code);
    });

    // Execute code
    socket.on('execute-code', async () => {
      console.log('Executing code for user:', socket.id);
      const code = userCode.get(socket.id) || '';

      try {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const fileName = `${socket.id}_${Date.now()}.py`;
        const filePath = path.join(tempDir, fileName);

        fs.writeFileSync(filePath, code);

        const options = {
          mode: 'text',
          pythonPath: 'python',
          pythonOptions: ['-u'],
          scriptPath: tempDir,
          args: [],
          timeout: 5000,
        };

        const result = await PythonShell.run(fileName, options);
        fs.unlinkSync(filePath);

        socket.emit('execution-result', {
          output: result.join('\n'),
          error: null,
        });
      } catch (error) {
        console.error('Code execution error:', error);
        socket.emit('execution-result', {
          output: null,
          error: error.message,
        });
      }
    });

    // Evaluate code
    socket.on('finish-code', async ({ problema_id }) => {
      console.log('Evaluating code for user:', socket.id);
      const usuario_id = socket.request.session?.user?.id;
      const code = userCode.get(socket.id) || '';

      if (!usuario_id) {
        return socket.emit('evaluation-result', {
          success: false,
          error: 'Usuario no autenticado.',
        });
      }

      if (!problema_id) {
        return socket.emit('evaluation-result', {
          success: false,
          error: 'Problema no especificado.',
        });
      }

      try {
        const resultado = await RespuestaService.evaluateRespuesta(usuario_id, problema_id, code);
        socket.emit('evaluation-result', {
          success: true,
          resultado,
        });
      } catch (error) {
        console.error('Error evaluando código:', error);
        socket.emit('evaluation-result', {
          success: false,
          error: error.message,
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Code editor client disconnected:', socket.id);
      userCode.delete(socket.id);
    });
  });
};

export default handleCodeEditor;

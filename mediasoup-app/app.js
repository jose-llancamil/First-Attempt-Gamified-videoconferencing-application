// -----------------------------
// IMPORTS
// -----------------------------
// Core imports
import express from 'express';
import { Server } from 'socket.io';
import https from 'httpolyglot';
import fs from 'fs';
import path from 'path';
import session from 'express-session';
import bodyParser from 'body-parser';
import pgSession from 'connect-pg-simple';

// Controllers
import UserController from './controllers/UserController.js';
import ProblemaController from './controllers/ProblemaController.js';
import RespuestaController from './controllers/RespuestaController.js';
import LogroController from './controllers/LogroController.js';
import RecompensaController from './controllers/RecompensaController.js';
import RecompensaUsuarioController from './controllers/RecompensaUsuarioController.js';
import RankingController from './controllers/RankingController.js';

// Custom modules
import handleCodeEditor from './codeEditor.js';
import handleVideoConference from './videoConference.js';

// -----------------------------
// APP INITIALIZATION
// -----------------------------
const app = express();
const __dirname = path.resolve();
const PgSession = pgSession(session);

// -----------------------------
// MIDDLEWARE CONFIGURATION
// -----------------------------
// Basic middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
const sessionMiddleware = session({
  store: new PgSession({
    conObject: {
      connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/gamification',
    },
  }),
  secret: 'mi-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // true si uso HTTPS en producción
    maxAge: 24 * 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);

// Static files middleware
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/static', express.static(path.join(__dirname, 'static')));

// Authentication middleware
const authMiddleware = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Usuario no autenticado.' });
  }
  next();
};

// Session logging middleware
app.use((req, res, next) => {
  console.log('Sesión actual:', req.session);
  next();
});

// -----------------------------
// VIEW ROUTES
// -----------------------------
// Main views
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

app.get('/gestion.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gestion.html'));
});

// Protected views
app.get('/ver-respuestas', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'respuestas.html'));
});

app.get('/estudiantes', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'estudiantes.html'));
});

app.get('/gestion-ejercicios', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'problemas.html'));
});

app.get('/gestion-recompensas', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'recompensas.html'));
});

app.get('/recompensas-canjeadas', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'recompensaUsuario.html'));
});

app.get('/api/room', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------
// API ROUTES
// -----------------------------
// User related routes
app.post('/api/join', UserController.joinUser);
app.get('/api/session', UserController.getUserSession);
app.get('/api/usuario/perfil', UserController.getUserProfile);
app.get('/api/estudiantes', UserController.getAllStudents);

// Problem related routes
app.get('/api/problemas/disponibles', ProblemaController.getDisponibles);
app.get('/api/problemas/:id/entradas-salidas', ProblemaController.getEntradasYSalidas);
app.post('/api/problemas', ProblemaController.create);
app.get('/api/problemas', ProblemaController.getAll);
app.get('/api/problemas/:id', ProblemaController.getById);
app.put('/api/problemas/:id', ProblemaController.update);
app.delete('/api/problemas/:id', ProblemaController.delete);

// Answer related routes
app.post('/api/respuestas/evaluar', (req, res) => RespuestaController.evaluate(req, res, io));
app.post('/api/respuestas', RespuestaController.create);
app.get('/api/respuestas', RespuestaController.getAll);
app.get('/api/respuestas/:id', RespuestaController.getById);
app.put('/api/respuestas/:id', RespuestaController.update);
app.delete('/api/respuestas/:id', RespuestaController.delete);

// Achievement related routes
app.get('/api/usuario/logros', LogroController.getUserAchievements);
app.get('/api/logros', LogroController.getAll);
app.post('/api/logros', LogroController.create);
app.get('/api/logros/:id', LogroController.getById);
app.put('/api/logros/:id', LogroController.update);
app.delete('/api/logros/:id', LogroController.delete);
app.post('/api/logros/unlock', LogroController.unlock);

// Reward related routes
app.get('/api/recompensas-canjeadas', RecompensaUsuarioController.getAll);
app.get('/api/recompensas', RecompensaController.getAll);
app.post('/api/recompensas', RecompensaController.create);
app.get('/api/recompensas/:id', RecompensaController.getById);
app.put('/api/recompensas/:id', RecompensaController.update);
app.delete('/api/recompensas/:id', RecompensaController.delete);
app.post('/api/recompensas/canjear', authMiddleware, RecompensaController.redeem);

// Ranking route
app.get('/api/ranking', RankingController.getRanking);

// -----------------------------
// SERVER CONFIGURATION
// -----------------------------
// HTTPS Setup
const options = {
  key: fs.readFileSync('./server/ssl/server.key', 'utf-8'),
  cert: fs.readFileSync('./server/ssl/server.crt', 'utf-8'),
};

const httpsServer = https.createServer(options, app);
httpsServer.listen(3000, () => {
  console.log('Listening on port: ' + 3000);
});

// -----------------------------
// SOCKET.IO CONFIGURATION
// -----------------------------
const io = new Server(httpsServer);
app.locals.io = io;
app.use((req, res, next) => {
  req.io = app.locals.io;
  next();
});

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);
});

// Initialize socket handlers
handleCodeEditor(io, sessionMiddleware);
handleVideoConference(io);
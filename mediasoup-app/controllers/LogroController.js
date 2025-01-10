import LogroService from '../services/LogroService.js';

const LogroController = {
  async create(req, res) {
    try {
      const newLogro = await LogroService.createLogro(req.body);
      res.status(201).json(newLogro);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const logros = await LogroService.getAllLogros();
      res.json(logros);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req, res) {
    try {
      const logro = await LogroService.getLogroById(req.params.id);
      res.json(logro);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const updatedLogro = await LogroService.updateLogro(
        req.params.id,
        req.body
      );
      res.json(updatedLogro);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req, res) {
    try {
      const message = await LogroService.deleteLogro(req.params.id);
      res.json(message);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  },

  async unlock(req, res) {
    try {
      const { usuario_id, logro_id } = req.body;
      const logroUsuario = await LogroService.unlockLogroForUser(
        usuario_id,
        logro_id
      );
      res.status(201).json(logroUsuario);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getUserAchievements(req, res) {
    try {
      const userId = req.session.user.id;
      if (!userId) {
        throw new Error('El usuario no está autenticado.');
      }

      const achievements = await LogroService.getUserAchievements(userId);
      res.status(200).json(achievements);
    } catch (error) {
      console.error('Error al obtener logros del usuario:', error);
      res.status(500).json({ error: 'Error interno al obtener logros.' });
    }
  }

};

export default LogroController;

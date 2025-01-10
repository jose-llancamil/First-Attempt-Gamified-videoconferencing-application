import RecompensaService from '../services/RecompensaService.js';

const RecompensaController = {
  async create(req, res) {
    try {
      const newRecompensa = await RecompensaService.createRecompensa(req.body);
      res.status(201).json(newRecompensa);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const recompensas = await RecompensaService.getAllRecompensas();
      res.json(recompensas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req, res) {
    try {
      const recompensa = await RecompensaService.getRecompensaById(req.params.id);
      res.json(recompensa);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const updatedRecompensa = await RecompensaService.updateRecompensa(
        req.params.id,
        req.body
      );
      res.json(updatedRecompensa);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req, res) {
    try {
      const message = await RecompensaService.deleteRecompensa(req.params.id);
      res.json(message);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  },

  async redeem(req, res) {
    try {
      const { rewardId } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado.' });
      }

      if (!rewardId) {
        return res.status(400).json({ error: 'Recompensa no especificada.' });
      }

      const result = await RecompensaService.redeemReward(userId, rewardId, req.io);

      // Emitir evento de actualización
      if (req.io) {
        req.io.emit(`user-stats-updated-${userId}`, {
          id: result.usuario.id,
          name: result.usuario.name,
          level: result.usuario.level,
          experience: result.usuario.experience,
          coins: result.usuario.coins
        });
      }

      return res.status(200).json({
        mensaje: 'Recompensa canjeada correctamente.',
        nuevoSaldo: result.nuevoSaldo,
        recompensa: result.recompensa
      });
    } catch (error) {
      console.error('Error al canjear recompensa:', error);
      return res.status(error.message.includes('ya fue canjeada') ? 409 : 500)
        .json({ error: error.message });
    }
  }
};

export default RecompensaController;

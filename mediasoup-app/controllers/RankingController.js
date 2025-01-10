import UserService from '../services/UserService.js';

const RankingController = {
  async getRanking(req, res) {
    try {
      const ranking = await UserService.getDynamicRanking();
      res.status(200).json(ranking);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateRanking(io) {
    try {
      const ranking = await UserService.getDynamicRanking();
      io.emit('ranking-updated', ranking); // Emitir el evento al frontend
    } catch (error) {
      console.error('Error al emitir el evento de ranking actualizado:', error.message);
    }
  },
};

export default RankingController;
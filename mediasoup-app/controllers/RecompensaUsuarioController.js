import RecompensaUsuarioService from '../services/RecompensaUsuarioService.js';

const RecompensaUsuarioController = {
  async getAll(req, res) {
    try {
      const redemptions = await RecompensaUsuarioService.getAllRewardRedemptions();
      res.status(200).json(redemptions);
    } catch (error) {
      console.error('Error al obtener recompensas canjeadas:', error);
      res.status(500).json({ error: 'Error interno al obtener recompensas canjeadas.' });
    }
  },
};

export default RecompensaUsuarioController;

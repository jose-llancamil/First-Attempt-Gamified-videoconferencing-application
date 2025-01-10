import RecompensaUsuarioEntity from '../entities/RecompensaUsuarioEntity.js';

const RecompensaUsuarioService = {
  async getAllRewardRedemptions() {
    const redemptions = await RecompensaUsuarioEntity.findAllWithDetails();
    return redemptions;
  },
};

export default RecompensaUsuarioService;

import RecompensaEntity from '../entities/RecompensaEntity.js';
import RecompensaUsuarioEntity from '../entities/RecompensaUsuarioEntity.js';
import UserService from './UserService.js';
import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const RecompensaService = {
  async createRecompensa(data) {
    const { nombre, descripcion, costo_monedas } = data;

    if (!nombre || !descripcion || !costo_monedas) {
      throw new Error('Todos los campos son obligatorios.');
    }

    return RecompensaEntity.create(data);
  },

  async getRecompensaById(id) {
    const recompensa = await RecompensaEntity.findById(id);
    if (!recompensa) {
      throw new Error(`La recompensa con ID ${id} no existe.`);
    }
    return recompensa;
  },

  async getAllRecompensas() {
    return RecompensaEntity.findAll();
  },

  async updateRecompensa(id, updates) {
    const recompensa = await RecompensaEntity.updateById(id, updates);
    if (!recompensa) {
      throw new Error(`La recompensa con ID ${id} no existe para actualizar.`);
    }
    return recompensa;
  },

  async deleteRecompensa(id) {
    const result = await RecompensaEntity.deleteById(id);
    if (!result) {
      throw new Error(`La recompensa con ID ${id} no existe para eliminar.`);
    }
    return { message: 'Recompensa eliminada correctamente.' };
  },

  async redeemReward(userId, rewardId, io) {
    let trx;
    try {
      trx = await db.transaction();

      // Obtener y bloquear el usuario
      const usuario = await trx('users')
        .where({ id: userId })
        .forUpdate()
        .first();

      if (!usuario) {
        throw new Error('Usuario no encontrado.');
      }

      // Obtener la recompensa
      const recompensa = await trx('recompensas')
        .where({ id: rewardId })
        .first();

      if (!recompensa) {
        throw new Error('La recompensa no existe.');
      }

      // Verificar si ya fue canjeada
      const alreadyRedeemed = await trx('recompensas_por_usuario')
        .where({
          usuario_id: userId,
          recompensa_id: rewardId
        })
        .first();

      if (alreadyRedeemed) {
        throw new Error('Esta recompensa ya fue canjeada.');
      }

      // Verificar saldo
      if (usuario.coins < recompensa.costo_monedas) {
        throw new Error('No tienes suficientes monedas para canjear esta recompensa.');
      }

      // Registrar el canje y actualizar monedas
      await trx('recompensas_por_usuario').insert({
        usuario_id: userId,
        recompensa_id: rewardId,
      });

      const [updatedUser] = await trx('users')
        .where({ id: userId })
        .update({
          coins: usuario.coins - recompensa.costo_monedas
        })
        .returning(['id', 'coins', 'name', 'level', 'experience']);

      // Confirmar la transacción
      await trx.commit();

      // Verificar logros después de confirmar la transacción
      const newAchievements = await UserService.checkAchievements(userId, io);

      return {
        recompensa,
        nuevoSaldo: updatedUser.coins,
        usuario: updatedUser
      };

    } catch (error) {
      if (trx && !trx.isCompleted()) await trx.rollback();
      console.error('Error en redeemReward:', error);
      throw error;
    }
  },
};

export default RecompensaService;

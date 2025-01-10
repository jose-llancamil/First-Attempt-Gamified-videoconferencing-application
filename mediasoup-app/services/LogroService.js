import LogroEntity from '../entities/LogroEntity.js';
import LogroUsuarioEntity from '../entities/LogroUsuarioEntity.js';

const LogroService = {
  async createLogro(data) {
    const { nombre, descripcion, criterio, valor_criterio } = data;

    if (!nombre || !descripcion || !criterio || !valor_criterio) {
      throw new Error('Todos los campos son obligatorios.');
    }

    return LogroEntity.create(data);
  },

  async getLogroById(id) {
    const logro = await LogroEntity.findById(id);
    if (!logro) {
      throw new Error(`El logro con ID ${id} no existe.`);
    }
    return logro;
  },

  async getAllLogros() {
    return LogroEntity.findAll();
  },

  async updateLogro(id, updates) {
    const logro = await LogroEntity.updateById(id, updates);
    if (!logro) {
      throw new Error(`El logro con ID ${id} no existe para actualizar.`);
    }
    return logro;
  },

  async deleteLogro(id) {
    const result = await LogroEntity.deleteById(id);
    if (!result) {
      throw new Error(`El logro con ID ${id} no existe para eliminar.`);
    }
    return { message: 'Logro eliminado correctamente.' };
  },

  async unlockLogroForUser(usuario_id, logro_id) {
    // Verificar que el logro exista
    const logro = await LogroEntity.findById(logro_id);
    if (!logro) {
      throw new Error(`El logro con ID ${logro_id} no existe.`);
    }

    // Verificar si el usuario ya desbloqueó el logro
    const existingLogro = await LogroUsuarioEntity.findByUserAndLogro(
      usuario_id,
      logro_id
    );
    if (existingLogro) {
      throw new Error('El usuario ya desbloqueó este logro.');
    }

    // Registrar el logro como desbloqueado
    return LogroUsuarioEntity.create({
      usuario_id,
      logro_id,
    });
  },

  async getUserAchievements(userId) {
    if (!userId) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    return await LogroEntity.findByUserId(userId);
  },
};

export default LogroService;

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const LogroEntity = {
  async create(data) {
    const [newLogro] = await db('logros').insert(data).returning('*');
    return newLogro;
  },

  async findById(id) {
    return db('logros').where({ id }).first();
  },

  async findAll() {
    return db('logros').select();
  },

  async updateById(id, updates) {
    const [updatedLogro] = await db('logros')
      .where({ id })
      .update(updates)
      .returning('*');
    return updatedLogro;
  },

  async deleteById(id) {
    return db('logros').where({ id }).del();
  },
  
  async findByUserId(userId) {
    return db('logros_por_usuario')
      .join('logros', 'logros.id', 'logros_por_usuario.logro_id')
      .where('logros_por_usuario.usuario_id', userId)
      .select(
        'logros.id',
        'logros.nombre',
        'logros.descripcion',
        'logros.imagen_url',
        'logros_por_usuario.fecha_desbloqueo'
      )
      .orderBy('logros_por_usuario.fecha_desbloqueo', 'desc');
  },
};

export default LogroEntity;

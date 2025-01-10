import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const RecompensaEntity = {
  async create(data) {
    const [newRecompensa] = await db('recompensas').insert(data).returning('*');
    return newRecompensa;
  },

  async findById(id) {
    return db('recompensas').where({ id }).first();
  },

  async findAll() {
    return db('recompensas').select();
  },

  async updateById(id, updates) {
    const [updatedRecompensa] = await db('recompensas')
      .where({ id })
      .update(updates)
      .returning('*');
    return updatedRecompensa;
  },

  async deleteById(id) {
    return db('recompensas').where({ id }).del();
  },
};

export default RecompensaEntity;

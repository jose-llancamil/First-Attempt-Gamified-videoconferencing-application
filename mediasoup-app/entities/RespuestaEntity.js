import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const RespuestaEntity = {
  async create(data) {
    if (!data.usuario_id || !data.problema_id || !data.respuesta) {
      throw new Error('usuario_id, problema_id y respuesta son obligatorios.');
    }

    const [newRespuesta] = await db('respuestas').insert(data).returning('*');
    return newRespuesta;
  },

  async findById(id) {
    if (!id) {
      throw new Error('El ID de la respuesta es obligatorio.');
    }

    return db('respuestas').where({ id }).first();
  },

  async findByUserAndProblem(usuario_id, problema_id) {
    if (!usuario_id || !problema_id) {
      throw new Error('usuario_id y problema_id son obligatorios.');
    }

    return db('respuestas').where({ usuario_id, problema_id }).first();
  },

  async findAll(filters = {}) {
    let query = db('respuestas');

    if (filters.usuario_id) {
      query = query.where({ usuario_id: filters.usuario_id });
    }
    if (filters.problema_id) {
      query = query.where({ problema_id: filters.problema_id });
    }
    if (filters.estado) {
      query = query.where({ estado: filters.estado });
    }

    return query.select();
  },

  async updateById(id, updates) {
    if (!id || !updates) {
      throw new Error('El ID de la respuesta y los datos de actualización son obligatorios.');
    }

    const [updatedRespuesta] = await db('respuestas')
      .where({ id })
      .update(updates)
      .returning('*');
    if (!updatedRespuesta) {
      throw new Error(`Respuesta con ID ${id} no encontrada para actualizar.`);
    }

    return updatedRespuesta;
  },

  async deleteById(id) {
    if (!id) {
      throw new Error('El ID de la respuesta es obligatorio.');
    }

    const deletedRows = await db('respuestas').where({ id }).del();
    if (deletedRows === 0) {
      throw new Error(`Respuesta con ID ${id} no encontrada para eliminar.`);
    }

    return deletedRows;
  },
};

export default RespuestaEntity;

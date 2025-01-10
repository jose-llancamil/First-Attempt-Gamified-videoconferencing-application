import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const ProblemaEntity = {
  async create(data) {
    if (!data.titulo || !data.descripcion || !data.dificultad) {
      throw new Error('Título, descripción y dificultad son obligatorios para crear un problema.');
    }

    const [newProblem] = await db('problemas').insert(data).returning('*');
    return newProblem;
  },

  async findById(id) {
    if (!id) {
      throw new Error('El ID del problema es obligatorio.');
    }

    const problem = await db('problemas').where({ id }).first();
    if (!problem) {
      throw new Error(`Problema con ID ${id} no encontrado.`);
    }

    return problem;
  },

  async findAll(filters = {}) {
    let query = db('problemas');

    if (filters.dificultad) {
      query = query.where({ dificultad: filters.dificultad });
    }
    if (filters.minExperiencia || filters.maxExperiencia) {
      query = query.whereBetween('experiencia', [
        filters.minExperiencia || 0,
        filters.maxExperiencia || Number.MAX_SAFE_INTEGER,
      ]);
    }

    return query.select();
  },

  async updateById(id, updates) {
    if (!id || !updates) {
      throw new Error('El ID y los datos de actualización son obligatorios.');
    }

    const [updatedProblem] = await db('problemas')
      .where({ id })
      .update(updates)
      .returning('*');
    if (!updatedProblem) {
      throw new Error(`Problema con ID ${id} no encontrado.`);
    }

    return updatedProblem;
  },

  async deleteById(id) {
    if (!id) {
      throw new Error('El ID del problema es obligatorio.');
    }

    const deletedRows = await db('problemas').where({ id }).del();
    if (deletedRows === 0) {
      throw new Error(`Problema con ID ${id} no encontrado.`);
    }

    return deletedRows;
  },

  async findDisponiblesParaUsuario(userId) {
    if (!userId) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    return db('problemas')
      .whereNotIn('id', function () {
        this.select('problema_id')
          .from('respuestas')
          .where('usuario_id', userId)
          .andWhere('estado', 'Completado');
      })
      .select('id', 'titulo', 'descripcion', 'dificultad', 'experiencia', 'monedas');
  },

  async getEntradasYSalidas(id) {
    if (!id) {
      throw new Error('El ID del problema es obligatorio.');
    }

    const data = await db('problemas')
      .where({ id })
      .select('entradas', 'salidas_esperadas')
      .first();
    if (!data) {
      throw new Error(`Problema con ID ${id} no encontrado.`);
    }

    return data;
  },
};

export default ProblemaEntity;

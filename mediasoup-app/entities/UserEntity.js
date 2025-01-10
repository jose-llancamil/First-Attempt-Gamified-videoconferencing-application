import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const UserEntity = {
  async create(data) {
    if (!data.name) {
      throw new Error('El nombre del usuario es obligatorio.');
    }

    const [newUser] = await db('users').insert(data).returning('*');
    return newUser;
  },

  async findByName(name) {
    if (!name) {
      throw new Error('El nombre es obligatorio para la búsqueda.');
    }

    return db('users').where({ name }).first();
  },

  async findById(id) {
    if (!id) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    return db('users').where({ id }).first();
  },

  async findAll() {
    return db('users').select();
  },

  async updateById(id, updates) {
    if (!id) {
      throw new Error('El ID del usuario es obligatorio.');
    }
    if (!updates || typeof updates !== 'object') {
      throw new Error('Las actualizaciones deben ser un objeto válido.');
    }

    const validUpdates = {};
    for (const key in updates) {
      if (updates[key] !== undefined && updates[key] !== null) {
        validUpdates[key] = updates[key];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No hay datos válidos para actualizar.');
    }

    const [updatedUser] = await db('users')
      .where({ id })
      .update(validUpdates)
      .returning('*');
    return updatedUser;
  },

  async updateUserStats(userId, { experienceEarned = 0, coinsEarned = 0 }, io) {
    if (!userId) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }

    const totalExperience = user.experience + experienceEarned;

    let level = 1;
    let requiredExperience = 100;
    let cumulativeXP = requiredExperience;

    while (totalExperience >= cumulativeXP) {
      level++;
      requiredExperience *= 2;
      cumulativeXP += requiredExperience;
    }

    const previousLevel = user.level;

    const title = await db('titulos')
      .where('nivel_min', '<=', level)
      .andWhere('nivel_max', '>=', level)
      .select('titulo')
      .first();

    const [updatedUser] = await db('users')
      .where({ id: userId })
      .update({
        experience: totalExperience,
        coins: db.raw('coins + ?', [coinsEarned]),
        level,
        titulo_actual: title ? title.titulo : 'Principiante',
      })
      .returning('*');

    if (!updatedUser) {
      throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }

    if (level > previousLevel) {
      io.emit(`user-level-up-${userId}`, { newLevel: level });
    }

    if (io) {
      io.emit(`user-stats-updated-${userId}`, updatedUser);
    }

    return updatedUser;
  },

  async addCompletedExercise(userId, problemId) {
    try {
      console.log("Consultando tabla users con ID:", userId);
      const user = await knex('users').where({ id: userId }).first();

      let completedExercises = [];
      if (user.completed_exercises) {
        try {
          completedExercises = JSON.parse(user.completed_exercises);
        } catch (err) {
          console.error("Error al parsear completed_exercises:", err);
          throw new Error("El campo completed_exercises tiene un formato inválido.");
        }
      }

      // Evitar duplicados
      if (!completedExercises.includes(problemId)) {
        completedExercises.push(problemId);
      }

      await knex('users')
        .where({ id: userId })
        .update({ completed_exercises: JSON.stringify(completedExercises) });
    } catch (error) {
      console.error("Error al agregar ejercicio completado:", error);
      throw error;
    }
  },

  async updateCompletedExercises(usuario_id, completedExercises) {
    try {
      await db('users')
        .where({ id: usuario_id })
        .update({ completed_exercises: JSON.stringify(completedExercises) });
    } catch (error) {
      console.error('Error actualizando ejercicios completados:', error);
      throw new Error('No se pudo actualizar la lista de ejercicios completados.');
    }
  },
};

export default UserEntity;

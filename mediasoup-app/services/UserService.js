import UserEntity from '../entities/UserEntity.js';
import LogroEntity from '../entities/LogroEntity.js';
import LogroUsuarioEntity from '../entities/LogroUsuarioEntity.js';
import knex from 'knex';
import knexConfig from '../knexfile.js';
import { count } from 'console';

const db = knex(knexConfig.development);

const UserService = {
  async joinUser(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('El nombre del usuario es obligatorio y debe ser válido.');
    }

    let user = await UserEntity.findByName(name);

    if (!user) {
      user = await UserEntity.create({
        name: name.trim(),
        level: 1,
        experience: 0,
        coins: 0,
        completed_exercises: JSON.stringify([]),
        titulo_actual: 'Principiante',
      });
    }

    return user;
  },

  async getUserById(id) {
    if (!id) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    const user = await UserEntity.findById(id);
    if (!user) {
      throw new Error(`Usuario con ID ${id} no encontrado.`);
    }
    return user;
  },

  async getAllStudents(filters = {}) {
    let users = await UserEntity.findAll();
    if (filters.level) {
      users = users.filter((user) => user.level === parseInt(filters.level, 10));
    }
    if (filters.titulo_actual) {
      users = users.filter((user) => user.titulo_actual.toLowerCase().includes(filters.titulo_actual.toLowerCase()));
    }
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      level: user.level,
      experience: user.experience,
      coins: user.coins,
      titulo_actual: user.titulo_actual,
      completed_exercises_count: Array.isArray(user.completed_exercises)
        ? user.completed_exercises.length
        : JSON.parse(user.completed_exercises || '[]').length,
    }));
  },

  async getDynamicRanking() {
    const users = await UserEntity.findAll();

    if (!users || users.length === 0) {
      return [];
    }

    users.sort((a, b) => b.level - a.level || b.experience - a.experience);

    return users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      level: user.level,
      experience: user.experience,
    }));
  },

  async updateUserStats(userId, stats, io) {
    if (!stats || typeof stats !== 'object') {
      throw new Error('Las estadísticas proporcionadas son inválidas.');
    }

    const updatedUser = await UserEntity.updateUserStats(userId, stats);

    const RankingController = (await import('../controllers/RankingController.js')).default;
    await RankingController.updateRanking(io);

    return updatedUser;
  },

  async checkAchievements(userId, io = null, trx = null) {
    const dbQuery = trx || db;
    if (!userId) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    // Obtener datos del usuario
    const user = await dbQuery('users')
      .where({ id: userId })
      .first();

    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }

    // Parsear completed_exercises si es necesario
    const completedExercises = Array.isArray(user.completed_exercises)
      ? user.completed_exercises
      : JSON.parse(user.completed_exercises || '[]');

    // Obtener todos los logros
    const allAchievements = await LogroEntity.findAll();

    // Obtener logros ya desbloqueados por el usuario
    const unlockedAchievements = await LogroUsuarioEntity.findAllByUser(userId);
    const unlockedAchievementIds = unlockedAchievements.map((logro) => logro.logro_id);

    // Logros desbloqueados en esta evaluación
    const newlyUnlockedAchievements = [];

    // Verificar cada logro
    for (const achievement of allAchievements) {
      // Ignorar logros ya desbloqueados
      if (unlockedAchievementIds.includes(achievement.id)) {
        continue;
      }

      // Evaluar criterios de logros
      let meetsCriteria = false;
      switch (achievement.criterio) {
        case 'problemas_completados':
          meetsCriteria = completedExercises.length >= achievement.valor_criterio;
          break;
        case 'nivel':
          meetsCriteria = user.level >= achievement.valor_criterio;
          break;
        case 'monedas':
          meetsCriteria = user.coins >= achievement.valor_criterio;
          break;
        case 'recompensas_adquiridas':
          const totalRewards = await db('recompensas_por_usuario').where({ usuario_id: userId }).count('id as count');
          console.log('Total recompensas:', totalRewards[0]?.count);
          console.log('Valor criterio:', achievement.valor_criterio);
          meetsCriteria = totalRewards[0]?.count >= achievement.valor_criterio;
          break;
        default:
          console.warn(`Criterio desconocido: ${achievement.criterio}`);
      }

      if (meetsCriteria) {
        await dbQuery('logros_por_usuario').insert({
          usuario_id: userId,
          logro_id: achievement.id,
        });

        newlyUnlockedAchievements.push(achievement);

        // Emitir evento WebSocket si está disponible
        if (io) {
          console.log('Datos del logro antes de emitir:', achievement);
          const achievementData = {
            achievementId: achievement.id,
            name: achievement.nombre,
            description: achievement.descripcion,
            imageUrl: achievement.imagen_url
          };
          console.log('Datos que se van a emitir:', achievementData);
          io.emit(`achievement-unlocked-${userId}`, achievementData);
        }
      }
    }

    return newlyUnlockedAchievements;
  }
};

export default UserService;

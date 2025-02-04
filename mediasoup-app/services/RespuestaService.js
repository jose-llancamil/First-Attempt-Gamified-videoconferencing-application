import RespuestaEntity from '../entities/RespuestaEntity.js';
import ProblemaEntity from '../entities/ProblemaEntity.js';
import UserEntity from '../entities/UserEntity.js';
import UserService from '../services/UserService.js';
import { PythonShell } from 'python-shell';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);
const RespuestaService = {
  async createRespuesta(data) {
    const { usuario_id, problema_id, respuesta } = data;

    if (!usuario_id || !problema_id || !respuesta) {
      throw new Error('Faltan campos obligatorios.');
    }

    const problema = await ProblemaEntity.findById(problema_id);
    if (!problema) {
      throw new Error(`El problema con ID ${problema_id} no existe.`);
    }

    const existingRespuesta = await RespuestaEntity.findByUserAndProblem(
      usuario_id,
      problema_id
    );
    if (existingRespuesta) {
      throw new Error('Ya existe una respuesta para este problema y usuario.');
    }

    return RespuestaEntity.create(data);
  },

  async getRespuestas(filters = {}) {
    const respuestas = await this.findAll(filters);

    // Enriquecer las respuestas con detalles de usuario y problema
    const respuestasConDetalles = await Promise.all(
      respuestas.map(async (respuesta) => {
        const usuario = await db('users').where({ id: respuesta.usuario_id }).first();
        const problema = await db('problemas').where({ id: respuesta.problema_id }).first();

        return {
          ...respuesta,
          usuario_nombre: usuario ? usuario.name : 'Desconocido',
          problema_titulo: problema ? problema.titulo : 'Desconocido',
        };
      })
    );

    return respuestasConDetalles;
  },

  async findAll(filters = {}) {
    let query = db('respuestas')
      .join('users', 'respuestas.usuario_id', 'users.id')
      .join('problemas', 'respuestas.problema_id', 'problemas.id')
      .select(
        'respuestas.*',
        'users.name as usuario_nombre',
        'problemas.titulo as problema_titulo'
      );

    if (filters.usuario_nombre) {
      query = query.where('users.name', 'ilike', `%${filters.usuario_nombre}%`);
    }
    if (filters.problema_titulo) {
      query = query.where('problemas.titulo', 'ilike', `%${filters.problema_titulo}%`);
    }

    return query;
  },

  async evaluateRespuesta(usuario_id, problema_id, respuesta, io) {
    console.log('Datos recibidos para evaluación:', { usuario_id, problema_id, respuesta });

    if (!usuario_id || !problema_id || !respuesta) {
      return {
        tipo: 'error',
        mensaje: 'Faltan campos obligatorios para la evaluación.',
        estado: 'error'
      };
    }

    const yaResuelto = await db('respuestas')
      .where({
        usuario_id,
        problema_id,
        estado: 'Aceptado',
      })
      .first(); // Obtiene solo el primer registro que coincide

    if (yaResuelto) {
      return {
        estado: 'ya_resuelto',
        tipo: 'error',
        mensaje: 'El problema ya fue resuelto previamente.',
      };
    }

    const problema = await ProblemaEntity.findById(problema_id);
    if (!problema) {
      return {
        tipo: 'error',
        mensaje: `El problema con ID ${problema_id} no existe.`,
        estado: 'error'
      };
    }

    const { entradas, salidas_esperadas: salidasEsperadas } = await ProblemaEntity.getEntradasYSalidas(problema_id);
    if (entradas.length === 0 || salidasEsperadas.length === 0) {
      throw new Error('El problema no tiene parámetros de entrada o salida definidos.');
    }

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const userFunctionName = /def (\w+)\(/.exec(respuesta)?.[1];
    if (!userFunctionName) {
      return {
        tipo: 'error',
        mensaje: 'El código enviado no contiene una función válida.',
        estado: 'error'
      };
    }

    const normalizedCode = respuesta.trim();
    const wrappedCode = `
import sys
import json
      
${normalizedCode}
      
if __name__ == "__main__":
        inputs = json.loads(sys.argv[1])
        try:
                result = ${userFunctionName}(*inputs) if isinstance(inputs, list) and not isinstance(inputs[0], list) else ${userFunctionName}(inputs)
        except TypeError:
                result = ${userFunctionName}(inputs)
        print(json.dumps(result))
`.trim();

    const fileName = `${crypto.randomUUID()}.py`;
    console.log('Código generado para evaluación:\n', wrappedCode);
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, wrappedCode);

    try {
      let isCorrect = true;
      const incorrectCases = [];

      for (let i = 0; i < entradas.length; i++) {
        const entrada = entradas[i];
        const salidaEsperada = salidasEsperadas[i];

        const options = {
          mode: 'text',
          pythonPath: 'python',
          scriptPath: tempDir,
          args: [JSON.stringify(entrada)],
          timeout: 5000,
        };

        try {
          const result = await PythonShell.run(fileName, options);
          const salidaObtenida = JSON.parse(result[0]);
          console.log(`Resultado para entrada ${i + 1}:`, {
            entrada,
            salidaEsperada,
            salidaObtenida: result[0],
          });

          if (JSON.stringify(salidaObtenida) !== JSON.stringify(salidaEsperada)) {
            isCorrect = false;
            incorrectCases.push({ entrada, salidaEsperada, salidaObtenida });
          }
        } catch (error) {
          console.error(`Error ejecutando entrada ${i + 1}:`, {
            entrada,
            salidaEsperada,
            error: error.message,
          });
          isCorrect = false;
          incorrectCases.push({ entrada, salidaEsperada, error: error.message });
          break;
        }
      }

      const experienciaOtorgada = isCorrect ? problema.experiencia : Math.floor(problema.experiencia * 0);
      const monedasOtorgadas = isCorrect ? problema.monedas : Math.floor(problema.monedas * 0);

      const nuevaRespuesta = await RespuestaEntity.create({
        usuario_id,
        problema_id,
        respuesta,
        estado: isCorrect ? 'Aceptado' : 'Rechazado',
        resultado_evaluacion: isCorrect ? 'Correcto' : 'Incorrecto',
        detalles_evaluacion: isCorrect ? null : JSON.stringify(incorrectCases),
      });

      await UserEntity.updateUserStats(usuario_id, {
        experienceEarned: experienciaOtorgada,
        coinsEarned: monedasOtorgadas,
      }, io);

      const RankingController = (await import('../controllers/RankingController.js')).default;
      await RankingController.updateRanking(io);

      const unlockedAchievements = await UserService.checkAchievements(usuario_id);
      if (unlockedAchievements.length > 0) {
        unlockedAchievements.forEach((achievement) => {
          io.emit(`achievement-unlocked-${usuario_id}`, {
            achievementId: achievement.id,
            name: achievement.nombre,
            description: achievement.descripcion,
            imageUrl: achievement.imagen_url,
          });
        });
      }

      if (isCorrect) {
        // Actualizar el atributo completed_exercises del usuario
        const usuario = await db('users').where({ id: usuario_id }).first();
        const completedExercises = usuario.completed_exercises || [];

        // Agregar el nuevo problema si no está ya en la lista
        if (!completedExercises.includes(problema_id)) {
          completedExercises.push(problema_id);

          await db('users')
            .where({ id: usuario_id })
            .update({ completed_exercises: JSON.stringify(completedExercises) });

          io.emit(`user-updated-${usuario_id}`, {
            completed_exercises: completedExercises,
          });

          // Verificar logros
          await UserService.checkAchievements(usuario_id, io);
        }
      }

      return {
        estado: isCorrect ? 'Aceptado' : 'Rechazado',
        experienciaOtorgada,
        monedasOtorgadas,
        mensaje: isCorrect ? 'Respuesta correcta' : 'Respuesta incorrecta',
        errores: isCorrect ? null : incorrectCases,
        nuevaRespuesta,
      };
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  },
};

export default RespuestaService;

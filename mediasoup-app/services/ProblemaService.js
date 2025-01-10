import ProblemaEntity from '../entities/ProblemaEntity.js';
import { validateSerializableAsJSON } from '../utils/jsonUtils.js';

const ProblemaService = {
  async createProblem(data) {
    const { titulo, descripcion, dificultad, experiencia, monedas, entradas, salidas_esperadas } = data;

    if (!titulo || !descripcion || !dificultad || !experiencia || !monedas || !entradas || !salidas_esperadas) {
      throw new Error('Faltan campos obligatorios.');
    }

    if (!Array.isArray(entradas) || !Array.isArray(salidas_esperadas)) {
      throw new Error('Entradas y salidas esperadas deben ser arrays.');
    }

    validateSerializableAsJSON(entradas, 'entradas');
    validateSerializableAsJSON(salidas_esperadas, 'salidas_esperadas');

    return ProblemaEntity.create({
      titulo,
      descripcion,
      dificultad,
      experiencia,
      monedas,
      entradas: JSON.stringify(entradas),
      salidas_esperadas: JSON.stringify(salidas_esperadas),
    });
  },

  async getProblemById(id) {
    const problem = await ProblemaEntity.findById(id);
    if (!problem) {
      throw new Error(`Problema con ID ${id} no encontrado.`);
    }

    return this._deserializeProblem(problem);
  },

  async getProblems(filters = {}) {
    const problems = await ProblemaEntity.findAll(filters);
    return problems.map((problem) => this._deserializeProblem(problem));
  },

  async updateProblem(id, updates) {
    const { entradas, salidas_esperadas } = updates;

    if (entradas && !Array.isArray(entradas)) {
      throw new Error('Entradas debe ser un array.');
    }
    if (salidas_esperadas && !Array.isArray(salidas_esperadas)) {
      throw new Error('Salidas esperadas debe ser un array.');
    }

    if (entradas) validateSerializableAsJSON(entradas, 'entradas');
    if (salidas_esperadas) validateSerializableAsJSON(salidas_esperadas, 'salidas_esperadas');

    const problem = await ProblemaEntity.updateById(id, {
      ...updates,
      entradas: entradas ? JSON.stringify(entradas) : undefined,
      salidas_esperadas: salidas_esperadas ? JSON.stringify(salidas_esperadas) : undefined,
    });

    if (!problem) {
      throw new Error(`Problema con ID ${id} no encontrado para actualizar.`);
    }

    return this._deserializeProblem(problem);
  },

  async deleteProblem(id) {
    const result = await ProblemaEntity.deleteById(id);
    if (!result) {
      throw new Error(`Problema con ID ${id} no encontrado para eliminar.`);
    }
    return { message: 'Problema eliminado correctamente.' };
  },

  async getAvailableProblemsForUser(userId) {
    if (!userId) {
      throw new Error('El ID del usuario es obligatorio.');
    }
    const problems = await ProblemaEntity.findDisponiblesParaUsuario(userId);
    return problems.map((problem) => this._deserializeProblem(problem));
  },

  async getEntradasYSalidas(id) {
    const problem = await this.getProblemById(id);
    return {
      entradas: problem.entradas,
      salidas_esperadas: problem.salidas_esperadas,
    };
  },

  _deserializeProblem(problem) {
    return {
      ...problem,
      entradas: this._safeJSONParse(problem.entradas, 'entradas'),
      salidas_esperadas: this._safeJSONParse(problem.salidas_esperadas, 'salidas_esperadas'),
    };
  },

  _safeJSONParse(field, fieldName) {
    try {
      // Verificar si ya es un objeto JSON
      if (typeof field === 'object') {
        return field;
      }
      // Parsear si es una cadena
      return JSON.parse(field || '[]');
    } catch (error) {
      console.error(`Error al parsear el campo ${fieldName}:`, field, error.message);
      return []; // Retorna un arreglo vacío si el parseo falla
    }
  },  
};

export default ProblemaService;

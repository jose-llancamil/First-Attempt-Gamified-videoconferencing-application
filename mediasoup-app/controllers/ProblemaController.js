import ProblemaService from '../services/ProblemaService.js';

const ProblemaController = {
  async create(req, res) {
    try {
      const { titulo, descripcion, dificultad, experiencia, monedas, entradas, salidas_esperadas } = req.body;

      if (!titulo || !descripcion || !dificultad || !experiencia || !monedas || !entradas || !salidas_esperadas) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
      }

      if (!Array.isArray(entradas) || !Array.isArray(salidas_esperadas)) {
        return res.status(400).json({ error: 'Entradas y salidas esperadas deben ser arrays válidos.' });
      }

      const newProblem = await ProblemaService.createProblem(req.body);
      res.status(201).json(newProblem);
    } catch (error) {
      console.error('Error al crear problema:', error);
      res.status(500).json({ error: 'Error interno al crear el problema.' });
    }
  },

  async getAll(req, res) {
    try {
      const problems = await ProblemaService.getProblems(req.query);
      res.status(200).json(problems);
    } catch (error) {
      console.error('Error al obtener problemas:', error);
      res.status(500).json({ error: 'Error interno al obtener los problemas.' });
    }
  },

  async getById(req, res) {
    try {
      const problem = await ProblemaService.getProblemById(req.params.id);
      if (!problem) {
        return res.status(404).json({ error: 'Problema no encontrado.' });
      }
      res.status(200).json(problem);
    } catch (error) {
      console.error('Error al obtener problema:', error);
      res.status(500).json({ error: 'Error interno al obtener el problema.' });
    }
  },

  async update(req, res) {
    try {
      const { titulo, descripcion, dificultad, experiencia, monedas, entradas, salidas_esperadas } = req.body;

      if (!titulo || !descripcion || !dificultad || !experiencia || !monedas || !entradas || !salidas_esperadas) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
      }

      if (!Array.isArray(entradas) || !Array.isArray(salidas_esperadas)) {
        return res.status(400).json({ error: 'Entradas y salidas esperadas deben ser arrays válidos.' });
      }

      const updatedProblem = await ProblemaService.updateProblem(req.params.id, req.body);
      if (!updatedProblem) {
        return res.status(404).json({ error: 'Problema no encontrado.' });
      }

      res.status(200).json(updatedProblem);
    } catch (error) {
      console.error('Error al actualizar problema:', error);
      res.status(500).json({ error: 'Error interno al actualizar el problema.' });
    }
  },

  async delete(req, res) {
    try {
      const result = await ProblemaService.deleteProblem(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Problema no encontrado.' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar problema:', error);
      res.status(500).json({ error: 'Error interno al eliminar el problema.' });
    }
  },

  async getDisponibles(req, res) {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado.' });
      }

      const problemas = await ProblemaService.getAvailableProblemsForUser(userId);
      res.status(200).json(problemas);
    } catch (error) {
      console.error('Error al obtener problemas disponibles:', error);
      res.status(500).json({ error: 'Error interno al obtener problemas disponibles.' });
    }
  },

  async getEntradasYSalidas(req, res) {
    try {
      const { id } = req.params;

      const data = await ProblemaService.getEntradasYSalidas(id);
      if (!data) {
        return res.status(404).json({ error: 'Problema no encontrado.' });
      }

      res.status(200).json(data);
    } catch (error) {
      console.error('Error al obtener entradas y salidas:', error);
      res.status(500).json({ error: 'Error interno al obtener entradas y salidas.' });
    }
  },
};

export default ProblemaController;

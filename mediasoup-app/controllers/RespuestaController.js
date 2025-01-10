import RespuestaService from '../services/RespuestaService.js';

const RespuestaController = {
  async create(req, res) {
    try {
      const newRespuesta = await RespuestaService.createRespuesta(req.body);
      res.status(201).json(newRespuesta);
    } catch (error) {
      console.error('Error al crear respuesta:', error.message);
      res.status(400).json({ error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const respuestas = await RespuestaService.getRespuestas(req.query);
      res.status(200).json(respuestas);
    } catch (error) {
      console.error('Error al obtener respuestas:', error.message);
      res.status(500).json({ error: 'Error interno al obtener respuestas.' });
    }
  },
  
  async getById(req, res) {
    try {
      const respuesta = await RespuestaService.getRespuestaById(req.params.id);
      if (!respuesta) {
        return res.status(404).json({ error: 'Respuesta no encontrada.' });
      }
      res.status(200).json(respuesta);
    } catch (error) {
      console.error('Error al obtener respuesta:', error.message);
      res.status(500).json({ error: 'Error interno al obtener la respuesta.' });
    }
  },

  async update(req, res) {
    try {
      const updatedRespuesta = await RespuestaService.updateRespuesta(
        req.params.id,
        req.body
      );
      res.status(200).json(updatedRespuesta);
    } catch (error) {
      console.error('Error al actualizar respuesta:', error.message);
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req, res) {
    try {
      const message = await RespuestaService.deleteRespuesta(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar respuesta:', error.message);
      res.status(404).json({ error: error.message });
    }
  },

  async evaluate(req, res, io) {
    try {
      const { usuario_id, problema_id, respuesta } = req.body;

      if (!usuario_id || !problema_id || !respuesta) {
        return res
          .status(400)
          .json({ error: 'Faltan campos obligatorios para la evaluación.' });
      }

      const io = req.app.locals.io;
      const result = await RespuestaService.evaluateRespuesta(
        usuario_id,
        problema_id,
        respuesta,
        io
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error en la evaluación de respuesta:', error.message);
      return res
        .status(500)
        .json({ error: 'Error interno durante la evaluación.' });
    }
  },
};

export default RespuestaController;

import UserService from '../services/UserService.js';
import UserEntity from '../entities/UserEntity.js';

const UserController = {
  async joinUser(req, res) {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
      }

      const user = await UserService.joinUser(name);

      req.session.user = user;
      console.log('Usuario guardado en la sesión:', req.session.user);

      res.redirect('/api/room');
    } catch (error) {
      console.error('Error en /api/join:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  async getUserSession(req, res) {
    try {
      if (!req.session.user) {
        return res.status(401).json({ error: 'No autorizado. Debes iniciar sesión.' });
      }

      res.status(200).json({
        id: req.session.user.id,
        name: req.session.user.name,
      });
      console.log('Datos de la sesión del usuario:', req.session.user);
    } catch (error) {
      console.error('Error al obtener la sesión del usuario:', error.message);
      res.status(500).json({ error: 'Error al obtener la sesión del usuario.' });
    }
  },

  async getUserProfile(req, res) {
    try {
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado.' });
      }

      const user = await UserService.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: 'Perfil de usuario no encontrado.' });
      }

      res.status(200).json(user);
    } catch (error) {
      console.error('Error al obtener el perfil del usuario:', error.message);
      res.status(500).json({ error: 'Error al obtener el perfil del usuario.' });
    }
  },

  async hasCompletedProblem(req, res) {
    try {
      const userId = parseInt(req.params.userId);
      const problemId = parseInt(req.params.problemId);

      // Validar que los IDs sean números válidos
      if (isNaN(userId) || isNaN(problemId)) {
        return res.status(400).json({ error: 'IDs inválidos' });
      }

      const user = await UserEntity.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const completedExercises = user.completed_exercises ? JSON.parse(user.completed_exercises) : [];
      const completed = completedExercises.includes(problemId);

      res.json({ completed });
    } catch (error) {
      console.error('Error al verificar problema completado:', error);
      res.status(500).json({ error: 'Error al verificar el estado del problema' });
    }
  },

  async getAllStudents(req, res) {
    try {
      const { level, titulo_actual } = req.query;
      const students = await UserService.getAllStudents({ level, titulo_actual });
      res.status(200).json(students);
    } catch (error) {
      console.error('Error al obtener estudiantes:', error.message);
      res.status(500).json({ error: 'Error al obtener la lista de estudiantes.' });
    }
  },

};

export default UserController;

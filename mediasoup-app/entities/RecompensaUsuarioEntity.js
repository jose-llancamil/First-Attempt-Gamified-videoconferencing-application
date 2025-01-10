import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const RecompensaUsuarioEntity = {
  async create(data) {
    const [newRecompensaUsuario] = await db('recompensas_por_usuario')
      .insert(data)
      .returning('*');
    return newRecompensaUsuario;
  },

  async findAllByUser(usuario_id) {
    return db('recompensas_por_usuario')
      .join('recompensas', 'recompensas_por_usuario.recompensa_id', 'recompensas.id')
      .where({ usuario_id })
      .select('recompensas_por_usuario.*', 'recompensas.nombre', 'recompensas.descripcion');
  },

  async findAllWithDetails() {
    return db('recompensas_por_usuario')
      .join('users', 'recompensas_por_usuario.usuario_id', '=', 'users.id')
      .join('recompensas', 'recompensas_por_usuario.recompensa_id', '=', 'recompensas.id')
      .select(
        'recompensas_por_usuario.id',
        'users.name as usuario_nombre',
        'recompensas.nombre as recompensa_nombre',
        'recompensas_por_usuario.fecha_canje'
      );
  },
};

export default RecompensaUsuarioEntity;

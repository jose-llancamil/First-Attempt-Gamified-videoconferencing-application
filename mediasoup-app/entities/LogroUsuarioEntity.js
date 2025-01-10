import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const LogroUsuarioEntity = {
  async create(data) {
    const existing = await db('logros_por_usuario')
      .where({
        usuario_id: data.usuario_id,
        logro_id: data.logro_id
      })
      .first();

    if (existing) {
      console.log('Logro ya desbloqueado previamente');
      return existing;
    }

    const [newLogroUsuario] = await db('logros_por_usuario')
      .insert(data)
      .returning('*');

    console.log('Nuevo logro desbloqueado:', newLogroUsuario);
    return newLogroUsuario;
  },

  async findByUserAndLogro(usuario_id, logro_id) {
    return db('logros_por_usuario').where({ usuario_id, logro_id }).first();
  },

  async findAllByUser(usuario_id) {
    return db('logros_por_usuario')
      .join('logros', 'logros_por_usuario.logro_id', 'logros.id')
      .where({ usuario_id })
      .select('logros_por_usuario.*', 'logros.nombre', 'logros.descripcion');
  },
};

export default LogroUsuarioEntity;

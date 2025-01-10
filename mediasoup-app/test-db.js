import knexConfig from './knexfile.js';
import knex from 'knex';

const db = knex(knexConfig.development);

db.raw('SELECT 1+1 AS result')
  .then(() => {
    console.log('Conexión exitosa con la base de datos 🎉');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error al conectar con la base de datos:', err);
    process.exit(1);
  });

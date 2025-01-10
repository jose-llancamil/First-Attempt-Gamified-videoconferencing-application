-- Drop tables if they exist
DROP TABLE IF EXISTS logros_por_usuario;
DROP TABLE IF EXISTS logros;
DROP TABLE IF EXISTS respuestas;
DROP TABLE IF EXISTS problemas;
DROP TABLE IF EXISTS recompensas_por_usuario;
DROP TABLE IF EXISTS recompensas;
DROP TABLE IF EXISTS ranking;
DROP TABLE IF EXISTS titulos;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    experience INT DEFAULT 0,
    coins INT DEFAULT 0,
    level INT DEFAULT 1,
    titulo_actual VARCHAR(50) DEFAULT 'Principiante',
    completed_exercises JSONB DEFAULT '[]' CHECK (jsonb_typeof(completed_exercises) = 'array')
);

-- Problems Table
CREATE TABLE problemas (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    dificultad VARCHAR(50) NOT NULL,
    experiencia INT NOT NULL,
    monedas INT NOT NULL,
    entradas JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(entradas) = 'array'),
    salidas_esperadas JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(salidas_esperadas) = 'array')
);

-- Responses Table
CREATE TABLE respuestas (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES users (id) ON DELETE CASCADE,
    problema_id INT REFERENCES problemas (id) ON DELETE CASCADE,
    respuesta TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aceptado', 'Rechazado')),
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resultado_evaluacion VARCHAR(50) DEFAULT 'Pendiente' CHECK (resultado_evaluacion IN ('Pendiente', 'Correcto', 'Incorrecto')),
    detalles_evaluacion TEXT
);

-- Achievements Table
CREATE TABLE logros (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    criterio VARCHAR(50) NOT NULL,
    valor_criterio INT NOT NULL,
    imagen_url VARCHAR(255) NOT NULL
);

-- User Achievements Table
CREATE TABLE logros_por_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES users (id) ON DELETE CASCADE,
    logro_id INT REFERENCES logros (id) ON DELETE CASCADE,
    fecha_desbloqueo TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards Table
CREATE TABLE recompensas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    costo_monedas INT NOT NULL
);

-- User Rewards Table
CREATE TABLE recompensas_por_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES users (id) ON DELETE CASCADE,
    recompensa_id INT REFERENCES recompensas (id) ON DELETE CASCADE,
    fecha_canje TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_usuario_recompensa UNIQUE (usuario_id, recompensa_id)
);

-- Ranking Table
CREATE TABLE ranking (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES users (id) ON DELETE CASCADE,
    posicion INT NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Titles Table
CREATE TABLE titulos (
    id SERIAL PRIMARY KEY,
    nivel_min INT NOT NULL,
    nivel_max INT NOT NULL,
    titulo VARCHAR(100) NOT NULL
);

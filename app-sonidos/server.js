const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de PostgreSQL con Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para conexiones SSL en Render
  }
});

// Inicialización de la base de datos
async function initDB() {
  try {
    // Crear tabla de usuarios si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear tabla de sesiones si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear tabla de mensajes de audio si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audio_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        audio_url TEXT NOT NULL,
        duration INTEGER,
        listened BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear tabla de amigos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        friend_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      )
    `);
    
    console.log('Base de datos inicializada correctamente');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
}

// Ruta para registro de usuarios
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    
    // Verificar si el correo ya está registrado
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Este correo electrónico ya está registrado' });
    }
    
    // Verificar si el nombre de usuario ya está registrado
    const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Este nombre de usuario ya está en uso' });
    }
    
    // Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insertar nuevo usuario
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email
      }
    });
  } catch (err) {
    console.error('Error en el registro:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para inicio de sesión
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    // Buscar usuario por email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    const user = userResult.rows[0];
    
    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Generar token JWT
    const expiresIn = rememberMe ? '30d' : '1d';
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'soundsharing_secret_key',
      { expiresIn }
    );
    
    // Guardar sesión en la base de datos
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 1));
    
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Error en el inicio de sesión:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Middleware para verificar autenticación
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso no autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Acceso no autorizado' });
    }
    
    // Verificar token en la base de datos
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE token = $1', [token]);
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ message: 'Sesión no válida' });
    }
    
    const session = sessionResult.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);
      return res.status(401).json({ message: 'Sesión expirada' });
    }
    
    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'soundsharing_secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Error de autenticación:', err);
    res.status(401).json({ message: 'Acceso no autorizado' });
  }
};

// Ruta para cerrar sesión
app.post('/api/logout', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    // Eliminar la sesión
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    
    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para obtener perfil del usuario
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener información del usuario
    const userResult = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json({
      user: userResult.rows[0]
    });
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para buscar usuarios
app.get('/api/users/search', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id;
    
    if (!query) {
      return res.status(400).json({ message: 'Parámetro de búsqueda requerido' });
    }
    
    // Buscar usuarios que coincidan con el término de búsqueda
    const usersResult = await pool.query(
      `SELECT id, username, email FROM users 
       WHERE (username ILIKE $1 OR email ILIKE $1) AND id != $2 
       LIMIT 10`,
      [`%${query}%`, userId]
    );
    
    res.status(200).json({
      users: usersResult.rows
    });
  } catch (err) {
    console.error('Error en la búsqueda de usuarios:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para enviar solicitud de amistad
app.post('/api/friends/request', authenticate, async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.id;
    
    // Verificar que no se envíe solicitud a uno mismo
    if (userId === parseInt(friendId)) {
      return res.status(400).json({ message: 'No puedes enviarte una solicitud a ti mismo' });
    }
    
    // Verificar que el usuario exista
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [friendId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Verificar si ya existe una solicitud o amistad
    const existingRequest = await pool.query(
      'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );
    
    if (existingRequest.rows.length > 0) {
      const status = existingRequest.rows[0].status;
      if (status === 'accepted') {
        return res.status(400).json({ message: 'Ya son amigos' });
      } else if (status === 'pending') {
        return res.status(400).json({ message: 'Ya existe una solicitud pendiente' });
      }
    }
    
    // Crear solicitud de amistad
    await pool.query(
      'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3)',
      [userId, friendId, 'pending']
    );
    
    res.status(201).json({ message: 'Solicitud de amistad enviada' });
  } catch (err) {
    console.error('Error al enviar solicitud de amistad:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para aceptar solicitud de amistad
app.post('/api/friends/accept', authenticate, async (req, res) => {
  try {
    const { requestId } = req.body;
    const userId = req.user.id;
    
    // Verificar que la solicitud exista y sea para este usuario
    const requestResult = await pool.query(
      'SELECT * FROM friends WHERE id = $1 AND friend_id = $2 AND status = $3',
      [requestId, userId, 'pending']
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }
    
    // Actualizar estado de la solicitud
    await pool.query(
      'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['accepted', requestId]
    );
    
    res.status(200).json({ message: 'Solicitud de amistad aceptada' });
  } catch (err) {
    console.error('Error al aceptar solicitud de amistad:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para rechazar solicitud de amistad
app.post('/api/friends/reject', authenticate, async (req, res) => {
  try {
    const { requestId } = req.body;
    const userId = req.user.id;
    
    // Verificar que la solicitud exista y sea para este usuario
    const requestResult = await pool.query(
      'SELECT * FROM friends WHERE id = $1 AND friend_id = $2 AND status = $3',
      [requestId, userId, 'pending']
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }
    
    // Eliminar la solicitud
    await pool.query('DELETE FROM friends WHERE id = $1', [requestId]);
    
    res.status(200).json({ message: 'Solicitud de amistad rechazada' });
  } catch (err) {
    console.error('Error al rechazar solicitud de amistad:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Inicializar la base de datos al iniciar el servidor
initDB();

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
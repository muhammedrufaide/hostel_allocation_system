import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool;

// Helper to map id to _id for frontend compatibility
const mapId = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(mapId);
  const { id, ...rest } = obj;
  return { _id: id, ...rest };
};

// Connect and Test MySQL
async function initDB() {
  try {
    console.log('🔍 Initializing MySQL connection...');
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to MySQL server.');

    const dbName = process.env.DB_NAME || 'hostel_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Database "${dbName}" ensured.`);
    await connection.end();

    // Create the pool with the database name now
    pool = mysql.createPool({
      ...DB_CONFIG,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const poolConn = await pool.getConnection();
    
    // Create tables
    await poolConn.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rollNo VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        contact VARCHAR(20) NOT NULL,
        isAllocated BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await poolConn.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        roomNumber VARCHAR(50) NOT NULL UNIQUE,
        capacity INT NOT NULL,
        currentOccupancy INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await poolConn.query(`
      CREATE TABLE IF NOT EXISTS allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studentId INT NOT NULL UNIQUE,
        roomId INT NOT NULL,
        allocatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    // Seed initial data if empty
    const [roomsCount] = await poolConn.query('SELECT COUNT(*) as count FROM rooms');
    if (roomsCount[0].count === 0) {
      await poolConn.query('INSERT INTO rooms (roomNumber, capacity) VALUES ("101", 2), ("102", 3), ("201", 1)');
      await poolConn.query('INSERT INTO students (name, rollNo, email, contact) VALUES ("John Doe", "CS101", "john@example.com", "1234567890"), ("Jane Smith", "CS102", "jane@example.com", "0987654321")');
      console.log('🌱 Seeded initial Rooms and Students into MySQL.');
    }

    poolConn.release();
    console.log('🚀 Database fully initialized.');
  } catch (err) {
    console.error('❌ MySQL Initialization Error:', err.message);
    console.log('💡 Tip: Please check your MySQL credentials in the .env file.');
  }
}

initDB();

// Serve the backend viewer page
app.get('/backend', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend-viewer.html'));
});

// --- REST API ENDPOINTS: STUDENTS ---
app.get('/api/students', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const [rows] = await pool.query('SELECT * FROM students ORDER BY createdAt DESC');
    res.status(200).json(mapId(rows));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/students', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const { name, rollNo, email, contact } = req.body;
    const [result] = await pool.query(
      'INSERT INTO students (name, rollNo, email, contact) VALUES (?, ?, ?, ?)',
      [name, rollNo, email, contact]
    );
    res.status(201).json({ _id: result.insertId, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/students/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const [alloc] = await pool.query('SELECT * FROM allocations WHERE studentId = ?', [req.params.id]);
    if (alloc.length > 0) return res.status(400).json({ error: 'Cannot delete an allocated student. Vacate them first.' });
    
    await pool.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.status(200).json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REST API ENDPOINTS: ROOMS ---
app.get('/api/rooms', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const [rows] = await pool.query('SELECT * FROM rooms ORDER BY roomNumber ASC');
    res.status(200).json(mapId(rows));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rooms', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const { roomNumber, capacity } = req.body;
    const [result] = await pool.query(
      'INSERT INTO rooms (roomNumber, capacity) VALUES (?, ?)',
      [roomNumber, capacity]
    );
    res.status(201).json({ _id: result.insertId, ...req.body, currentOccupancy: 0 });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/rooms/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const [room] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (room.length === 0) return res.status(404).json({ error: 'Room not found' });
    if (room[0].currentOccupancy > 0) return res.status(400).json({ error: 'Cannot delete an occupied room. Vacate students first.' });
    
    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.status(200).json({ message: 'Room deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REST API ENDPOINTS: ALLOCATIONS ---
app.get('/api/allocations', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const [rows] = await pool.query(`
      SELECT a.id, a.studentId, a.roomId, a.allocatedAt, 
             s.name as studentName, s.rollNo as studentRoll,
             r.roomNumber
      FROM allocations a
      JOIN students s ON a.studentId = s.id
      JOIN rooms r ON a.roomId = r.id
    `);
    
    const formatted = rows.map(row => ({
      _id: row.id,
      studentId: { _id: row.studentId, name: row.studentName, rollNo: row.studentRoll },
      roomId: { _id: row.roomId, roomNumber: row.roomNumber },
      allocatedAt: row.allocatedAt
    }));
    
    res.status(200).json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/allocations', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { studentId, roomId } = req.body;
    
    const [existing] = await connection.query('SELECT * FROM allocations WHERE studentId = ?', [studentId]);
    if (existing.length > 0) throw new Error('Student is already allocated a room.');
    
    const [room] = await connection.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (room.length === 0) throw new Error('Room not found.');
    if (room[0].currentOccupancy >= room[0].capacity) throw new Error('Room is at full capacity.');

    const [result] = await connection.query(
      'INSERT INTO allocations (studentId, roomId) VALUES (?, ?)',
      [studentId, roomId]
    );
    
    await connection.query('UPDATE rooms SET currentOccupancy = currentOccupancy + 1 WHERE id = ?', [roomId]);
    await connection.query('UPDATE students SET isAllocated = true WHERE id = ?', [studentId]);

    await connection.commit();
    res.status(201).json({ _id: result.insertId, studentId, roomId });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/allocations/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [allocation] = await connection.query('SELECT * FROM allocations WHERE id = ?', [req.params.id]);
    if (allocation.length === 0) throw new Error('Allocation not found.');

    const { studentId, roomId } = allocation[0];

    await connection.query('UPDATE rooms SET currentOccupancy = GREATEST(0, currentOccupancy - 1) WHERE id = ?', [roomId]);
    await connection.query('UPDATE students SET isAllocated = false WHERE id = ?', [studentId]);
    await connection.query('DELETE FROM allocations WHERE id = ?', [req.params.id]);

    await connection.commit();
    res.status(200).json({ message: 'Room vacated successfully' });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Hostel API Server running on port ${PORT}`);
});

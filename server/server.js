import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import { fileURLToPath } from 'url';

import Student from './models/Student.js';
import Room from './models/Room.js';
import Allocation from './models/Allocation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
async function connectDB() {
  try {
    let mongoUri = process.env.MONGO_URI;
    
    if (mongoUri) {
      // Connect to the real MongoDB Atlas Cluster
      await mongoose.connect(mongoUri);
      console.log('====================================================');
      console.log('✅ Connected to MongoDB Atlas Cluster perfectly!');
      console.log('====================================================');
    } else {
      // Fallback to In-Memory Server if no URI is provided in .env
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log('====================================================');
      console.log('✅ Connected to In-Memory MongoDB perfectly!');
      console.log('🗄️  DATABASE URI: ' + mongoUri);
      console.log('    (You can connect to this URI using MongoDB Compass)');
      console.log('====================================================');
      
      // Seed initial data only for in-memory server
      const roomCount = await Room.countDocuments();
      if (roomCount === 0) {
        await Room.create([
          { roomNumber: '101', capacity: 2, currentOccupancy: 0 },
          { roomNumber: '102', capacity: 3, currentOccupancy: 0 },
          { roomNumber: '201', capacity: 1, currentOccupancy: 0 }
        ]);
        await Student.create([
          { name: 'John Doe', rollNo: 'CS101', email: 'john@example.com', contact: '1234567890' },
          { name: 'Jane Smith', rollNo: 'CS102', email: 'jane@example.com', contact: '0987654321' }
        ]);
        console.log('🌱 Seeded initial Rooms and Students into the database.');
      }
    }
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}

connectDB();

// Serve the backend viewer page
app.get('/backend', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend-viewer.html'));
});

// --- REST API ENDPOINTS: STUDENTS ---
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.status(200).json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/students', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const alloc = await Allocation.findOne({ studentId: req.params.id });
    if(alloc) return res.status(400).json({ error: 'Cannot delete an allocated student. Vacate them first.' });
    
    await Student.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REST API ENDPOINTS: ROOMS ---
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });
    res.status(200).json(rooms);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();
    res.status(201).json(room);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if(room.currentOccupancy > 0) return res.status(400).json({ error: 'Cannot delete an occupied room. Vacate students first.' });
    
    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Room deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REST API ENDPOINTS: ALLOCATIONS ---
app.get('/api/allocations', async (req, res) => {
  try {
    const allocations = await Allocation.find().populate('studentId').populate('roomId');
    res.status(200).json(allocations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/allocations', async (req, res) => {
  try {
    const { studentId, roomId } = req.body;
    
    // Check if student already allocated
    const existingAllocation = await Allocation.findOne({ studentId });
    if (existingAllocation) throw new Error('Student is already allocated a room.');
    
    // Check room capacity
    const room = await Room.findById(roomId);
    if (!room) throw new Error('Room not found.');
    if (room.currentOccupancy >= room.capacity) throw new Error('Room is at full capacity.');

    // Create allocation
    const allocation = new Allocation({ studentId, roomId });
    await allocation.save();
    
    // Update Room
    room.currentOccupancy += 1;
    await room.save();
    
    // Update Student
    await Student.findByIdAndUpdate(studentId, { isAllocated: true });

    res.status(201).json(allocation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Vacate Room (Delete Allocation)
app.delete('/api/allocations/:id', async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) throw new Error('Allocation not found.');

    // Update Room occupancy
    const room = await Room.findById(allocation.roomId);
    if (room) {
      room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
      await room.save();
    }

    // Update Student status
    await Student.findByIdAndUpdate(allocation.studentId, { isAllocated: false });

    // Remove Allocation
    await Allocation.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Room vacated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Hostel API Server running on port ${PORT}`);
});

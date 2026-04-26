import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  capacity: { type: Number, required: true, min: 1 },
  currentOccupancy: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Room', RoomSchema);

import mongoose from 'mongoose';

const AllocationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true }, // 1 student = 1 room max
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  allocatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Allocation', AllocationSchema);

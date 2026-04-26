import mongoose from 'mongoose';

const EntitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DORMANT', 'CORRUPTED', 'SYNCING'],
    default: 'ACTIVE',
  },
  powerLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  origin: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

export default mongoose.model('Entity', EntitySchema);

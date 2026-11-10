const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  type: { type: String, enum: ['automatic', 'manual', 'pre-restore'], required: true },
  taskCount: { type: Number, required: true },
  tasks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Backup', backupSchema);

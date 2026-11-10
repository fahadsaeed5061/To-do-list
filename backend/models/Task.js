const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, default: '', match: /^$|^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    category: { type: String, trim: true, maxlength: 40, default: 'Personal' },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

taskSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);

const mongoose = require('mongoose');
const Task = require('../models/Task');

const fields = ['title', 'description', 'date', 'time', 'status', 'priority', 'category'];

function taskInput(body) {
  const input = {};
  for (const field of fields) {
    if (body[field] !== undefined) input[field] = body[field];
  }
  if (input.status === 'completed') input.completedAt = body.completedAt || new Date();
  else if (input.status === 'pending') input.completedAt = null;
  return input;
}

exports.listTasks = async (_req, res, next) => {
  try {
    const tasks = await Task.find().sort({ date: 1, time: 1, createdAt: -1 }).lean();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const task = await Task.create(taskInput(req.body));
    res.status(201).json(task);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID.' });
    const task = await Task.findByIdAndUpdate(req.params.id, taskInput(req.body), {
      new: true,
      runValidators: true
    });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    res.json(task);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID.' });
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    res.json({ message: 'Task deleted.' });
  } catch (error) {
    next(error);
  }
};

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Backup = require('../models/Backup');
const { createBackup } = require('../services/backupService');

function isValidTask(task) {
  const isValidDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const isValidTimestamp = (value) => value === undefined || !Number.isNaN(new Date(value).getTime());
  return task && typeof task.title === 'string' && task.title.trim().length > 0 && task.title.length <= 120 &&
    (task.description === undefined || typeof task.description === 'string' && task.description.length <= 2000) &&
    isValidDate(task.date) &&
    (!task.time || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.time)) &&
    (!task.status || ['pending', 'completed'].includes(task.status)) &&
    (!task.priority || ['low', 'medium', 'high'].includes(task.priority)) &&
    (task.category === undefined || typeof task.category === 'string' && task.category.length <= 40) &&
    isValidTimestamp(task.completedAt) && isValidTimestamp(task.createdAt) && isValidTimestamp(task.updatedAt);
}

exports.listBackups = async (_req, res, next) => {
  try {
    const backups = await Backup.find({}, { tasks: 0 }).sort({ createdAt: -1 }).limit(30).lean();
    res.json(backups);
  } catch (error) {
    next(error);
  }
};

exports.createManualBackup = async (_req, res, next) => {
  try {
    res.status(201).json(await createBackup('manual'));
  } catch (error) {
    next(error);
  }
};

exports.downloadBackup = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid backup ID.' });
    const backup = await Backup.findById(req.params.id).lean();
    if (!backup) return res.status(404).json({ message: 'Backup not found.' });
    const payload = {
      format: 'daymark-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: backup.tasks
    };
    res.setHeader('Content-Disposition', `attachment; filename="daymark-backup-${backup.createdAt.toISOString().slice(0, 10)}.json"`);
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

exports.restoreBackup = async (req, res, next) => {
  try {
    const tasks = req.body && req.body.tasks;
    if (!Array.isArray(tasks) || tasks.length > 10000 || !tasks.every(isValidTask)) {
      return res.status(400).json({ message: 'Backup is invalid. Expected a tasks array with valid titles, dates, and field values (maximum 10,000 tasks).' });
    }

    const normalized = tasks.map((task) => ({
      title: task.title.trim(),
      description: typeof task.description === 'string' ? task.description : '',
      date: task.date,
      time: task.time || '',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      category: typeof task.category === 'string' && task.category.trim() ? task.category.trim() : 'Personal',
      completedAt: task.status === 'completed' ? task.completedAt || new Date() : null,
      createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
      updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date()
    }));

    const recoveryPoint = await createBackup('pre-restore');
    try {
      await Task.deleteMany({});
      if (normalized.length) await Task.insertMany(normalized, { ordered: true });
    } catch (restoreError) {
      try {
        await Task.deleteMany({});
        if (recoveryPoint.tasks.length) await Task.insertMany(recoveryPoint.tasks, { ordered: true });
      } catch (rollbackError) {
        return res.status(500).json({
          message: `Restore failed and automatic recovery was unsuccessful. Recovery backup ${recoveryPoint._id} is available in backup history.`,
          details: rollbackError.message
        });
      }
      throw restoreError;
    }
    res.json({ message: 'Backup restored successfully.', restoredCount: normalized.length });
  } catch (error) {
    next(error);
  }
};

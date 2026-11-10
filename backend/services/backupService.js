const cron = require('node-cron');
const Task = require('../models/Task');
const Backup = require('../models/Backup');

async function createBackup(type) {
  const tasks = await Task.find().lean();
  return Backup.create({ type, taskCount: tasks.length, tasks });
}

function startAutomaticBackups() {
  const schedule = process.env.BACKUP_CRON || '0 2 * * *';
  if (!cron.validate(schedule)) {
    console.error(`Invalid BACKUP_CRON expression: ${schedule}`);
    return;
  }
  cron.schedule(schedule, async () => {
    try {
      const backup = await createBackup('automatic');
      console.log(`Automatic backup saved (${backup.taskCount} tasks).`);
    } catch (error) {
      console.error('Automatic backup failed:', error.message);
    }
  });
}

module.exports = { createBackup, startAutomaticBackups };

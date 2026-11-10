const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const taskRoutes = require('./routes/taskRoutes');
const backupRoutes = require('./routes/backupRoutes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
if (process.env.CORS_ORIGIN) {
  const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(cors({ origin: allowedOrigins }));
}
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/tasks', taskRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'An unexpected server error occurred.' });
});

module.exports = app;

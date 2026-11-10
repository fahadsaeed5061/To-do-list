require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const { startAutomaticBackups } = require('./services/backupService');

const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is required. Add it to your .env file.');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    startAutomaticBackups();
    app.listen(port, () => console.log(`Daymark is running at http://localhost:${port}`));
  })
  .catch((error) => {
    console.error('Unable to connect to MongoDB:', error.message);
    process.exit(1);
  });

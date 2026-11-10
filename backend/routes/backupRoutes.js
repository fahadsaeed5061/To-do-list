const express = require('express');
const controller = require('../controllers/backupController');

const router = express.Router();

router.get('/', controller.listBackups);
router.post('/manual', controller.createManualBackup);
router.get('/:id/download', controller.downloadBackup);
router.post('/restore', controller.restoreBackup);

module.exports = router;

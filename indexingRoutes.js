const express = require('express');
const router = express.Router();
const { indexPage } = require('../controllers/indexingController');

router.post('/index', indexPage);

module.exports = router;
const express = require('express');
const router = express.Router();

const feedController = require('../controllers/feedController');
const { validateRequest } = require('../middleware/validator');

// Rota para solicitar a criação/atualização do catálogo (feed XML)
router.post('/generate', validateRequest('feedGeneration'), feedController.generateFeed);

// Rota para excluir/cancelar feed
router.post('/exclude', validateRequest('excludeFeed'), feedController.excludeFeed);

// Rota para atualizar um feed existente
router.post('/update', validateRequest('updateFeed'), feedController.updateFeed);

module.exports = router;
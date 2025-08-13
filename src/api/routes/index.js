const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const feedsRoutes = require('./feeds');

// Aplica o middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Disponibiliza os endpoints de feeds
router.use('/feeds', feedsRoutes);

module.exports = router;
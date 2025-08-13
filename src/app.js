require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { connectDB } = require('./config/mongodb');
const logger = require('./utils/logger');
const errorHandler = require('./utils/error-handler');

// Importa as rotas da API
const routes = require('./api/routes');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Loga informações básicas de cada requisição
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rota principal da API
app.use('/api', routes);

// Rota de saúde para monitoramento
app.get('/health', async (req, res) => {
  try {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      server: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        node: process.version
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de tratamento de erros
app.use(errorHandler);

async function bootstrap() {
  try {
    // Conectar ao MongoDB
    await connectDB();
    logger.info('MongoDB connected');

    // Inicia o servidor HTTP
    app.listen(port, host, () => {
      logger.info(`Server running on http://${host}:${port}`);
    });
  } catch (error) {
    logger.error('Failed to start the application', { error: error.message });
    process.exit(1);
  }
}

bootstrap();

module.exports = app;
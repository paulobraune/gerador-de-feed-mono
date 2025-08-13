const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Conecta ao MongoDB usando a URI e nome do DB informados nas variáveis de ambiente.
 */
async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME;
    if (!uri) {
      throw new Error('MongoDB URI not configured. Please set MONGODB_URI environment variable.');
    }

    // Monta as opções, usando dbName se existir
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      ...(dbName && { dbName }),
    };

    logger.info(`Connecting to MongoDB${dbName ? ` (${dbName})` : ''}`);
    await mongoose.connect(uri, options);

    // Eventos de conexão
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established');
    });
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection disconnected');
    });

    // Fechar conexão graciosamente no SIGINT
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
}

module.exports = {
  connectDB,
  mongoose,
};
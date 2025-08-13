const logger = require('./logger');

/**
 * Middleware para tratamento global de erros.
 * Registra o erro e retorna a resposta apropriada.
 */
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
      errors: err.details || err.errors
    });
  }
  
  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'Duplicate entry'
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
  
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: err.name || 'Internal server error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  });
}

module.exports = errorHandler;
const logger = require('../../utils/logger');

/**
 * Middleware de autenticação
 * 
 * Este middleware verifica se a requisição está autenticada.
 * Como este é um serviço privado, acessível somente pela dashboard principal,
 * a autenticação é feita por meio de um token de API compartilhado.
 *
 * Para autenticar, a requisição deve incluir o header:
 *  - x-api-key: <API_KEY>
 *
 * A chave informada é comparada com a variável de ambiente `API_KEY`.
 */
function authMiddleware(req, res, next) {
  try {
    // Obter o token de API do cabeçalho da requisição
    const apiKey = req.headers['x-api-key'];
    
    // Verifica se o token foi informado
    if (!apiKey) {
      logger.warn('API key missing in request');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API key is required'
      });
    }
    
    // Verifica se o token informado é válido, comparando com o valor da variável de ambiente
    if (apiKey !== process.env.API_KEY) {
      logger.warn('Invalid API key provided');
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Invalid API key'
      });
    }
    
    // Se a autenticação for bem-sucedida, prossegue para o próximo middleware ou rota
    next();
  } catch (error) {
    logger.error('Error in auth middleware', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Authentication error'
    });
  }
}

module.exports = {
  authMiddleware
};
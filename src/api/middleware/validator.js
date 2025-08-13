const Joi = require('joi');
const logger = require('../../utils/logger');

const schemas = {
  feedGeneration: Joi.object({
    business_id: Joi.string().required(),
    platform: Joi.string().valid('facebook', 'pinterest').required(),
    name: Joi.string().required(),
    fileName: Joi.string().optional(),
    options: Joi.object({
      primaryDomain: Joi.string().required(),
      currencyCode: Joi.string().default('BRL'),
      productType: Joi.string().valid('group', 'variant').default('group')
    }).required()
  }),

  excludeFeed: Joi.object({
    business_id: Joi.string().required(),
    fileName: Joi.string().required()
  }),

  updateFeed: Joi.object({
  business_id: Joi.string().required(),
  fileName: Joi.string().required(),
  options: Joi.object({
    primaryDomain: Joi.string().optional(),
    currencyCode: Joi.string().optional(),
    productType: Joi.string().valid('group', 'variant').optional()
  }).optional()
})
};

function validateRequest(schemaName) {
  return (req, res, next) => {
    if (!schemas[schemaName]) {
      logger.error(`Validation schema not found: ${schemaName}`);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Invalid validation schema'
      });
    }
    const dataToValidate = (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
      ? req.body
      : req.query;

    const { error, value } = schemas[schemaName].validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, '')
      }));
      logger.warn('Validation error', { schemaName, errors, method: req.method });
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        errors
      });
    }

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.body = value;
    } else {
      req.query = value;
    }
    next();
  };
}

module.exports = {
  validateRequest
};
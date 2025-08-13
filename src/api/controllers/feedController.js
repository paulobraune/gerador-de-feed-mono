const logger = require('../../utils/logger');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('../../config/r2');
const Feed = require('../../models/feed');
const { generateFeedForBusiness: generateFacebookFeed } = require('../../services/facebook');
const { generateFeedForBusiness: generatePinterestFeed } = require('../../services/pinterest');

class FeedController {
  /**
   * Executa a geração do feed para a plataforma informada
   */
  async generateFeed(req, res) {
    try {
      const { business_id, platform, name, fileName, options } = req.body;
      
      // Gerar filename se não fornecido
      let finalFileName = fileName;
      if (!finalFileName) {
        const timestamp = Date.now();
        finalFileName = `${business_id}_${timestamp}.xml`;
        logger.info('Generated fileName automatically', { business_id, finalFileName });
      }
      
      // Criar registro na tabela feeds
      const feedData = {
        business_id,
        name,
        fileName: finalFileName,
        platform,
        productType: options.productType || 'group',
        productCount: 0,
        variantCount: 0,
        active: true,
        source: 'shopify',
        status: 'pending'
      };
      
      try {
        const newFeed = new Feed(feedData);
        await newFeed.save();
        logger.info('Feed record created in database', { 
          business_id, 
          fileName: finalFileName,
          feedId: newFeed._id 
        });
      } catch (dbError) {
        logger.error('Error creating feed record in database', { 
          error: dbError.message,
          business_id,
          fileName: finalFileName
        });
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: 'Failed to create feed record'
        });
      }

      // Atualizar status do feed para processing
      await Feed.findOneAndUpdate(
        { fileName: finalFileName },
        { 
          $set: { 
            status: 'processing',
            'lastRun.startedAt': new Date()
          } 
        }
      );
      
      // Gerar feed de acordo com a plataforma
      logger.info(`Starting feed generation for platform ${platform}`, {
        business_id,
        platform,
        fileName: finalFileName
      });

      let result;
      try {
        if (platform === 'facebook') {
          result = await generateFacebookFeed(business_id, finalFileName, options);
        } else if (platform === 'pinterest') {
          result = await generatePinterestFeed(business_id, finalFileName, options);
        } else {
          throw new Error(`Unsupported platform: ${platform}`);
        }

        // Atualizar status e informações do feed
        const now = new Date();
        const startTime = (await Feed.findOne({ fileName: finalFileName })).lastRun?.startedAt || now;
        const duration = now.getTime() - startTime.getTime();

        await Feed.findOneAndUpdate(
          { fileName: finalFileName },
          {
            $set: {
              status: 'completed',
              productCount: result.productCount || 0,
              variantCount: result.variantCount || 0,
              fileSize: result.fileSize || 0,
              updatedAt: now,
              'lastRun.finishedAt': now,
              'lastRun.status': 'success',
              'lastRun.duration': duration
            }
          }
        );

        logger.info('Feed generation completed successfully', {
          business_id,
          fileName: finalFileName,
          platform,
          productCount: result.productCount,
          variantCount: result.variantCount
        });

      } catch (genError) {
        logger.error('Error generating feed', {
          error: genError.message,
          stack: genError.stack,
          business_id,
          platform,
          fileName: finalFileName
        });

        // Atualizar status para failed
        await Feed.findOneAndUpdate(
          { fileName: finalFileName },
          { 
            $set: { 
              status: 'failed',
              'lastRun.finishedAt': new Date(),
              'lastRun.status': 'failed',
              'lastRun.error.message': genError.message,
              'lastRun.error.stack': genError.stack
            } 
          }
        );

        return res.status(500).json({
          success: false,
          error: 'Feed generation failed',
          message: genError.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Feed generation completed successfully',
        fileName: finalFileName,
        feedName: name,
        productCount: result.productCount,
        variantCount: result.variantCount
      });
    } catch (error) {
      logger.error('Error in feed generation controller', { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Remove o arquivo XML do R2 e remove o registro do MongoDB
   */
  async excludeFeed(req, res) {
    try {
      const { business_id, fileName } = req.body;
      
      logger.info('Starting feed exclusion process', { business_id, fileName });

      // 1. Deletar o arquivo XML do Cloudflare R2
      let fileDeleted = false;
      try {
        const deleteParams = {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName
        };
        
        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await r2Client.send(deleteCommand);
        fileDeleted = true;
        logger.info('XML file deleted from R2', { fileName });
      } catch (r2Error) {
        logger.warn('Error deleting file from R2', { 
          error: r2Error.message, 
          fileName 
        });
        
        // Se o arquivo não existir, não é um erro crítico
        if (r2Error.name === 'NoSuchKey' || r2Error.Code === 'NoSuchKey') {
          logger.info('File not found in R2, considering as deleted', { fileName });
          fileDeleted = true;
        }
      }

      // 2. Remover o registro do feed do MongoDB
      let feedRecordDeleted = false;
      try {
        const deleteResult = await Feed.deleteOne({ 
          business_id, 
          fileName 
        });
        
        if (deleteResult.deletedCount > 0) {
          feedRecordDeleted = true;
          logger.info('Feed record deleted from MongoDB', { 
            business_id, 
            fileName 
          });
        } else {
          logger.info('No feed record found in MongoDB to delete', { 
            business_id, 
            fileName 
          });
        }
      } catch (mongoError) {
        logger.error('Error deleting feed record from MongoDB', { 
          error: mongoError.message, 
          business_id, 
          fileName 
        });
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: 'Failed to delete feed record'
        });
      }

      // 3. Preparar resposta com resultado das operações
      const result = {
        success: true,
        message: 'Feed exclusion process completed',
        operations: {
          fileDeleted,
          feedRecordDeleted
        },
        business_id,
        fileName
      };

      logger.info('Feed exclusion process completed', result);
      
      return res.status(200).json(result);

    } catch (error) {
      logger.error('Error in feed exclusion process', { 
        error: error.message, 
        stack: error.stack,
        business_id: req.body.business_id,
        fileName: req.body.fileName 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to exclude feed'
      });
    }
  }

  /**
   * Atualiza um feed existente e regenera o arquivo XML
   */
  async updateFeed(req, res) {
    try {
      const { business_id, fileName, options } = req.body;
      
      logger.info('Starting feed update process', { business_id, fileName });

      // 1. Verificar se o feed existe
      const existingFeed = await Feed.findOne({ business_id, fileName });
      
      if (!existingFeed) {
        logger.warn('Feed not found for update', { business_id, fileName });
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Feed not found with the specified fileName and business_id'
        });
      }

      // 2. Atualizar as opções do feed se fornecidas
      if (options) {
        if (options.productType) {
          existingFeed.productType = options.productType;
        }
        
        if (options.primaryDomain || options.currencyCode) {
          existingFeed.settings = existingFeed.settings || {};
          if (options.primaryDomain) {
            existingFeed.settings.primaryDomain = options.primaryDomain;
          }
          if (options.currencyCode) {
            existingFeed.settings.currencyCode = options.currencyCode;
          }
        }
      }

      // 3. Atualizar o status para 'processing'
      existingFeed.status = 'processing';
      existingFeed.lastRun = {
        startedAt: new Date()
      };
      await existingFeed.save();

      // 4. Gerar o feed atualizado baseado na plataforma
      logger.info(`Starting feed regeneration for ${existingFeed.platform}`, {
        business_id,
        fileName
      });

      let result;
      try {
        // Mesclar as opções salvas com as novas opções fornecidas
        const mergedOptions = {
          primaryDomain: existingFeed.settings?.primaryDomain || 'defaultdomain.com',
          currencyCode: existingFeed.settings?.currencyCode || 'BRL',
          productType: existingFeed.productType || 'group',
          ...options
        };

        if (existingFeed.platform === 'facebook') {
          result = await generateFacebookFeed(business_id, fileName, mergedOptions);
        } else if (existingFeed.platform === 'pinterest') {
          result = await generatePinterestFeed(business_id, fileName, mergedOptions);
        } else {
          throw new Error(`Unsupported platform: ${existingFeed.platform}`);
        }

        // 5. Atualizar o status e informações do feed
        const now = new Date();
        const duration = now.getTime() - existingFeed.lastRun.startedAt.getTime();

        existingFeed.status = 'completed';
        existingFeed.productCount = result.productCount || 0;
        existingFeed.variantCount = result.variantCount || 0;
        existingFeed.fileSize = result.fileSize || 0;
        existingFeed.updatedAt = now;
        existingFeed.lastRun.finishedAt = now;
        existingFeed.lastRun.status = 'success';
        existingFeed.lastRun.duration = duration;

        // 6. Adicionar ao histórico se necessário
        if (existingFeed.history && Array.isArray(existingFeed.history)) {
          // Limitar o histórico a 10 entradas (remover a mais antiga se necessário)
          if (existingFeed.history.length >= 10) {
            existingFeed.history.shift();
          }
          
          existingFeed.history.push({
            startedAt: existingFeed.lastRun.startedAt,
            finishedAt: now,
            duration: duration,
            status: 'success',
            productCount: result.productCount || 0
          });
        }

        await existingFeed.save();

        logger.info('Feed update completed successfully', {
          business_id,
          fileName,
          platform: existingFeed.platform,
          productCount: result.productCount,
          variantCount: result.variantCount
        });

      } catch (genError) {
        logger.error('Error regenerating feed', {
          error: genError.message,
          stack: genError.stack,
          business_id,
          fileName
        });

        // Atualizar status para failed
        existingFeed.status = 'failed';
        existingFeed.lastRun.finishedAt = new Date();
        existingFeed.lastRun.status = 'failed';
        existingFeed.lastRun.error = {
          message: genError.message,
          stack: genError.stack
        };
        await existingFeed.save();

        return res.status(500).json({
          success: false,
          error: 'Feed update failed',
          message: genError.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Feed updated successfully',
        fileName: fileName,
        feedName: existingFeed.name,
        productCount: result.productCount,
        variantCount: result.variantCount
      });
    } catch (error) {
      logger.error('Error in feed update controller', { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new FeedController();
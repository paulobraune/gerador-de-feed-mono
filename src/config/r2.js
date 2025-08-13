const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Testa a conexão com o Cloudflare R2
 */
async function testR2Connection() {
  try {
    const command = new ListBucketsCommand({});
    await r2Client.send(command);
    logger.info('Cloudflare R2 connection successful');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Cloudflare R2', { error: error.message });
    return false;
  }
}

module.exports = {
  r2Client,
  testR2Connection,
  BUCKET_NAME: process.env.R2_BUCKET_NAME,
};
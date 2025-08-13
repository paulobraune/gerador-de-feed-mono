const xmlbuilder = require('xmlbuilder');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../../utils/logger');
const Product = require('../../models/product');
const { r2Client } = require('../../config/r2');

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

function toProperCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(^|\s)\S/g, L => L.toUpperCase());
}

function cleanText(text) {
  if (!text) return '';
  let cleanedText = text.replace(/<[^>]*>/g, ' ');
  cleanedText = cleanedText.replace(/(?:https?|ftp):\/\/[\n\S]+/gi, '');
  cleanedText = cleanedText.replace(/([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|\u{1FA70}-\u{1FAFF}|\u200d|\u2388)/gu, '');
  cleanedText = cleanedText.replace(/\s\s+/g, ' ').trim();
  if (cleanedText.length > 5000) {
    cleanedText = cleanedText.substring(0, 4997) + '...';
  }
  return cleanedText;
}

function getProductCategory(product) {
  if (product.google && product.google.productCategoryID) {
    return product.google.productCategoryID;
  }
  return null;
}

function getGender(product) {
  if (product.gender) return product.gender;
  return null;
}

function getAgeGroup(product) {
  if (product.age) return product.age;
  return null;
}

function getVideoLink(product) {
  if (product.videolinkurl && typeof product.videolinkurl === 'string' && product.videolinkurl.trim() !== '') {
    return product.videolinkurl.trim();
  }
  return null;
}

async function generateFeedForBusiness(business_id, fileName, options) {
  try {
    logger.info(`Starting Facebook feed generation for business`, { business_id, fileName });
    const products = await Product.find({ business_id, status: 'active' });

    if (!products || products.length === 0) {
      logger.warn('No active products found for Facebook feed generation', { business_id });
    }

    const primaryDomain = options.primaryDomain || 'defaultdomain.com';
    const currencyCode = options.currencyCode || 'BRL';
    const language = options.language || 'pt-BR';
    const productType = options.productType || 'group';

    const feed = xmlbuilder
      .create('rss', { version: '1.0', encoding: 'UTF-8' })
      .att('xmlns:g', 'http://base.google.com/ns/1.0')
      .att('version', '2.0');
    const channel = feed.ele('channel');
    channel.ele('title', {}, 'Product Feed');
    channel.ele('link', {}, `https://${primaryDomain}`);
    channel.ele('description', {}, `Product feed for Facebook Catalog`);

    let itemCount = 0;
    let skippedZeroPriceCount = 0;
    let productsProcessed = 0;
    let variantsProcessed = 0;

    products.forEach(product => {
      if (product.status !== 'active') {
        return;
      }

      const googleProductCategory = getProductCategory(product);
      const gender = getGender(product);
      const ageGroup = getAgeGroup(product);
      const videoLink = getVideoLink(product);

      if (productType === 'variant' && product.variants && product.variants.length > 0) {
        let productHasValidVariants = false;

        product.variants.forEach(variant => {
          if (!variant.price || variant.price <= 0) {
            skippedZeroPriceCount++;
            return;
          }

          productHasValidVariants = true;
          const item = channel.ele('item');
          itemCount++;
          variantsProcessed++;

          item.ele('g:availability', {}, 'in stock');
          item.ele('g:condition', {}, 'new');
          item.ele('g:id', {}, variant.variantId);
          item.ele('g:item_group_id', {}, product.productId);
          item.ele('title', {}, toProperCase(product.title));
          item.ele('description', {}, cleanText(product.description));

          const originalPrice = variant.compareAtPrice;
          const currentPrice = variant.price;
          const isOnSale = originalPrice && originalPrice > currentPrice;

          if (isOnSale) {
            item.ele('g:price', {}, `${originalPrice.toFixed(2)} ${currencyCode}`);
            item.ele('g:sale_price', {}, `${currentPrice.toFixed(2)} ${currencyCode}`);
          } else {
            item.ele('g:price', {}, `${currentPrice.toFixed(2)} ${currencyCode}`);
          }

          item.ele('link', {}, `https://${primaryDomain}/products/${product.handle}?variant=${variant.variantId}`);

          const imageUrl = variant.imageUrl || product.featuredImage || (product.images.length > 0 ? product.images[0].url : '');
          if (imageUrl) {
            item.ele('g:image_link', {}, imageUrl);
          }

          let additionalImageCountForItem = 0;
          product.images.forEach(img => {
            if (img.url && img.url !== imageUrl && additionalImageCountForItem < 10) {
              item.ele('g:additional_image_link', {}, img.url);
              additionalImageCountForItem++;
            }
          });

          if (product.brand || product.vendor) {
            item.ele('g:brand', {}, product.brand || product.vendor);
          }
          if (product.productType) {
            item.ele('g:product_type', {}, product.productType);
          }
          if (product.tags && Array.isArray(product.tags)) {
            product.tags.forEach((tag, index) => {
              if (index < 5) {
                const tagName = tag.trim();
                if (tagName) {
                  item.ele(`g:custom_label_${index}`, {}, tagName);
                }
              }
            });
          }

          if (googleProductCategory) {
            item.ele('g:google_product_category', {}, googleProductCategory);
          }
          if (gender) {
            item.ele('g:gender', {}, gender);
          }
          if (ageGroup) {
            item.ele('g:age_group', {}, ageGroup);
          }
          if (videoLink) {
            item.ele('g:video_link', {}, videoLink);
          }
        });

        if (productHasValidVariants) {
          productsProcessed++;
        }

      } else {
        const baseVariant = (product.variants && product.variants.length > 0) ? product.variants[0] : null;
        if (!baseVariant || !baseVariant.price || baseVariant.price <= 0) {
          skippedZeroPriceCount++;
          return;
        }

        productsProcessed++;
        const item = channel.ele('item');
        itemCount++;

        item.ele('g:availability', {}, 'in stock');
        item.ele('g:condition', {}, 'new');
        item.ele('g:id', {}, product.productId);
        item.ele('g:item_group_id', {}, product.productId);
        item.ele('title', {}, toProperCase(product.title));
        item.ele('description', {}, cleanText(product.description));

        const originalPriceGroup = baseVariant.compareAtPrice;
        const currentPriceGroup = baseVariant.price;
        const isGroupOnSale = originalPriceGroup && originalPriceGroup > currentPriceGroup;

        if (isGroupOnSale) {
          item.ele('g:price', {}, `${originalPriceGroup.toFixed(2)} ${currencyCode}`);
          item.ele('g:sale_price', {}, `${currentPriceGroup.toFixed(2)} ${currencyCode}`);
        } else {
          item.ele('g:price', {}, `${currentPriceGroup.toFixed(2)} ${currencyCode}`);
        }

        item.ele('link', {}, `https://${primaryDomain}/products/${product.handle}`);

        const mainImageUrl = product.featuredImage || (product.images.length > 0 ? product.images[0].url : '');
        if (mainImageUrl) {
          item.ele('g:image_link', {}, mainImageUrl);
        }

        let additionalImageCountGroup = 0;
        product.images.forEach(image => {
          if (image.url && image.url !== mainImageUrl && additionalImageCountGroup < 10) {
            item.ele('g:additional_image_link', {}, image.url);
            additionalImageCountGroup++;
          }
        });

        if (product.brand || product.vendor) {
          item.ele('g:brand', {}, product.brand || product.vendor);
        }
        if (product.productType) {
          item.ele('g:product_type', {}, product.productType);
        }
        if (product.tags && Array.isArray(product.tags)) {
          product.tags.forEach((tag, index) => {
            if (index < 5) {
              const tagName = tag.trim();
              if (tagName) {
                item.ele(`g:custom_label_${index}`, {}, tagName);
              }
            }
          });
        }

        if (googleProductCategory) {
          item.ele('g:google_product_category', {}, googleProductCategory);
        }
        if (gender) {
          item.ele('g:gender', {}, gender);
        }
        if (ageGroup) {
          item.ele('g:age_group', {}, ageGroup);
        }
        if (videoLink) {
          item.ele('g:video_link', {}, videoLink);
        }
      }
    });

    const finalProductCount = productsProcessed;
    const xmlString = feed.end({ pretty: true });

    logger.info('Facebook feed XML generated successfully', {
      productCount: finalProductCount,
      itemCount: itemCount,
      variantCount: variantsProcessed,
      skippedZeroPriceCount: skippedZeroPriceCount,
      fileName
    });

    await saveToR2(fileName, xmlString);

    return {
      success: true,
      productCount: finalProductCount,
      itemCount: itemCount,
      variantCount: variantsProcessed,
      skippedCount: skippedZeroPriceCount,
      fileName,
      fileSize: Buffer.byteLength(xmlString, 'utf8')
    };
  } catch (error) {
    logger.error('Error generating Facebook feed', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function saveToR2(fileName, content) {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: content,
      ContentType: 'application/xml',
      CacheControl: 'max-age=3600'
    };
    const command = new PutObjectCommand(params);
    await r2Client.send(command);
    logger.info('Feed saved to Cloudflare R2', { fileName });

    const publicDomain = process.env.R2_PUBLIC_DOMAIN;
    let publicUrl = `https://${BUCKET_NAME}.r2.cloudflarestorage.com/${fileName}`;
    if (publicDomain) {
      publicUrl = `https://${publicDomain}/${fileName}`;
    }
    logger.info(`Feed potentially accessible at: ${publicUrl}`);

    return {
      success: true,
    };
  } catch (error) {
    logger.error('Error saving feed to R2', { error: error.message });
    throw error;
  }
}

module.exports = {
  generateFeedForBusiness
};
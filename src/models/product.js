const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  variantId: {
    type: String,
    required: true,
  },
  title: String,
  sku: String,
  price: Number,
  compareAtPrice: Number,
  barcode: String,
  inventoryQuantity: Number,
  weight: Number,
  weightUnit: String,
  requiresShipping: Boolean,
  taxable: Boolean,
  imageUrl: String,
  position: Number,
  options: [{
    name: String,
    value: String
  }],
});

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true,
  },
  business_id: {
    type: String,
    required: true,
    index: true,
  },
  source: {
    type: String,
    required: true,
    enum: ['shopify'],
    default: 'shopify',
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  productType: String,
  vendor: String,
  handle: String,
  status: {
    type: String,
    enum: ['active', 'archived', 'draft'],
    default: 'active',
  },
  tags: [String],
  publishedAt: Date,
  isPublished: Boolean,
  collections: [String],
  brand: String,
  condition: {
    type: String,
    enum: ['new', 'refurbished', 'used'],
    default: 'new',
  },
  availability: {
    type: String,
    enum: ['in stock', 'out of stock', 'preorder'],
    default: 'in stock',
  },
  featuredImage: String,
  images: [{
    id: String,
    url: String,
    position: Number,
    alt: String,
  }],
  variants: [variantSchema],
  url: String,
  lastSyncedAt: Date,
  metafields: [{
    key: String,
    value: String,
    namespace: String,
  }],
  exclude: {
    type: Boolean,
    default: false,
  },
  age: {
    type: String,
    default: null,
  },
  gender: {
    type: String,
    default: null,
  },
  videolinkurl: {
    type: String,
    default: null,
  },
  google: {
    productCategoryID: {
      type: String,
      default: null,
    },
    productCategoryName: {
      type: String,
      default: null,
    },
  },
}, {
  timestamps: true,
});

// índices principais
productSchema.index({ business_id: 1, source: 1 });
productSchema.index({ business_id: 1, status: 1 });
productSchema.index({ business_id: 1, exclude: 1 });

const Product = mongoose.model('business_catalog_products', productSchema);

module.exports = Product;

const mongoose = require('mongoose');

const feedSchema = new mongoose.Schema({
  business_id: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    required: true,
    enum: ['facebook', 'google', 'instagram', 'pinterest'],
  },
  productType: {
    type: String,
    required: true,
    enum: ['group', 'variant'],
    default: 'group',
  },
  active: {
    type: Boolean,
    required: true,
    default: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  progress: {
    current: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 100,
    },
    percentage: {
      type: Number,
      default: 0,
    },
  },
  fileUrl: String,
  fileSize: Number,
  productCount: {
    type: Number,
    default: 0,
  },
  variantCount: {
    type: Number,
    default: 0,
  },
  lastRun: {
    startedAt: Date,
    finishedAt: Date,
    duration: Number, // em milissegundos
    status: {
      type: String,
      enum: ['success', 'failed'],
    },
    error: {
      message: String,
      stack: String,
    },
  },
  settings: {
    includeOutOfStock: {
      type: Boolean,
      default: false,
    },
    includeDraftProducts: {
      type: Boolean,
      default: false,
    },
    currencyCode: {
      type: String,
      default: 'BRL',
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  history: {
    type: [{
      startedAt: Date,
      finishedAt: Date,
      duration: Number,
      status: {
        type: String,
        enum: ['success', 'failed'],
      },
      productCount: Number,
      error: {
        message: String,
      },
    }],
    validate: [arrayLimit, '{PATH} exceeds the limit of 10']
  },
});

function arrayLimit(val) {
  return val.length <= 10;
}

feedSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

feedSchema.index({ business_id: 1, platform: 1 });
feedSchema.index({ business_id: 1, status: 1 });
feedSchema.index({ business_id: 1, active: 1 });

const Feed = mongoose.model('business_catalog_feeds', feedSchema);
module.exports = Feed;
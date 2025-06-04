// models/AIContext.js
const mongoose = require('mongoose');

const AIContextSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    default: 'Product Information'
  },
  content: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('AIContext', AIContextSchema);
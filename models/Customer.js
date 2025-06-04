// Mise à jour du modèle Customer.js pour ajouter le champ orderStatus

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    trim: true,
  },
  receivedWelcomeMessage: {
    type: Boolean,
    default: false,
  },
  firstContactDate: {
    type: Date,
    default: Date.now,
  },
  lastContactDate: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 1,
  },
  // Nouveau champ pour le statut de la commande
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed'],
    default: 'pending'
  },
  // Nouvelle propriété pour stocker la ville du client
  city: {
    type: String,
    trim: true
  },
  // Extension du champ notes pour stocker des informations supplémentaires
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', CustomerSchema);
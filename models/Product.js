// -- models/Product.js -- //
const mongoose = require('mongoose');

// Schéma pour les produits
const ProductSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'MAD'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: 0
  },
  images: [{
    type: String
  }],
  tags: [{
    type: String,
    trim: true
  }],
  attributes: {
    type: Map,
    of: String,
    default: {}
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Méthode pour obtenir les données formatées pour l'IA
ProductSchema.statics.getProductsInfoForAI = async function() {
  try {
    // Récupérer tous les produits actifs
    const products = await this.find({ active: true });
    
    // Organiser les produits par catégorie
    const categoriesMap = {};
    
    products.forEach(product => {
      if (!categoriesMap[product.category]) {
        categoriesMap[product.category] = [];
      }
      
      categoriesMap[product.category].push({
        id: product.code,
        name: product.name,
        price: product.price,
        description: product.description,
        inStock: product.inStock,
        ...(product.attributes.size && { size: Array.from(product.attributes).map(([k, v]) => `${k}: ${v}`) })
      });
    });
    
    // Convertir en format attendu par l'IA
    const categories = Object.keys(categoriesMap).map(name => ({
      name,
      products: categoriesMap[name]
    }));
    
    return {
      categories,
      shipping: {
        standard: 'Livraison standard sous 3-5 jours',
        express: 'Livraison express 24h disponible pour 50 MAD supplémentaires'
      },
      returns: 'Retours gratuits sous 14 jours',
      support: 'Service client disponible 7j/7 de 9h à 18h'
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des informations produits pour l\'IA:', error);
    return null;
  }
};

module.exports = mongoose.model('Product', ProductSchema);
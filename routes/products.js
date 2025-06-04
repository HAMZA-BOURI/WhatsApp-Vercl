// -- routes/products.js -- //
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const Category = require('../models/Category');
const aiService = require('../services/ai');

// Configuration pour le téléchargement d'images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/products');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accepter uniquement les images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images sont acceptées!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: fileFilter
});

// GET tous les produits (avec pagination et filtres)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      search, 
      inStock,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    // Filtrer par catégorie
    if (category) {
      query.category = category;
    }
    
    // Filtre de recherche
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filtre de stock
    if (inStock !== undefined) {
      query.inStock = inStock === 'true';
    }
    
    // Filtre de prix
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    // Options de tri
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Exécuter la requête avec pagination
    const products = await Product.find(query)
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    
    // Compter le nombre total pour la pagination
    const total = await Product.countDocuments(query);
    
    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET un produit par ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST créer un nouveau produit
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const productData = req.body;
    
    // Traiter les attributs (depuis JSON)
    if (productData.attributes && typeof productData.attributes === 'string') {
      productData.attributes = JSON.parse(productData.attributes);
    }
    
    // Traiter les tags
    if (productData.tags && typeof productData.tags === 'string') {
      productData.tags = productData.tags.split(',').map(tag => tag.trim());
    }
    
    // Ajouter les images téléchargées
    if (req.files && req.files.length > 0) {
      productData.images = req.files.map(file => `/uploads/products/${file.filename}`);
    }
    
    const product = new Product(productData);
    await product.save();
    
    // Mettre à jour le cache des produits pour l'IA
    await aiService.loadProductsInfo(true);
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error);
    res.status(400).json({ message: error.message });
  }
});

// PUT mettre à jour un produit
router.put('/:id', upload.array('images', 5), async (req, res) => {
  try {
    const productData = req.body;
    
    // Traiter les attributs (depuis JSON)
    if (productData.attributes && typeof productData.attributes === 'string') {
      productData.attributes = JSON.parse(productData.attributes);
    }
    
    // Traiter les tags
    if (productData.tags && typeof productData.tags === 'string') {
      productData.tags = productData.tags.split(',').map(tag => tag.trim());
    }
    
    // Traiter les images existantes
    let currentImages = [];
    if (productData.existingImages && typeof productData.existingImages === 'string') {
      currentImages = JSON.parse(productData.existingImages);
      delete productData.existingImages;
    }
    
    // Ajouter les nouvelles images téléchargées
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/products/${file.filename}`);
      productData.images = [...currentImages, ...newImages];
    } else {
      productData.images = currentImages;
    }
    
    // Mettre à jour le produit
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      productData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Mettre à jour le cache des produits pour l'IA
    await aiService.loadProductsInfo(true);
    
    res.json(product);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE supprimer un produit
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    // Supprimer les images du produit
    if (product.images && product.images.length > 0) {
      product.images.forEach(imagePath => {
        try {
          const fullPath = path.join(__dirname, '../public', imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.error('Erreur lors de la suppression de l\'image:', err);
        }
      });
    }
    
    // Mettre à jour le cache des produits pour l'IA
    await aiService.loadProductsInfo(true);
    
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET Obtenir les produits formatés pour l'IA
router.get('/ai/formatted', async (req, res) => {
  try {
    const productsInfo = await aiService.loadProductsInfo(true);
    res.json(productsInfo);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits formatés pour l\'IA:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
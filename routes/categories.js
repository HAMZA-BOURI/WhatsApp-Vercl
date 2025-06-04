// -- routes/categories.js -- //
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Category = require('../models/Category');
const Product = require('../models/Product');
const aiService = require('../services/ai');

// Configuration pour le téléchargement d'images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/categories');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'category-' + uniqueSuffix + ext);
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
    fileSize: 2 * 1024 * 1024, // 2MB max pour les icônes de catégories
  },
  fileFilter: fileFilter
});

// Fonction pour créer un slug à partir d'un nom
const createSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-');
};

// GET toutes les catégories
router.get('/', async (req, res) => {
  try {
    const { hierarchical } = req.query;
    
    if (hierarchical === 'true') {
      // Renvoyer la structure hiérarchique
      const hierarchy = await Category.getHierarchy();
      return res.json(hierarchy);
    }
    
    // Renvoyer toutes les catégories (format plat)
    const categories = await Category.find()
      .sort({ order: 1, name: 1 })
      .populate('parent', 'name');
      
    res.json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET une catégorie par ID
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST créer une nouvelle catégorie
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, parent, order } = req.body;
    
    // Créer le slug
    const slug = createSlug(name);
    
    // Vérifier si le slug existe déjà
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
    }
    
    // Créer la nouvelle catégorie
    const category = new Category({
      name,
      description,
      slug,
      parent: parent || null,
      order: order || 0,
      image: req.file ? `/uploads/categories/${req.file.filename}` : null
    });
    
    await category.save();
    
    // Mettre à jour le cache des produits pour l'IA (car les catégories sont liées)
    await aiService.loadProductsInfo(true);
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    res.status(400).json({ message: error.message });
  }
});

// PUT mettre à jour une catégorie
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, description, parent, order, active } = req.body;
    const categoryData = {};
    
    // Ne mettre à jour que les champs fournis
    if (name) {
      categoryData.name = name;
      categoryData.slug = createSlug(name);
      
      // Vérifier si le slug existe déjà (sauf pour cette catégorie)
      const existingCategory = await Category.findOne({ 
        slug: categoryData.slug,
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
      }
    }
    
    if (description !== undefined) categoryData.description = description;
    if (parent !== undefined) categoryData.parent = parent || null;
    if (order !== undefined) categoryData.order = order;
    if (active !== undefined) categoryData.active = active === 'true';
    
    // Ajouter l'image si téléchargée
    if (req.file) {
      categoryData.image = `/uploads/categories/${req.file.filename}`;
      
      // Supprimer l'ancienne image si elle existe
      const oldCategory = await Category.findById(req.params.id);
      if (oldCategory && oldCategory.image) {
        try {
          const oldImagePath = path.join(__dirname, '../public', oldCategory.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (err) {
          console.error('Erreur lors de la suppression de l\'ancienne image:', err);
        }
      }
    }
    
    // Mettre à jour la catégorie
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      categoryData,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    // Mettre à jour le cache des produits pour l'IA
    await aiService.loadProductsInfo(true);
    
    res.json(category);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE supprimer une catégorie
router.delete('/:id', async (req, res) => {
  try {
    // Vérifier si des produits utilisent cette catégorie
    const productsCount = await Product.countDocuments({ category: req.params.id });
    if (productsCount > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer la catégorie: ${productsCount} produits y sont associés` 
      });
    }
    
    // Vérifier si des sous-catégories existent
    const childrenCount = await Category.countDocuments({ parent: req.params.id });
    if (childrenCount > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer la catégorie: ${childrenCount} sous-catégories y sont associées` 
      });
    }
    
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    // Supprimer l'image de la catégorie
    if (category.image) {
      try {
        const imagePath = path.join(__dirname, '../public', category.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (err) {
        console.error('Erreur lors de la suppression de l\'image:', err);
      }
    }
    
    // Mettre à jour le cache des produits pour l'IA
    await aiService.loadProductsInfo(true);
    
    res.json({ message: 'Catégorie supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET les produits d'une catégorie
router.get('/:id/products', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const products = await Product.find({ category: req.params.id })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments({ category: req.params.id });
    
    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des produits de la catégorie:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
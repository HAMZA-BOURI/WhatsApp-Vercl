// -- models/Category.js -- //
const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  image: {
    type: String
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Méthode pour obtenir une structure hiérarchique des catégories
CategorySchema.statics.getHierarchy = async function() {
  const categories = await this.find({ active: true }).sort({ order: 1 });
  
  const rootCategories = categories.filter(c => !c.parent);
  const childrenCategories = categories.filter(c => c.parent);
  
  // Construire l'arborescence
  const buildTree = (parentId) => {
    return childrenCategories
      .filter(c => c.parent && c.parent.toString() === parentId.toString())
      .map(c => ({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        children: buildTree(c._id)
      }));
  };
  
  return rootCategories.map(c => ({
    _id: c._id,
    name: c.name,
    slug: c.slug,
    image: c.image,
    children: buildTree(c._id)
  }));
};

module.exports = mongoose.model('Category', CategorySchema);
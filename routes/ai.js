// routes/ai.js - Fixed for Express 5.x compatibility
const express = require('express');
const router = express.Router();
const AIContext = require('../models/AIContext');
const aiService = require('../services/ai-enhanced'); // Corrigé l'import

// Get the latest AI context
router.get('/context', async (req, res) => {
  try {
    const context = await AIContext.findOne({ active: true }).sort({ updatedAt: -1 });
    res.json(context || { content: '', name: 'Product Information' });
  } catch (error) {
    console.error('Error retrieving AI context:', error);
    res.status(500).json({ message: error.message });
  }
});

// Save or update AI context
router.post('/context', async (req, res) => {
  try {
    const { content, name } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    
    // Update existing or create new
    const context = await AIContext.findOne({ active: true });
    
    if (context) {
      context.content = content;
      if (name) context.name = name;
      await context.save();
      res.json({ success: true, context });
    } else {
      const newContext = new AIContext({
        content,
        name: name || 'Product Information'
      });
      await newContext.save();
      res.json({ success: true, context: newContext });
    }
    
    // Update the AI service to use the new context
    aiService.clearCache();
    
  } catch (error) {
    console.error('Error saving AI context:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test the AI with a question using the saved context
router.post('/test', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }
    
    const response = await aiService.analyzeMessageWithAI(question, { isTest: true });
    
    res.json({
      success: true,
      question,
      response: response.response
    });
    
  } catch (error) {
    console.error('Error testing AI:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Refresh AI product information
router.post('/refresh-product-info', async (req, res) => {
  try {
    await aiService.loadProductsInfo(true); // Force refresh
    res.json({ success: true, message: 'Product information refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing product info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
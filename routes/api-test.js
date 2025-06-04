// routes/api-test.js - Fixed for Express 5.x compatibility
const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-enhanced'); // Corrigé l'import

// Test endpoint for the AI service
router.post('/test-ai', async (req, res) => {
  try {
    const { message, customerInfo } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }
    
    const result = await aiService.analyzeMessageWithAI(
      message,
      customerInfo || { name: 'Test User', isTest: true }
    );
    
    res.json({
      success: true,
      result: {
        aiGenerated: result.aiGenerated,
        language: result.analysis ? result.analysis.language : 'unknown',
        intents: result.analysis ? result.analysis.intent : {},
        response: result.response
      }
    });
  } catch (error) {
    console.error('Error testing AI:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
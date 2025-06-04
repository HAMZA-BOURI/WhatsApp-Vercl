// routes/gateway.js - Gateway routes for Vercel deployment
const express = require('express');
const router = express.Router();
const gatewayService = require('../services/gateway-service');
const aiService = require('../services/ai-vercel');
const Customer = require('../models/Customer');

// Process a message through the gateway
router.post('/process-message', async (req, res) => {
  try {
    const { message, phoneNumber } = req.body;
    
    if (!message || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }
    
    // Try to process through the gateway
    const gatewayResult = await gatewayService.processMessage(message, phoneNumber);
    
    // If gateway successful, return the result
    if (gatewayResult.success) {
      // Update the customer in our database
      try {
        let customer = await Customer.findOne({ phoneNumber });
        if (!customer) {
          customer = new Customer({
            phoneNumber,
            name: gatewayResult.customerInfo?.name || 'New Customer',
            firstContactDate: new Date(),
            messageCount: 1
          });
        } else {
          customer.lastContactDate = new Date();
          customer.messageCount += 1;
        }
        await customer.save();
      } catch (dbError) {
        console.error('Error updating customer:', dbError);
      }
      
      return res.json(gatewayResult);
    }
    
    // If gateway failed, fall back to local AI processing
    console.log('Gateway processing failed, falling back to local AI');
    
    // Get or create customer
    let customer = await Customer.findOne({ phoneNumber });
    if (!customer) {
      customer = new Customer({
        phoneNumber,
        name: 'New Customer',
        firstContactDate: new Date(),
        messageCount: 1
      });
      await customer.save();
    } else {
      customer.lastContactDate = new Date();
      customer.messageCount += 1;
      await customer.save();
    }

    // Use local AI service as fallback
    const customerInfo = {
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      messageCount: customer.messageCount,
      isNew: customer.messageCount <= 1
    };

    const aiResponse = await aiService.analyzeMessageWithAI(message, customerInfo);
    
    res.json({
      success: true,
      message: aiResponse.response,
      analysis: aiResponse.analysis,
      processingMethod: 'local_ai_fallback',
      gateway: gatewayResult.gateway
    });
    
  } catch (error) {
    console.error('Error processing message through gateway:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get WhatsApp status through the gateway
router.get('/whatsapp-status', async (req, res) => {
  try {
    const status = await gatewayService.getWhatsappStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting WhatsApp status through gateway:', error);
    res.status(500).json({ 
      connected: false, 
      error: error.message,
      gateway: {
        configured: gatewayService.isConfigured(),
        error: error.message
      }
    });
  }
});

// Send a message through the gateway
router.post('/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }
    
    const result = await gatewayService.sendMessage(phoneNumber, message);
    
    // If message was sent successfully, update the customer
    if (result.success) {
      try {
        const customer = await Customer.findOne({ phoneNumber });
        if (customer) {
          customer.lastContactDate = new Date();
          await customer.save();
        }
      } catch (dbError) {
        console.error('Error updating customer:', dbError);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error sending message through gateway:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get detailed statistics through the gateway
router.get('/stats', async (req, res) => {
  try {
    const stats = await gatewayService.getDetailedStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats through gateway:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      gateway: gatewayService.getGatewayStats()
    });
  }
});

// Test the gateway connection
router.get('/test-connection', async (req, res) => {
  try {
    const result = await gatewayService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing gateway connection:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      gateway: gatewayService.getGatewayStats()
    });
  }
});

// Get gateway configuration status
router.get('/config', (req, res) => {
  try {
    res.json({
      configured: gatewayService.isConfigured(),
      url: gatewayService.getSafeUrl(),
      stats: gatewayService.getGatewayStats()
    });
  } catch (error) {
    console.error('Error getting gateway configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
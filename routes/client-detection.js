// routes/clients-vercel.js - Simplified clients route for Vercel
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');

// GET all clients from database only
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find()
      .sort({ lastContactDate: -1 })
      .limit(50);
    
    res.json({ 
      success: true, 
      clients: customers.map(customer => ({
        name: customer.name,
        city: customer.city,
        phoneNumber: customer.phoneNumber,
        lastContactDate: customer.lastContactDate
      }))
    });
  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST add a new client manually
router.post('/', async (req, res) => {
  try {
    const { name, city, phoneNumber, notes } = req.body;
    
    // Basic validation
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    // Create customer in database
    const customer = new Customer({
      name: name || 'New Customer',
      city: city || null,
      phoneNumber: phoneNumber,
      notes: notes || '',
      firstContactDate: new Date(),
      lastContactDate: new Date()
    });
    
    await customer.save();
    
    res.json({ 
      success: true, 
      message: 'Client added successfully', 
      client: customer 
    });
  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET test endpoint for client info extraction
router.get('/test-extraction', async (req, res) => {
  try {
    const { message } = req.query;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message parameter is required' 
      });
    }
    
    // Simplified response for Vercel
    res.json({
      success: true,
      message: 'This feature is not available in the Vercel deployment',
      note: 'For full functionality, please use the self-hosted version'
    });
  } catch (error) {
    console.error('Error testing client info extraction:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
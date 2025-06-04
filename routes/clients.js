// routes/clients.js - Fixed version with test extraction endpoint
const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/google-sheets');
const dataProcessingService = require('../services/data-processing');
const { formatPhoneNumberForDisplay, normalizeCity } = require('../services/data-utils');
const Customer = require('../models/Customer');

// Initialize Google Sheets service on startup
googleSheetsService.initGoogleSheetsClient().then((success) => {
  console.log(`Google Sheets service initialized: ${success ? 'Success' : 'Failed'}`);
});

// GET all clients from Google Sheets
router.get('/', async (req, res) => {
  try {
    const result = await googleSheetsService.getAllClients();
    
    if (result.success) {
      res.json({ success: true, clients: result.clients });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
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
    
    // Format client data
    const clientData = {
      name: name || null,
      city: city ? normalizeCity(city) : null,
      phoneNumber: formatPhoneNumberForDisplay(phoneNumber),
      notes: notes || ''
    };
    
    // Add to Google Sheets
    const result = await googleSheetsService.addClientToSheet(clientData);
    
    if (result.success) {
      // Update or create customer in MongoDB (if they exist)
      try {
        const existingCustomer = await Customer.findOne({ 
          phoneNumber: clientData.phoneNumber.replace(/\s/g, '') 
        });
        
        if (existingCustomer) {
          // Update existing customer
          existingCustomer.name = clientData.name || existingCustomer.name;
          existingCustomer.notes = clientData.notes;
          await existingCustomer.save();
        }
        
        res.json({ success: true, message: 'Client added successfully', client: clientData });
      } catch (dbError) {
        console.error('Error updating customer in database:', dbError);
        // Still return success since the Google Sheets operation was successful
        res.json({ 
          success: true, 
          message: 'Client added to Google Sheets but database update failed',
          client: clientData
        });
      }
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST process client info from WhatsApp message
router.post('/from-message', async (req, res) => {
  try {
    const { message, phoneNumber, analysis } = req.body;
    
    if (!message || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message and phoneNumber are required' 
      });
    }
    
    console.log('📨 Processing client info from message:', { message, phoneNumber });
    
    // Extract client info using the enhanced data processing service
    const extractedInfo = await dataProcessingService.extractClientInfo(
      analysis || {}, 
      message
    );
    
    if (!extractedInfo.success) {
      console.log('❌ Client info extraction failed:', extractedInfo);
      return res.json({
        success: false,
        message: 'Could not extract valid client information',
        extractedInfo
      });
    }
    
    console.log('✅ Client info extracted successfully:', extractedInfo);
    
    // Format the client data
    const clientData = dataProcessingService.formatClientInfo({
      ...extractedInfo,
      phoneNumber: phoneNumber // Use the WhatsApp number as default
    });
    
    console.log('📋 Formatted client data:', clientData);
    
    // Validate the data
    const validation = dataProcessingService.validateClientInfo(clientData);
    
    if (!validation.isValid) {
      console.log('⚠️ Client data validation failed:', validation);
      return res.json({
        success: false,
        message: 'Invalid client information',
        validation,
        extractedInfo
      });
    }
    
    console.log('✅ Client data validation passed');
    
    // Prepare data for Google Sheets
    const sheetData = {
      name: clientData.name || 'غير محدد',
      city: clientData.city || 'غير محدد',
      address: clientData.address || 'غير محدد',
      phoneNumber: clientData.phoneNumber || phoneNumber,
      pack: 'Pack Premium',
      prix: '299 MAD',
      notes: `تم استخراج البيانات تلقائياً - ${new Date().toLocaleString('ar-EG')}`
    };
    
    console.log('📊 Sending to Google Sheets:', sheetData);
    
    // Add to Google Sheets
    const result = await googleSheetsService.addClientToSheet(sheetData);
    
    if (result.success) {
      console.log('✅ Client data sent to Google Sheets successfully');
      
      // Update customer in MongoDB
      try {
        const customer = await Customer.findOne({ phoneNumber: phoneNumber.replace(/\D/g, '') });
        
        if (customer) {
          if (clientData.name) customer.name = clientData.name;
          if (clientData.city) customer.city = clientData.city;
          customer.lastContactDate = new Date();
          await customer.save();
          console.log('✅ Customer updated in MongoDB');
        }
        
        res.json({ 
          success: true, 
          message: 'Client information processed and added successfully',
          client: sheetData,
          extractedInfo: clientData
        });
      } catch (dbError) {
        console.error('Error updating customer in database:', dbError);
        res.json({ 
          success: true, 
          message: 'Client added to Google Sheets but database update failed',
          client: sheetData,
          extractedInfo: clientData
        });
      }
    } else {
      console.error('❌ Failed to send to Google Sheets:', result);
      res.status(500).json({ 
        success: false, 
        message: `Failed to save to Google Sheets: ${result.message}`,
        extractedInfo: clientData
      });
    }
  } catch (error) {
    console.error('Error processing client info from message:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET test endpoint to extract client info from a message - FIXED VERSION
router.get('/test-extraction', async (req, res) => {
  try {
    const { message } = req.query;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message parameter is required' 
      });
    }
    
    console.log('🧪 Testing extraction for message:', message);
    
    // Extract client info using the enhanced manual extraction
    const extractedInfo = await dataProcessingService.extractClientInfo({}, message);
    
    console.log('📊 Extraction result:', extractedInfo);
    
    // Format the data
    const clientData = dataProcessingService.formatClientInfo(extractedInfo);
    
    console.log('📋 Formatted data:', clientData);
    
    // Validate
    const validation = dataProcessingService.validateClientInfo(clientData);
    
    console.log('✅ Validation result:', validation);
    
    res.json({
      success: extractedInfo.success,
      extractedInfo,
      formattedData: clientData,
      validation
    });
  } catch (error) {
    console.error('Error testing client info extraction:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET test manual extraction only (for debugging)
router.get('/test-manual-extraction', async (req, res) => {
  try {
    const { message } = req.query;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message parameter is required' 
      });
    }
    
    console.log('🔧 Testing manual extraction for:', message);
    
    // Use manual extraction directly
    const manualResult = dataProcessingService.extractClientInfoManually(message);
    
    console.log('🔧 Manual extraction result:', manualResult);
    
    const formattedData = dataProcessingService.formatClientInfo(manualResult);
    const validation = dataProcessingService.validateClientInfo(formattedData);
    
    res.json({
      success: manualResult.success,
      manualResult,
      formattedData,
      validation,
      method: 'manual_only'
    });
  } catch (error) {
    console.error('Error in manual extraction test:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST run extraction tests
router.post('/run-extraction-tests', async (req, res) => {
  try {
    const testCases = [
      {
        name: 'Complete Arabic Info',
        input: 'اسمي أحمد محمد وأسكن في الدار البيضاء شارع محمد الخامس رقم 123 ورقم هاتفي 0661234567',
        expected: {
          name: 'أحمد محمد',
          city: 'الدار البيضاء',
          address: 'شارع محمد الخامس رقم 123',
          phoneNumber: '+212661234567'
        }
      },
      {
        name: 'Darija Mixed Info',
        input: 'انا سميتي فاطمة من كازا وساكنة في حي الحسان رقم التيليفون ديالي 0712345678',
        expected: {
          name: 'فاطمة',
          city: 'الدار البيضاء',
          address: 'حي الحسان',
          phoneNumber: '+212712345678'
        }
      },
      {
        name: 'French Info',
        input: 'Je m\'appelle Pierre Dubois, j\'habite à Rabat rue Hassan II et mon numéro est 0661111111',
        expected: {
          name: 'Pierre Dubois',
          city: 'الرباط',
          address: 'rue Hassan II',
          phoneNumber: '+212661111111'
        }
      },
      {
        name: 'Phone Only',
        input: 'رقمي 0622334455',
        expected: {
          name: null,
          city: null,
          address: null,
          phoneNumber: '+212622334455'
        }
      }
    ];
    
    const results = [];
    let totalTests = 0;
    let passedTests = 0;
    
    for (const testCase of testCases) {
      totalTests++;
      
      try {
        const extractedInfo = await dataProcessingService.extractClientInfo({}, testCase.input);
        const formattedData = dataProcessingService.formatClientInfo(extractedInfo);
        
        // Simple comparison
        const isCorrect = compareExtractionResults(formattedData, testCase.expected);
        
        if (isCorrect) {
          passedTests++;
        }
        
        results.push({
          name: testCase.name,
          input: testCase.input,
          expected: testCase.expected,
          actual: formattedData,
          passed: isCorrect,
          success: extractedInfo.success
        });
        
      } catch (error) {
        results.push({
          name: testCase.name,
          input: testCase.input,
          expected: testCase.expected,
          error: error.message,
          passed: false,
          success: false
        });
      }
    }
    
    res.json({
      success: true,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%'
      },
      results
    });
    
  } catch (error) {
    console.error('Error running extraction tests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to compare extraction results
function compareExtractionResults(actual, expected) {
  const fields = ['name', 'city', 'address', 'phoneNumber'];
  
  for (const field of fields) {
    const actualValue = actual[field];
    const expectedValue = expected[field];
    
    // Both null is OK
    if (actualValue === null && expectedValue === null) {
      continue;
    }
    
    // One null, one not null is a problem
    if ((actualValue === null) !== (expectedValue === null)) {
      return false;
    }
    
    // Both have values, compare them
    if (actualValue !== null && expectedValue !== null) {
      if (field === 'phoneNumber') {
        // Exact match for phone numbers
        if (actualValue !== expectedValue) {
          return false;
        }
      } else {
        // Fuzzy match for text fields (70% similarity)
        const similarity = calculateStringSimilarity(
          actualValue.toLowerCase(), 
          expectedValue.toLowerCase()
        );
        if (similarity < 0.7) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// Helper function to calculate string similarity
function calculateStringSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

module.exports = router;
// -- tests/ai-test.js -- //
require('dotenv').config();
const aiService = require('../services/ai');

// Function to test AI analysis
const testAI = async () => {
  console.log('====== AI SERVICE TEST ======');
  console.log(`Using API URL: ${process.env.AI_API_URL || 'Default URL'}`);
  console.log(`API Key configured: ${process.env.AI_API_KEY ? 'Yes' : 'No'}`);
  
  // Test messages in different languages
  const testMessages = [
    {
      language: 'French',
      message: 'Bonjour, avez-vous des smartphones en stock?'
    },
    {
      language: 'Arabic',
      message: 'مرحبا، هل لديكم هواتف ذكية متوفرة؟'
    },
    {
      language: 'French',
      message: 'Quel est le prix de votre iPhone le moins cher?'
    }
  ];
  
  // Mock customer
  const customer = {
    name: 'Test Customer',
    messageCount: 5,
    isNew: false
  };
  
  console.log('\nTesting AI response to messages:');
  console.log('--------------------------------');
  
  for (const test of testMessages) {
    console.log(`\n[Testing ${test.language} message]: "${test.message}"`);
    try {
      console.time('Response time');
      const result = await aiService.analyzeMessageWithAI(test.message, customer);
      console.timeEnd('Response time');
      
      console.log('AI Generated:', result.aiGenerated ? 'Yes ✓' : 'No (using fallback)');
      console.log('Detected language:', result.analysis.language);
      console.log('Detected intents:', Object.keys(result.analysis.intent).filter(key => result.analysis.intent[key]));
      console.log('Response:', result.response);
    } catch (error) {
      console.error('Error testing AI:', error.message);
    }
  }
  
  // Test fallback mechanism by using a wrong API key temporarily
  console.log('\n[Testing fallback mechanism]');
  console.log('--------------------------------');
  const originalApiKey = process.env.AI_API_KEY;
  try {
    // Set invalid API key to trigger fallback
    process.env.AI_API_KEY = 'invalid_key';
    
    console.time('Fallback response time');
    const result = await aiService.analyzeMessageWithAI('Comment puis-je commander?', customer);
    console.timeEnd('Fallback response time');
    
    console.log('AI Generated:', result.aiGenerated ? 'Yes' : 'No (using fallback) ✓');
    console.log('Response:', result.response);
    
    // Restore original API key
    process.env.AI_API_KEY = originalApiKey;
  } catch (error) {
    console.error('Error testing fallback:', error.message);
    // Restore original API key
    process.env.AI_API_KEY = originalApiKey;
  }
  
  console.log('\n====== AI SERVICE TEST COMPLETED ======');
};

// Run the test
testAI();
// -- tests/test_ai_integration.js -- //
require('dotenv').config();
const assert = require('assert');
const aiService = require('../services/ai');

// Comprehensive AI integration test
const testAIIntegration = async () => {
  console.log('====== COMPREHENSIVE AI INTEGRATION TEST ======');
  console.log(`API: ${process.env.AI_API_URL || 'Default URL'}`);
  console.log(`API Key configured: ${process.env.AI_API_KEY ? 'Yes' : 'No'}`);
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test function helper
  const runTest = async (name, testFn) => {
    try {
      console.log(`\n[TEST] ${name}`);
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      testsFailed++;
    }
  };
  
  // Test 1: Product Info Loading
  await runTest('Product Info Loading', async () => {
    const productInfo = await aiService.loadProductsInfo();
    assert(productInfo, 'Product info should be loaded');
    assert(typeof productInfo === 'object', 'Product info should be an object');
    // You might add more specific assertions here if your test environment has product data
  });
  
  // Test 2: Message Preprocessing
  await runTest('Message Preprocessing', async () => {
    const testCases = [
      { message: 'Bonjour', expectedLanguage: 'french', expectedIntent: 'isGreeting' },
      { message: 'صباح الخير', expectedLanguage: 'arabic', expectedIntent: 'isGreeting' },
      { message: 'Quel est le prix?', expectedLanguage: 'french', expectedIntent: 'isPriceRequest' }
    ];
    
    for (const test of testCases) {
      const preprocessed = aiService.preprocessMessage(test.message);
      assert(preprocessed.language === test.expectedLanguage, 
        `Expected language ${test.expectedLanguage} but got ${preprocessed.language}`);
      assert(preprocessed.intent[test.expectedIntent], 
        `Expected intent ${test.expectedIntent} to be true`);
    }
  });
  
  // Test 3: AI Response Generation
  await runTest('AI Response Generation', async () => {
    const customer = { name: 'Test Customer', messageCount: 5, isNew: false };
    const result = await aiService.analyzeMessageWithAI('Bonjour, comment commander?', customer);
    
    assert(result, 'Result should exist');
    assert(result.response, 'Response should exist');
    assert(result.response.length > 10, 'Response should be meaningful (>10 chars)');
    assert(typeof result.aiGenerated === 'boolean', 'aiGenerated should be a boolean');
  });
  
  // Test 4: Fallback Mechanism
  await runTest('Fallback Mechanism', async () => {
    const customer = { name: 'Test Customer', messageCount: 5, isNew: false };
    const originalApiKey = process.env.AI_API_KEY;
    
    // Temporarily set invalid API key
    process.env.AI_API_KEY = 'invalid_key_to_test_fallback';
    
    const result = await aiService.analyzeMessageWithAI('Bonjour', customer);
    
    // Restore original key
    process.env.AI_API_KEY = originalApiKey;
    
    assert(result, 'Result should exist even with invalid API key');
    assert(result.response, 'Fallback response should exist');
    assert(result.aiGenerated === false, 'aiGenerated should be false for fallback');
  });
  
  // Test 5: Response Format Consistency
  await runTest('Response Format Consistency', async () => {
    const customer = { name: 'Test Customer', messageCount: 5, isNew: false };
    const testMessages = [
      'Bonjour',
      'Comment acheter?',
      'Quel est le prix?'
    ];
    
    for (const message of testMessages) {
      const result = await aiService.analyzeMessageWithAI(message, customer);
      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.response === 'string', 'Response should be a string');
      assert(result.analysis && typeof result.analysis === 'object', 'Analysis should be an object');
      assert(typeof result.aiGenerated === 'boolean', 'aiGenerated should be a boolean');
    }
  });
  
  // Summary
  console.log('\n====== TEST SUMMARY ======');
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log(`Success rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  console.log('===========================');
};

// Run the tests
testAIIntegration();
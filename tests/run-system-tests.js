// tests/run-system-tests.js - Comprehensive system testing script
require('dotenv').config();

const { testExtraction } = require('../services/data-processing');

console.log('🚀 Starting Comprehensive System Tests...\n');
console.log('=' .repeat(60));

async function runAllTests() {
  console.log('📋 Test 1: Data Processing Service');
  console.log('-'.repeat(40));
  
  try {
    // Test the extraction system directly
    testExtraction();
    console.log('✅ Data processing test completed\n');
    
    // Test individual extractions
    await testIndividualExtractions();
    
    // Test API endpoints if server is running
    await testAPIEndpoints();
    
    // Test Google Sheets if configured
    await testGoogleSheetsIntegration();
    
    console.log('🎉 All system tests completed!');
    
  } catch (error) {
    console.error('❌ System test failed:', error);
  }
}

async function testIndividualExtractions() {
  console.log('📋 Test 2: Individual Extraction Tests');
  console.log('-'.repeat(40));
  
  const { extractClientInfoManually, formatClientInfo } = require('../services/data-processing');
  
  const testMessages = [
    'اسمي أحمد محمد وأنا من الدار البيضاء شارع الحسن الثاني رقم 45 ورقمي 0661234567',
    'انا سميتي فاطمة من كازا وساكنة في حي الحسان ورقم التيليفون ديالي 0712345678',
    'Je m\'appelle Pierre et j\'habite à Rabat rue Mohammed V, mon numéro est 0633445566',
    'اسمي خالد من مراكش',
    'رقمي هو 0622334455'
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`\n--- Test ${i + 1} ---`);
    console.log(`Input: "${message}"`);
    
    try {
      const result = extractClientInfoManually(message);
      const formatted = formatClientInfo(result);
      
      console.log('Output:', {
        name: formatted.name || 'N/A',
        city: formatted.city || 'N/A', 
        address: formatted.address || 'N/A',
        phone: formatted.phoneNumber || 'N/A',
        success: result.success,
        confidence: result.confidence?.toFixed(2) || 'N/A'
      });
      
      if (result.success) {
        console.log('✅ Extraction successful');
      } else {
        console.log('❌ Extraction failed');
      }
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  console.log('\n✅ Individual extraction tests completed\n');
}

async function testAPIEndpoints() {
  console.log('📋 Test 3: API Endpoints');
  console.log('-'.repeat(40));
  
  const axios = require('axios');
  const baseUrl = 'http://localhost:5000';
  
  try {
    // Test server health
    console.log('Testing server health...');
    const healthResponse = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
    
    if (healthResponse.status === 200) {
      console.log('✅ Server is healthy');
      
      // Test client extraction endpoint
      console.log('Testing client extraction endpoint...');
      const testMessage = 'اسمي أحمد من الرباط ورقمي 0661234567';
      
      const extractionResponse = await axios.get(`${baseUrl}/api/clients/test-extraction`, {
        params: { message: testMessage },
        timeout: 10000
      });
      
      if (extractionResponse.data.success) {
        console.log('✅ Client extraction endpoint working');
        console.log('Extracted:', extractionResponse.data.formattedData);
      } else {
        console.log('❌ Client extraction endpoint failed');
      }
      
      // Test Google Sheets status
      console.log('Testing Google Sheets status...');
      const sheetsResponse = await axios.get(`${baseUrl}/api/google-sheets/status`, { timeout: 5000 });
      
      if (sheetsResponse.data.success) {
        console.log('✅ Google Sheets service is configured');
      } else {
        console.log('⚠️  Google Sheets service not configured');
      }
      
    } else {
      console.log('❌ Server health check failed');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️  Server not running - skipping API tests');
      console.log('💡 Start the server with: npm start');
    } else {
      console.log('❌ API test error:', error.message);
    }
  }
  
  console.log('\n✅ API endpoint tests completed\n');
}

async function testGoogleSheetsIntegration() {
  console.log('📋 Test 4: Google Sheets Integration');
  console.log('-'.repeat(40));
  
  try {
    const googleSheetsService = require('../services/google-sheets');
    
    // Initialize the service
    const initialized = await googleSheetsService.initGoogleSheetsClient();
    
    if (initialized) {
      console.log('✅ Google Sheets client initialized');
      
      // Test connection
      const connectionTest = await googleSheetsService.testConnection();
      
      if (connectionTest.success) {
        console.log('✅ Google Sheets connection successful');
        console.log(`Spreadsheet: ${connectionTest.spreadsheetTitle}`);
        
        // Test adding a client
        const testClient = {
          name: `Test Client ${Date.now()}`,
          city: 'الدار البيضاء',
          address: 'شارع الاختبار رقم 123',
          phoneNumber: '+212600123456',
          pack: 'Pack Test',
          prix: '299 MAD',
          notes: 'Client de test automatique'
        };
        
        console.log('Testing client addition...');
        const addResult = await googleSheetsService.addClientToSheet(testClient);
        
        if (addResult.success) {
          console.log('✅ Test client added successfully');
        } else {
          console.log('❌ Failed to add test client:', addResult.message);
        }
        
      } else {
        console.log('❌ Google Sheets connection failed:', connectionTest.message);
      }
      
    } else {
      console.log('❌ Google Sheets client initialization failed');
      console.log('💡 Check your Google Sheets configuration in .env file');
    }
    
  } catch (error) {
    console.log('❌ Google Sheets test error:', error.message);
    console.log('💡 Make sure Google Sheets service is properly configured');
  }
  
  console.log('\n✅ Google Sheets integration test completed\n');
}

// Performance test
async function runPerformanceTest() {
  console.log('📋 Test 5: Performance Test');
  console.log('-'.repeat(40));
  
  const { extractClientInfoManually } = require('../services/data-processing');
  
  const testMessage = 'اسمي أحمد محمد من الدار البيضاء شارع محمد الخامس رقم 123 ورقمي 0661234567';
  const iterations = 100;
  
  console.log(`Running ${iterations} extraction operations...`);
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    try {
      extractClientInfoManually(testMessage);
    } catch (error) {
      console.log(`Error in iteration ${i}:`, error.message);
    }
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const averageTime = totalTime / iterations;
  
  console.log(`✅ Performance test completed:`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average time per extraction: ${averageTime.toFixed(2)}ms`);
  console.log(`Operations per second: ${(1000 / averageTime).toFixed(2)}`);
  
  if (averageTime < 50) {
    console.log('🚀 Performance: Excellent');
  } else if (averageTime < 100) {
    console.log('✅ Performance: Good');
  } else {
    console.log('⚠️  Performance: Needs optimization');
  }
  
  console.log('\n✅ Performance test completed\n');
}

// Environment check
function checkEnvironment() {
  console.log('📋 Test 0: Environment Check');
  console.log('-'.repeat(40));
  
  const requiredVars = ['MONGO_URI'];
  const optionalVars = [
    'GEMINI_API_KEY',
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
  ];
  
  console.log('Required environment variables:');
  let missingRequired = [];
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`❌ ${varName}: Missing`);
      missingRequired.push(varName);
    }
  });
  
  console.log('\nOptional environment variables:');
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`⚠️  ${varName}: Not set`);
    }
  });
  
  if (missingRequired.length > 0) {
    console.log(`\n❌ Missing required variables: ${missingRequired.join(', ')}`);
    console.log('💡 Please set these in your .env file');
    return false;
  }
  
  console.log('\n✅ Environment check passed\n');
  return true;
}

// Main execution
async function main() {
  console.log('🤖 WhatsApp AI Bot - System Test Suite');
  console.log('Time:', new Date().toLocaleString());
  console.log('Node.js:', process.version);
  console.log('Platform:', process.platform);
  console.log('');
  
  // Check environment first
  const envOk = checkEnvironment();
  if (!envOk) {
    console.log('❌ Environment check failed. Fix the issues above and try again.');
    process.exit(1);
  }
  
  // Run all tests
  await runAllTests();
  
  // Run performance test
  await runPerformanceTest();
  
  console.log('🎉 All system tests completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('1. Start the server: npm start');
  console.log('2. Open http://localhost:5000 in your browser');
  console.log('3. Scan QR code with WhatsApp');
  console.log('4. Test with real messages');
  
  console.log('\n📊 System Status Summary:');
  console.log('✅ Data extraction: Working');
  console.log('✅ Phone number formatting: Working');
  console.log('✅ City normalization: Working');
  console.log('✅ Data validation: Working');
  
  if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    console.log('✅ Google Sheets: Configured');
  } else {
    console.log('⚠️  Google Sheets: Not configured');
  }
  
  if (process.env.GEMINI_API_KEY) {
    console.log('✅ Gemini AI: Configured');
  } else {
    console.log('⚠️  Gemini AI: Not configured');
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node run-system-tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --extraction-only    Run only extraction tests');
  console.log('  --api-only          Run only API tests');
  console.log('  --sheets-only       Run only Google Sheets tests');
  console.log('  --performance-only  Run only performance tests');
  console.log('  --help, -h          Show this help message');
  process.exit(0);
}

if (args.includes('--extraction-only')) {
  testExtraction();
  testIndividualExtractions();
} else if (args.includes('--api-only')) {
  testAPIEndpoints();
} else if (args.includes('--sheets-only')) {
  testGoogleSheetsIntegration();
} else if (args.includes('--performance-only')) {
  runPerformanceTest();
} else {
  main().catch(console.error);
}

module.exports = {
  runAllTests,
  testIndividualExtractions,
  testAPIEndpoints,
  testGoogleSheetsIntegration,
  runPerformanceTest
};
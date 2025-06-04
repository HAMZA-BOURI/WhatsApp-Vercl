// tests/test-client-extraction.js - Fixed test for client info extraction
require('dotenv').config();
const { extractClientInfoManually, formatClientInfo, validateClientInfo } = require('../services/data-processing');

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
    name: 'Partial Info',
    input: 'اسمي خالد من مراكش',
    expected: {
      name: 'خالد',
      city: 'مراكش',
      address: null,
      phoneNumber: null
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

async function runExtractionTests() {
  console.log('🧪 Running Client Info Extraction Tests...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of testCases) {
    totalTests++;
    console.log(`--- Test: ${testCase.name} ---`);
    console.log(`Input: "${testCase.input}"`);
    
    try {
      // Extract info manually (since AI might not be working)
      const rawResult = extractClientInfoManually(testCase.input);
      const formattedResult = formatClientInfo(rawResult);
      const validation = validateClientInfo(formattedResult);
      
      console.log('Extracted:', {
        name: formattedResult.name,
        city: formattedResult.city,
        address: formattedResult.address,
        phoneNumber: formattedResult.phoneNumber,
        success: rawResult.success,
        confidence: rawResult.confidence?.toFixed(2)
      });
      
      console.log('Expected:', testCase.expected);
      
      // Compare results
      const isCorrect = compareResults(formattedResult, testCase.expected);
      
      if (isCorrect) {
        console.log('✅ PASSED\n');
        passedTests++;
      } else {
        console.log('❌ FAILED\n');
        failedTests++;
      }
            
      console.log('Validation:', validation);
      console.log('---\n');
      
    } catch (error) {
      console.log('❌ ERROR:', error.message);
      failedTests++;
      console.log('---\n');
    }
  }
  
  console.log(`📊 Test Results:`);
  console.log(`Total: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! The extraction system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. The extraction patterns need improvement.');
    
    console.log('\n💡 Recommendations:');
    console.log('• Check name extraction patterns for Arabic and French');
    console.log('• Improve city detection for different spellings');
    console.log('• Enhance address extraction logic');
    console.log('• Test with more real-world examples');
  }
}

function compareResults(actual, expected) {
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
      console.log(`❌ Field '${field}': Expected ${expectedValue}, got ${actualValue}`);
      return false;
    }
    
    // Both have values, compare them
    if (actualValue !== null && expectedValue !== null) {
      if (field === 'phoneNumber') {
        // Exact match for phone numbers
        if (actualValue !== expectedValue) {
          console.log(`❌ Field '${field}': Expected ${expectedValue}, got ${actualValue}`);
          return false;
        }
      } else {
        // Fuzzy match for text fields
        const similarity = calculateSimilarity(actualValue.toLowerCase(), expectedValue.toLowerCase());
        if (similarity < 0.7) {
          console.log(`❌ Field '${field}': Expected ${expectedValue}, got ${actualValue} (similarity: ${similarity.toFixed(2)})`);
          return false;
        }
      }
    }
  }
  
  return true;
}

function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

function editDistance(str1, str2) {
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

// Run tests if called directly
if (require.main === module) {
  runExtractionTests().catch(console.error);
}

module.exports = {
  runExtractionTests,
  testCases
};
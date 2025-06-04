// services/google-sheets.js - Updated version with new table structure
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configure Google Sheets credentials
let googleSheetsClient = null;
let spreadsheetId = null;
let isInitialized = false;

/**
 * Initialize Google Sheets client with improved error handling
 * @returns {Promise<boolean>} Success status
 */
const initGoogleSheetsClient = async () => {
  try {
    console.log('🔧 Initializing Google Sheets client...');
    
    // Load credentials from environment variables
    spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      console.error('❌ Missing GOOGLE_SHEETS_SPREADSHEET_ID in environment variables');
      console.log('ℹ️  Please set GOOGLE_SHEETS_SPREADSHEET_ID in your .env file');
      return false;
    }
    
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    
    if (!serviceAccountEmail || !serviceAccountKey) {
      console.error('❌ Missing Google Service Account credentials in environment variables');
      console.log('ℹ️  Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in your .env file');
      return false;
    }
    
    // Clean and format the private key
    const cleanedPrivateKey = serviceAccountKey.replace(/\\n/g, '\n');
    
    const credentials = {
      client_email: serviceAccountEmail,
      private_key: cleanedPrivateKey,
    };
    
    // Validate private key format
    if (!cleanedPrivateKey.includes('BEGIN PRIVATE KEY')) {
      console.error('❌ Invalid private key format. Make sure it includes the full key with headers.');
      return false;
    }
    
    console.log('✅ Service account email:', serviceAccountEmail);
    console.log('✅ Spreadsheet ID:', spreadsheetId);
    console.log('✅ Private key format: Valid');
    
    // Create JWT client
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    // Test authentication
    console.log('🔐 Testing authentication...');
    await auth.authorize();
    console.log('✅ Authentication successful');
    
    // Create Google Sheets client
    googleSheetsClient = google.sheets({ version: 'v4', auth });
    
    // Test access to the spreadsheet
    console.log('📊 Testing spreadsheet access...');
    await testSpreadsheetAccess();
    
    isInitialized = true;
    console.log('✅ Google Sheets client initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Google Sheets client:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('💡 Possible solutions:');
      console.log('   1. Check that your service account email is correct');
      console.log('   2. Ensure the private key is properly formatted');
      console.log('   3. Verify that the service account has access to the spreadsheet');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Network connectivity issue. Check your internet connection.');
    }
    
    return false;
  }
};

/**
 * Test access to the spreadsheet
 */
const testSpreadsheetAccess = async () => {
  try {
    const response = await googleSheetsClient.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });
    
    console.log(`✅ Spreadsheet access confirmed: "${response.data.properties.title}"`);
    
    // Check if "Clients" sheet exists, create if not
    const sheets = response.data.sheets;
    const clientsSheet = sheets.find(sheet => sheet.properties.title === 'Clients');
    
    if (!clientsSheet) {
      console.log('📋 Creating "Clients" sheet...');
      await createClientsSheet();
    } else {
      console.log('✅ "Clients" sheet exists');
      // Update headers to new format if needed
      await updateSheetHeaders();
    }
    
  } catch (error) {
    if (error.code === 403) {
      console.error('❌ Access denied to spreadsheet. Please ensure:');
      console.log('   1. The service account email has been granted access to the spreadsheet');
      console.log('   2. The spreadsheet ID is correct');
      throw error;
    } else if (error.code === 404) {
      console.error('❌ Spreadsheet not found. Please check the GOOGLE_SHEETS_SPREADSHEET_ID');
      throw error;
    } else {
      throw error;
    }
  }
};

/**
 * Create the Clients sheet with updated headers
 */
const createClientsSheet = async () => {
  try {
    // Add the sheet
    await googleSheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: 'Clients'
            }
          }
        }]
      }
    });
    
    // Add headers with new structure: Name, City, Address, Phone, Pack, Prix, Timestamp
    await googleSheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: 'Clients!A1:G1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Name', 'City', 'Address', 'Phone', 'Pack', 'Prix', 'Timestamp']]
      }
    });
    
    console.log('✅ "Clients" sheet created with updated headers');
  } catch (error) {
    console.error('❌ Error creating Clients sheet:', error);
    throw error;
  }
};

/**
 * Update existing sheet headers if needed
 */
const updateSheetHeaders = async () => {
  try {
    // Get current headers
    const response = await googleSheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Clients!A1:G1'
    });
    
    const currentHeaders = response.data.values ? response.data.values[0] : [];
    const expectedHeaders = ['Name', 'City', 'Address', 'Phone', 'Pack', 'Prix', 'Timestamp'];
    
    // Check if headers need updating
    const headersMatch = expectedHeaders.every((header, index) => currentHeaders[index] === header);
    
    if (!headersMatch) {
      console.log('📋 Updating sheet headers to new format...');
      await googleSheetsClient.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Clients!A1:G1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [expectedHeaders]
        }
      });
      console.log('✅ Sheet headers updated');
    }
  } catch (error) {
    console.warn('⚠️  Could not update headers:', error.message);
    // Don't throw error as this is not critical
  }
};

/**
 * Add client information to Google Sheets with new structure
 * @param {Object} clientData Client information object
 * @returns {Promise<Object>} Result with success status and message
 */
const addClientToSheet = async (clientData) => {
  try {
    console.log('📊 Attempting to add client to Google Sheets:', {
      name: clientData.name || 'N/A',
      city: clientData.city || 'N/A',
      address: clientData.address || 'N/A',
      phoneNumber: clientData.phoneNumber || 'N/A',
      pack: clientData.pack || 'N/A',
      prix: clientData.prix || 'N/A'
    });
    
    // Initialize if not already done
    if (!isInitialized || !googleSheetsClient || !spreadsheetId) {
      console.log('🔧 Google Sheets not initialized, attempting initialization...');
      const initialized = await initGoogleSheetsClient();
      if (!initialized) {
        return { 
          success: false, 
          message: 'Failed to initialize Google Sheets client' 
        };
      }
    }
    
    // Validate required data
    if (!clientData.phoneNumber) {
      return {
        success: false,
        message: 'Phone number is required'
      };
    }
    
    // Check for duplicates to avoid adding the same client multiple times
    try {
      const existingClients = await googleSheetsClient.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Clients!D:D' // Phone column (D)
      });
      
      if (existingClients.data.values) {
        const phoneNumbers = existingClients.data.values.flat();
        if (phoneNumbers.includes(clientData.phoneNumber)) {
          console.log(`⚠️  Client with phone ${clientData.phoneNumber} already exists`);
          return {
            success: false,
            message: 'Client with this phone number already exists',
            duplicate: true
          };
        }
      }
    } catch (duplicateCheckError) {
      console.warn('⚠️  Could not check for duplicates:', duplicateCheckError.message);
      // Continue with adding - it's better to have duplicates than to fail completely
    }
    
    // Prepare the row data with new structure
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Row structure: Name, City, Address, Phone, Pack, Prix, Timestamp
    const row = [
      clientData.name || 'غير محدد',           // A: Name
      clientData.city || 'غير محدد',           // B: City  
      clientData.address || 'غير محدد',        // C: Address
      clientData.phoneNumber || '',            // D: Phone
      clientData.pack || 'غير محدد',           // E: Pack
      clientData.prix || 'غير محدد',           // F: Prix
      timestamp                                // G: Timestamp
    ];
    
    console.log('📝 Adding row to Google Sheets:', row);
    
    // Add the data to the sheet
    const response = await googleSheetsClient.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'Clients!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row]
      }
    });
    
    console.log('✅ Successfully added client to Google Sheets');
    console.log(`📊 Range updated: ${response.data.updates.updatedRange}`);
    
    return {
      success: true,
      message: 'Client added to Google Sheets successfully',
      details: {
        range: response.data.updates.updatedRange,
        updatedRows: response.data.updates.updatedRows,
        updatedColumns: response.data.updates.updatedColumns,
        updatedCells: response.data.updates.updatedCells
      }
    };
  } catch (error) {
    console.error('❌ Error adding client to Google Sheets:', error);
    
    // Provide more specific error messages
    let errorMessage = `Error adding client to Google Sheets: ${error.message}`;
    
    if (error.code === 403) {
      errorMessage = 'Access denied to Google Sheets. Please check service account permissions.';
    } else if (error.code === 404) {
      errorMessage = 'Spreadsheet or sheet not found. Please verify the spreadsheet ID and sheet name.';
    } else if (error.code === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (error.message.includes('PERMISSION_DENIED')) {
      errorMessage = 'Permission denied. Please ensure the service account has edit access to the spreadsheet.';
    }
    
    return {
      success: false,
      message: errorMessage,
      errorCode: error.code,
      errorDetails: error.message
    };
  }
};

/**
 * Get all clients from the Google Sheet with improved error handling
 * @returns {Promise<Object>} Result with success status and data
 */
const getAllClients = async () => {
  try {
    // Initialize if not already done
    if (!isInitialized || !googleSheetsClient || !spreadsheetId) {
      console.log('🔧 Google Sheets not initialized, attempting initialization...');
      const initialized = await initGoogleSheetsClient();
      if (!initialized) {
        return { 
          success: false, 
          message: 'Failed to initialize Google Sheets client' 
        };
      }
    }
    
    console.log('📊 Getting all clients from Google Sheets...');
    
    // Get data from the sheet (updated range for new structure)
    const response = await googleSheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Clients!A:G'
    });
    
    const rows = response.data.values || [];
    console.log(`📊 Retrieved ${rows.length} rows from Google Sheets`);
    
    if (rows.length === 0) {
      return {
        success: true,
        clients: [],
        message: 'No clients found in the spreadsheet'
      };
    }
    
    // Skip header row if present and map to objects
    const hasHeaders = rows.length > 0 && 
      (rows[0][0] === 'Name' || rows[0][0] === 'name' || rows[0][0] === 'الاسم');
    
    const dataRows = hasHeaders ? rows.slice(1) : rows;
    
    // Map to new structure: Name, City, Address, Phone, Pack, Prix, Timestamp
    const clients = dataRows.map((row, index) => ({
      id: index + 1,
      name: row[0] || '',           // A: Name
      city: row[1] || '',           // B: City
      address: row[2] || '',        // C: Address
      phoneNumber: row[3] || '',    // D: Phone
      pack: row[4] || '',           // E: Pack
      prix: row[5] || '',           // F: Prix
      timestamp: row[6] || ''       // G: Timestamp
    })).filter(client => client.phoneNumber); // Filter out rows without phone numbers
    
    console.log(`✅ Successfully processed ${clients.length} clients`);
    
    return {
      success: true,
      clients,
      total: clients.length,
      message: `Retrieved ${clients.length} clients successfully`
    };
  } catch (error) {
    console.error('❌ Error getting clients from Google Sheets:', error);
    
    let errorMessage = `Error getting clients from Google Sheets: ${error.message}`;
    
    if (error.code === 403) {
      errorMessage = 'Access denied to Google Sheets. Please check service account permissions.';
    } else if (error.code === 404) {
      errorMessage = 'Spreadsheet or sheet not found. Please verify the spreadsheet ID.';
    }
    
    return {
      success: false,
      message: errorMessage,
      clients: []
    };
  }
};

/**
 * Get Google Sheets service status
 * @returns {Object} Service status information
 */
const getServiceStatus = () => {
  return {
    initialized: isInitialized,
    hasClient: !!googleSheetsClient,
    hasSpreadsheetId: !!spreadsheetId,
    config: {
      spreadsheetId: spreadsheetId ? `${spreadsheetId.substring(0, 10)}...` : 'Not set',
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 
        `${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.substring(0, 20)}...` : 'Not set'
    }
  };
};

/**
 * Test the connection to Google Sheets
 * @returns {Promise<Object>} Test result
 */
const testConnection = async () => {
  try {
    console.log('🧪 Testing Google Sheets connection...');
    
    const initialized = await initGoogleSheetsClient();
    if (!initialized) {
      return {
        success: false,
        message: 'Failed to initialize Google Sheets client'
      };
    }
    
    // Test by getting spreadsheet info
    const response = await googleSheetsClient.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });
    
    return {
      success: true,
      message: 'Google Sheets connection successful',
      spreadsheetTitle: response.data.properties.title,
      sheetsCount: response.data.sheets.length,
      headers: ['Name', 'City', 'Address', 'Phone', 'Pack', 'Prix', 'Timestamp']
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`,
      errorCode: error.code
    };
  }
};

module.exports = {
  initGoogleSheetsClient,
  addClientToSheet,
  getAllClients,
  getServiceStatus,
  testConnection
};
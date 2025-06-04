// vercel-build.js - Build script for Vercel deployment
const fs = require('fs');
const path = require('path');

console.log('🚀 Running Vercel build script...');

// Create required directories
const dirs = [
  'public/media/images',
  'public/media/videos',
  'public/media/audio',
  'public/uploads',
  'public/uploads/products',
  'public/uploads/categories',
  'config',
  '.wwebjs_auth', // Empty directory for compatibility
  'logs',
  'reports',
  'exports'
];

// Create each directory
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`ℹ️ Directory already exists: ${dir}`);
  }
});

// Create default welcome message if not exists
const welcomeMessagePath = path.join(__dirname, 'config/welcome-message.json');
if (!fs.existsSync(welcomeMessagePath)) {
  const defaultMessage = {
    message: `🌟 أهلاً وسهلاً بك!

مرحباً بك في عالم المنتجات الطبيعية عالية الجودة ✨
🌿 منتجات طبيعية 100%
🚚 توصيل سريع وآمن
💎 جودة مضمونة

كيف يمكنني مساعدتك اليوم؟`
  };

  fs.writeFileSync(
    welcomeMessagePath,
    JSON.stringify(defaultMessage, null, 2)
  );
  console.log('✅ Created default welcome message');
}

// Create a .env.local file for Vercel if not exists
const envLocalPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envLocalPath)) {
  const envContent = `# Local environment variables for Vercel
# This file is used for local development with 'vercel dev'
# For production, set these variables in the Vercel dashboard

# Required variables
MONGO_URI=${process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp-bot'}
NODE_ENV=development

# AI Integration
GEMINI_API_KEY=${process.env.GEMINI_API_KEY || ''}
GEMINI_API_URL=${process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'}

# Gateway configuration for connecting to self-hosted WhatsApp service
WHATSAPP_API_URL=${process.env.WHATSAPP_API_URL || ''}
WHATSAPP_API_KEY=${process.env.WHATSAPP_API_KEY || ''}

# Google Sheets Integration (Optional)
GOOGLE_SHEETS_SPREADSHEET_ID=${process.env.GOOGLE_SHEETS_SPREADSHEET_ID || ''}
GOOGLE_SERVICE_ACCOUNT_EMAIL=${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''}
`;

  fs.writeFileSync(envLocalPath, envContent);
  console.log('✅ Created .env.local file for local development');
}

// Create serverless.js link to vercel.js if not exists
const serverlessPath = path.join(__dirname, 'serverless.js');
if (!fs.existsSync(serverlessPath)) {
  fs.copyFileSync(
    path.join(__dirname, 'vercel.js'),
    serverlessPath
  );
  console.log('✅ Created serverless.js entry point');
}

// Log success message
console.log('✅ Vercel build setup completed successfully!');
console.log('📝 Note: WhatsApp connection requires a separate self-hosted server');
console.log('🔗 Configure WHATSAPP_API_URL in Vercel to connect to your server');

// Exit with success
process.exit(0);
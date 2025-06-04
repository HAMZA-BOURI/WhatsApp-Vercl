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
  '.wwebjs_auth' // Empty directory for compatibility
];

// Create directories if they don't exist
dirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Create empty welcome-message.json if it doesn't exist
const welcomeMessagePath = path.join(process.cwd(), 'config/welcome-message.json');
if (!fs.existsSync(welcomeMessagePath)) {
  console.log('Creating default welcome message config');
  fs.writeFileSync(
    welcomeMessagePath,
    JSON.stringify({ 
      message: "🌟 أهلاً وسهلاً بك! مرحباً بك في عالم المنتجات الطبيعية عالية الجودة ✨" 
    }, null, 2)
  );
}

console.log('✅ Vercel build script completed successfully');
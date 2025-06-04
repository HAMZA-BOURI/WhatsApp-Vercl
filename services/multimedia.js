// -- services/multimedia.js -- //
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

// Base directories for different media types
const MEDIA_BASE_DIR = path.join(__dirname, '../public/media');
const WELCOME_IMAGES_DIR = path.join(MEDIA_BASE_DIR, 'images');
const WELCOME_VIDEOS_DIR = path.join(MEDIA_BASE_DIR, 'videos');
const WELCOME_AUDIO_DIR = path.join(MEDIA_BASE_DIR, 'audio');

// Ensure directories exist
const ensureDirectoriesExist = () => {
  [MEDIA_BASE_DIR, WELCOME_IMAGES_DIR, WELCOME_VIDEOS_DIR, WELCOME_AUDIO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Directory created: ${dir}`);
    }
  });
};

// Initialize media directories
const initMediaDirectories = () => {
  try {
    ensureDirectoriesExist();
    console.log('Media directories initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing media directories:', error);
    return false;
  }
};

// Get media files by type
const getMediaFiles = async (type) => {
  try {
    let dir;
    let validExtensions;
    
    switch (type) {
      case 'images':
        dir = WELCOME_IMAGES_DIR;
        validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        break;
      case 'videos':
        dir = WELCOME_VIDEOS_DIR;
        validExtensions = ['.mp4', '.3gp', '.avi', '.mov', '.mkv'];
        break;
      case 'audio':
        dir = WELCOME_AUDIO_DIR;
        validExtensions = ['.mp3', '.ogg', '.m4a', '.wav'];
        break;
      default:
        throw new Error(`Invalid media type: ${type}`);
    }
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(dir);
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return validExtensions.includes(ext);
    });
  } catch (error) {
    console.error(`Error getting ${type} files:`, error);
    return [];
  }
};

// Create MessageMedia object from file
const createMessageMedia = (type, filename) => {
  try {
    let filePath;
    
    switch (type) {
      case 'images':
        filePath = path.join(WELCOME_IMAGES_DIR, filename);
        break;
      case 'videos':
        filePath = path.join(WELCOME_VIDEOS_DIR, filename);
        break;
      case 'audio':
        filePath = path.join(WELCOME_AUDIO_DIR, filename);
        break;
      default:
        throw new Error(`Invalid media type: ${type}`);
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    return MessageMedia.fromFilePath(filePath);
  } catch (error) {
    console.error(`Error creating MessageMedia for ${type} ${filename}:`, error);
    return null;
  }
};

// Delete media file
const deleteMediaFile = async (type, filename) => {
  try {
    let filePath;
    
    switch (type) {
      case 'images':
        filePath = path.join(WELCOME_IMAGES_DIR, filename);
        break;
      case 'videos':
        filePath = path.join(WELCOME_VIDEOS_DIR, filename);
        break;
      case 'audio':
        filePath = path.join(WELCOME_AUDIO_DIR, filename);
        break;
      default:
        throw new Error(`Invalid media type: ${type}`);
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting ${type} file ${filename}:`, error);
    return false;
  }
};

// Get file path by type and filename
const getFilePath = (type, filename) => {
  switch (type) {
    case 'images':
      return path.join(WELCOME_IMAGES_DIR, filename);
    case 'videos':
      return path.join(WELCOME_VIDEOS_DIR, filename);
    case 'audio':
      return path.join(WELCOME_AUDIO_DIR, filename);
    default:
      throw new Error(`Invalid media type: ${type}`);
  }
};

module.exports = {
  initMediaDirectories,
  getMediaFiles,
  createMessageMedia,
  deleteMediaFile,
  getFilePath,
  WELCOME_IMAGES_DIR,
  WELCOME_VIDEOS_DIR,
  WELCOME_AUDIO_DIR
};

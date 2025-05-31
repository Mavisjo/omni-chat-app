const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const path = require('path');

app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from 'public' folder FIRST
app.use(express.static(path.join(__dirname, 'public')));

// Debug: Log all route registrations - FIXED
const originalUse = app.use;
app.use = function(path, ...middleware) {
  if (typeof path === 'string') {
    console.log('🔍 Registering route/middleware:', path);
  } else {
    console.log('🔍 Registering middleware');
    // If path is actually middleware, shift arguments
    middleware.unshift(path);
    path = '/';
  }
  return originalUse.call(this, path, ...middleware);
};

const originalGet = app.get;
app.get = function(path, ...handlers) {
  console.log('🔍 Registering GET route:', path);
  return originalGet.call(this, path, ...handlers);
};

const originalPost = app.post;
app.post = function(path, ...handlers) {
  console.log('🔍 Registering POST route:', path);
  return originalPost.call(this, path, ...handlers);
};

// API Routes - Load one by one to isolate the issue
try {
  console.log('📂 Loading WhatsApp routes...');
  app.use('/whatsapp', require('./routes/whatsapp'));
  console.log('✅ WhatsApp routes loaded');
} catch (error) {
  console.error('❌ Error loading WhatsApp routes:', error.message);
}

try {
  console.log('📂 Loading Facebook routes...');
  app.use('/facebook', require('./routes/facebook'));
  console.log('✅ Facebook routes loaded');
} catch (error) {
  console.error('❌ Error loading Facebook routes:', error.message);
}

try {
  console.log('📂 Loading Email routes...');
  app.use('/email', require('./routes/email'));
  console.log('✅ Email routes loaded');
} catch (error) {
  console.error('❌ Error loading Email routes:', error.message);
}

// API status route (fallback)
try {
  console.log('📂 Adding API status route...');
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'success',
      message: '🌐 Omni Chat API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });
  console.log('✅ API status route added');
} catch (error) {
  console.error('❌ Error adding API status route:', error.message);
}

// Health check endpoint
try {
  console.log('📂 Adding health check route...');
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
  });
  console.log('✅ Health check route added');
} catch (error) {
  console.error('❌ Error adding health check route:', error.message);
}

// Catch-all route for SPA - FIXED
try {
  console.log('📂 Adding catch-all route...');
  
  // Use a more specific pattern to avoid conflicts
  app.get('/*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/whatsapp/') || 
        req.path.startsWith('/facebook/') || 
        req.path.startsWith('/email/') ||
        req.path.startsWith('/health')) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.path
      });
    }

    // Serve frontend for non-API routes
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        // Fallback response if no frontend
        res.status(200).json({
          message: '🌐 Omni Chat API is running',
          status: 'success',
          note: 'No frontend configured - API only mode',
          endpoints: {
            status: '/api/status',
            health: '/health',
            whatsapp: '/whatsapp/*',
            facebook: '/facebook/*',
            email: '/email/*'
          }
        });
      }
    });
  });
  
  console.log('✅ Catch-all route added');
} catch (error) {
  console.error('❌ Error adding catch-all route:', error.message);
}

console.log('🏁 App configuration complete');

module.exports = app;
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pla-web' });
});

// Proxy API to backend
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL, changeOrigin: true, timeout: 30000,
  onError: (err, req, res) => { res.status(502).json({ error: 'Backend unavailable' }); }
}));

// Proxy WebSocket
app.use('/socket.io', createProxyMiddleware({
  target: BACKEND_URL, changeOrigin: true, ws: true,
}));

// Serve React build
app.use(express.static(path.join(__dirname, 'build'), { maxAge: '1d' }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PLA Frontend on port ${PORT} → proxying to ${BACKEND_URL}`);
});

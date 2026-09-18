const helmet = require('helmet');

const cspDirectives = {
  defaultSrc: ["'self'"],
  // 'wasm-unsafe-eval' (not the broader 'unsafe-eval') is required for
  // Simplicity Local — WebLLM compiles/instantiates WebAssembly modules for
  // in-browser model inference, which the WASM-specific CSP source covers
  // without opening up arbitrary eval() the way 'unsafe-eval' would.
  scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://unpkg.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https://github.com', 'https://release-assets.githubusercontent.com'],
  mediaSrc: ["'self'", 'https://github.com', 'https://release-assets.githubusercontent.com'],
  // Simplicity Local's model files (weights + WASM libs) are fetched
  // through /api/model-cache/* on our own origin — the server fetches from
  // Hugging Face/GitHub once and disk-caches the result, so the browser
  // never needs a direct connection to those external hosts.
  connectSrc: ["'self'", 'https://unpkg.com'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
};

if (process.env.NODE_ENV !== 'production') {
  cspDirectives.upgradeInsecureRequests = null;
}

const securityHeaders = helmet({
  contentSecurityPolicy: { directives: cspDirectives },
  hsts: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
});

function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.secure || req.get('x-forwarded-proto') === 'https') return next();
  return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
}

module.exports = { securityHeaders, enforceHttps };

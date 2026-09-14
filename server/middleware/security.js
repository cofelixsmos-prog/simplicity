const helmet = require('helmet');

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https://github.com'],
  connectSrc: ["'self'"],
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

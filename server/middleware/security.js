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
  imgSrc: ["'self'", 'data:', 'https://github.com'],
  mediaSrc: ["'self'", 'https://github.com', 'https://release-assets.githubusercontent.com'],
  // huggingface.co serves model metadata/config; the actual weight-shard
  // binaries redirect to Hugging Face's CDN (observed: us.aws.cdn.hf.co,
  // confirmed via a real resolve request — HF's Xet-backed storage layer,
  // subdomain may vary by region/file, hence the wildcard rather than one
  // hardcoded host). raw.githubusercontent.com serves the compiled WASM
  // model libraries WebLLM pairs with each model (see @mlc-ai/web-llm's
  // modelLibURLPrefix). All are required for any local-model download to
  // complete — without them the browser blocks the fetch outright.
  connectSrc: ["'self'", 'https://unpkg.com', 'https://huggingface.co', 'https://*.hf.co', 'https://*.cdn.hf.co', 'https://raw.githubusercontent.com'],
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

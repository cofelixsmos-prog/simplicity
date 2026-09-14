const PROTECTED_PAGES = new Set(['/chat.html', '/chat']);
const GUEST_ONLY_PAGES = new Set([
  '/login.html', '/login',
  '/register.html', '/register',
]);

function pageGuard(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const isProtected = PROTECTED_PAGES.has(req.path);
  const isGuestOnly = GUEST_ONLY_PAGES.has(req.path);
  if (!isProtected && !isGuestOnly) return next();

  if (isProtected && !req.user) {
    return res.redirect(302, '/login.html');
  }
  if (isGuestOnly && req.user) {
    return res.redirect(302, '/chat.html');
  }
  next();
}

module.exports = pageGuard;

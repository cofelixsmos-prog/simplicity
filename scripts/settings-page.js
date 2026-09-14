(function () {
  var usernameInput = document.getElementById('settings-username');
  var avatarEl = document.getElementById('settings-avatar');
  var themeToggle = document.getElementById('settings-theme-toggle');
  var logoutBtn = document.getElementById('settings-logout');
  if (!usernameInput) return;

  function writeThemeCookie(value) {
    if (window.simplicitySetThemeCookie) window.simplicitySetThemeCookie(value);
  }

  fetch('/api/auth/me')
    .then(function (response) {
      if (!response.ok) throw new Error('Not authenticated');
      return response.json();
    })
    .then(function (data) {
      usernameInput.value = data.username;
      if (avatarEl) avatarEl.textContent = data.username.charAt(0).toUpperCase();
    })
    .catch(function () {
      window.location.href = '/login.html';
    });

  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
    themeToggle.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      themeToggle.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
      writeThemeCookie(next);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST' }).then(function () {
        window.location.href = '/login.html';
      });
    });
  }

  var navItems = document.querySelectorAll('.settings-nav-item');
  var navItemById = {};
  navItems.forEach(function (item) {
    var id = item.getAttribute('href').slice(1);
    navItemById[id] = item;
    item.addEventListener('click', function () {
      navItems.forEach(function (i) { i.classList.remove('is-active'); });
      item.classList.add('is-active');
    });
  });

  var sections = document.querySelectorAll('.settings-section');
  if (sections.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var item = navItemById[entry.target.id];
        if (!item) return;
        navItems.forEach(function (i) { i.classList.remove('is-active'); });
        item.classList.add('is-active');
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });
  }
})();

(function () {
  var sections = [
    ['nav', 'sections/nav.html'],
    ['hero', 'sections/hero.html'],
    ['works', 'sections/works.html'],
    ['faq', 'sections/faq.html'],
    ['footer', 'sections/footer.html'],
    ['cookie-banner', 'sections/cookie-banner.html'],
    ['cookie-modal', 'sections/cookie-modal.html']
  ];

  function loadSection(path) {
    return fetch(path)
      .then(function (response) {
        if (!response.ok) throw new Error('Could not load ' + path);
        return response.text();
      });
  }

  function insertSections(markup) {
    markup.forEach(function (html) {
      var template = document.createElement('template');
      template.innerHTML = html.trim();
      document.body.appendChild(template.content);
    });
  }

  function loadScript(path) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = path;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Could not load ' + path)); };
      document.body.appendChild(script);
    });
  }

  function writeThemeCookie(value) {
    var consentMatch = document.cookie.match(/(?:^|; )simplicity-consent=([^;]*)/);
    var consent = consentMatch ? decodeURIComponent(consentMatch[1]) : null;
    try {
      if (sessionStorage.getItem('simplicity-consent') === 'rejected') return;
    } catch (error) {
      // Continue with the cookie check if session storage is unavailable.
    }
    if (consent === 'rejected') return;
    var date = new Date();
    date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = 'simplicity-theme=' + encodeURIComponent(value) + '; expires=' + date.toUTCString() + '; path=/; SameSite=Lax';
  }

  function setupThemeToggle() {
    var buttons = document.querySelectorAll('#theme-toggle, #mobile-theme-toggle');
    if (!buttons.length) return;
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
      button.addEventListener('click', function () {
        var root = document.documentElement;
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        buttons.forEach(function (item) { item.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false'); });
        writeThemeCookie(next);
      });
    });
  }

  function setupNavDropdowns() {
    var dropdowns = document.querySelectorAll('.nav-dropdown');
    if (!dropdowns.length) return;

    function setOpen(dropdown, isOpen) {
      var trigger = dropdown.querySelector('.nav-dropdown-trigger');
      var panel = dropdown.querySelector('.nav-dropdown-panel');
      dropdown.classList.toggle('is-open', isOpen);
      trigger.setAttribute('aria-expanded', String(isOpen));
      panel.setAttribute('aria-hidden', String(!isOpen));
    }

    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector('.nav-dropdown-trigger');
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        var isOpen = dropdown.classList.contains('is-open');
        dropdowns.forEach(function (item) { setOpen(item, false); });
        setOpen(dropdown, !isOpen);
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          setOpen(dropdown, false);
          trigger.focus();
        }
      });
    });

    document.addEventListener('click', function (event) {
      dropdowns.forEach(function (dropdown) {
        if (!dropdown.contains(event.target)) setOpen(dropdown, false);
      });
    });
  }

  function setupSettingsDropdown() {
    var wrap = document.getElementById('settings-dropdown');
    var toggle = document.getElementById('settings-toggle');
    if (!wrap || !toggle) return;

    function setOpen(isOpen) {
      wrap.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(!wrap.classList.contains('is-open'));
    });
    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function setupMobileMenu() {
    var toggle = document.getElementById('mobile-menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (!toggle || !menu) return;

    function setOpen(isOpen) {
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
      menu.setAttribute('aria-hidden', String(!isOpen));
      menu.classList.toggle('is-open', isOpen);
      if (isOpen) {
        var firstLink = menu.querySelector('a');
        if (firstLink) firstLink.focus();
      } else {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function setupFaq() {
    var items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    function close(item) {
      var answer = item.querySelector('.faq-answer');
      item.classList.remove('is-open');
      item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      answer.style.maxHeight = '0px';
    }

    function open(item) {
      var answer = item.querySelector('.faq-answer');
      item.classList.add('is-open');
      item.querySelector('.faq-question').setAttribute('aria-expanded', 'true');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }

    items.forEach(function (item) {
      var answer = item.querySelector('.faq-answer');
      answer.style.maxHeight = '0px';
      item.querySelector('.faq-question').addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        items.forEach(close);
        if (!isOpen) open(item);
      });
    });
  }

  function setupReveal() {
    var elements = document.querySelectorAll('.reveal-on-scroll');
    if (!('IntersectionObserver' in window)) {
      elements.forEach(function (element) { element.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    elements.forEach(function (element) { observer.observe(element); });
  }

  function safe(fn) {
    try { fn(); } catch (error) { console.error(error); }
  }

  Promise.all(sections.map(function (section) {
    return loadSection(section[1]);
  }))
    .then(function (markup) {
      insertSections(markup);
      safe(setupThemeToggle);
      safe(setupNavDropdowns);
      safe(setupMobileMenu);
      safe(setupSettingsDropdown);
      safe(setupFaq);
      safe(setupReveal);
      loadScript('scripts/wordmark.js').catch(function (error) { console.error(error); });
      loadScript('scripts/pixel-field.js').catch(function (error) { console.error(error); });
      loadScript('scripts/footer-wordmark.js').catch(function (error) { console.error(error); });
      loadScript('scripts/consent.js').catch(function (error) { console.error(error); });
      return loadScript('https://unpkg.com/lenis@1/dist/lenis.min.js')
        .then(function () {
          return loadScript('scripts/lenis-init.js');
        })
        .catch(function (error) {
          console.error(error);
        });
    })
    .catch(function (error) {
      console.error(error);
    });
})();

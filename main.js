(function () {
  var sections = [
    ['nav', 'sections/nav.html'],
    ['hero', 'sections/hero.html'],
    ['works', 'sections/works.html'],
    ['faq', 'sections/faq.html'],
    ['footer', 'sections/footer.html']
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

  function setupThemeToggle() {
    var buttons = document.querySelectorAll('#theme-toggle, #mobile-theme-toggle');
    if (!buttons.length) return;
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('simplicity-theme', next);
      });
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
      safe(setupMobileMenu);
      safe(setupFaq);
      safe(setupReveal);
      loadScript('scripts/wordmark.js').catch(function (error) { console.error(error); });
      loadScript('scripts/pixel-field.js').catch(function (error) { console.error(error); });
      loadScript('scripts/footer-wordmark.js').catch(function (error) { console.error(error); });
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

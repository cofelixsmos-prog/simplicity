(function () {
  var sections = [
    ['nav', 'sections/nav.html'],
    ['hero', 'sections/hero.html'],
    ['works', 'sections/works.html'],
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
    var button = document.getElementById('theme-toggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('simplicity-theme', next);
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

  Promise.all(sections.map(function (section) {
    return loadSection(section[1]);
  }))
    .then(function (markup) {
      insertSections(markup);
      setupThemeToggle();
      setupReveal();
      return loadScript('https://unpkg.com/lenis@1/dist/lenis.min.js')
        .then(function () {
          return Promise.all([
            loadScript('scripts/wordmark.js'),
            loadScript('scripts/pixel-field.js'),
            loadScript('scripts/lenis-init.js')
          ]);
        });
    })
    .catch(function (error) {
      console.error(error);
    });
})();

(function () {
  var GLYPHS = {
    A: [
      '.111.',
      '1...1',
      '1...1',
      '11111',
      '1...1',
      '1...1',
      '1...1'
    ],
    B: [
      '1111.',
      '1...1',
      '1...1',
      '1111.',
      '1...1',
      '1...1',
      '1111.'
    ],
    C: [
      '.1111',
      '1....',
      '1....',
      '1....',
      '1....',
      '1....',
      '.1111'
    ],
    D: [
      '1111.',
      '1...1',
      '1...1',
      '1...1',
      '1...1',
      '1...1',
      '1111.'
    ],
    E: [
      '11111',
      '1....',
      '1....',
      '1111.',
      '1....',
      '1....',
      '11111'
    ],
    F: [
      '11111',
      '1....',
      '1....',
      '1111.',
      '1....',
      '1....',
      '1....'
    ]
  };

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function buildGrid(svg, letter) {
    var ns = 'http://www.w3.org/2000/svg';
    var rows = GLYPHS[letter];
    var cell = 16;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        if (rows[y][x] !== '1') continue;
        var c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', x * cell + cell / 2);
        c.setAttribute('cy', y * cell + cell / 2);
        c.setAttribute('r', 0);
        c.setAttribute('class', 'brand-loader-dot');
        svg.appendChild(c);
        (function (el) {
          requestAnimationFrame(function () {
            el.setAttribute('r', cell * 0.32);
          });
        })(c);
      }
    }
  }

  function run() {
    var overlay = document.getElementById('brand-loader');
    var svg = document.getElementById('brand-loader-grid');
    if (!overlay || !svg) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      overlay.remove();
      return;
    }

    document.documentElement.classList.add('is-loading');

    var i = 0;
    buildGrid(svg, LETTERS[0]);
    var interval = setInterval(function () {
      i++;
      if (i >= LETTERS.length) {
        clearInterval(interval);
        setTimeout(function () {
          overlay.classList.add('is-hidden');
          document.documentElement.classList.remove('is-loading');
          setTimeout(function () { overlay.remove(); }, 400);
        }, 320);
        return;
      }
      buildGrid(svg, LETTERS[i]);
    }, 260);
  }

  run();
})();

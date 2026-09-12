(function () {
  var GLYPHS = {
    H: [
      '1...1',
      '1...1',
      '1...1',
      '11111',
      '1...1',
      '1...1',
      '1...1'
    ],
    A: [
      '.111.',
      '1...1',
      '1...1',
      '11111',
      '1...1',
      '1...1',
      '1...1'
    ],
    R: [
      '1111.',
      '1...1',
      '1...1',
      '1111.',
      '1..1.',
      '1...1',
      '1...1'
    ],
    N: [
      '1...1',
      '11..1',
      '1.1.1',
      '1..11',
      '1...1',
      '1...1',
      '1...1'
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
    S: [
      '.1111',
      '1....',
      '1....',
      '.111.',
      '....1',
      '....1',
      '1111.'
    ]
  };

  var LETTERS = ['H', 'A', 'R', 'N', 'E', 'S', 'S'];

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
        c.setAttribute('class', 'harness-loader-dot');
        svg.appendChild(c);
        (function (el) {
          requestAnimationFrame(function () {
            el.setAttribute('r', cell * 0.32);
          });
        })(c);
      }
    }
  }

  function reveal() {
    var video = document.getElementById('harness-video');
    var left = document.getElementById('harness-word-left');
    var right = document.getElementById('harness-word-right');
    if (video) video.classList.add('is-visible');
    if (left) left.classList.add('is-visible');
    if (right) right.classList.add('is-visible');
  }

  function run() {
    var overlay = document.getElementById('harness-loader');
    var svg = document.getElementById('harness-loader-grid');
    if (!overlay || !svg) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      overlay.remove();
      reveal();
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
          reveal();
          setTimeout(function () { overlay.remove(); }, 600);
        }, 260);
        return;
      }
      buildGrid(svg, LETTERS[i]);
    }, 220);
  }

  run();
})();

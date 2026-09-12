(function () {
  var DIGITS = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '001', '001', '001'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111']
  };

  function buildNumber(svg, value) {
    var ns = 'http://www.w3.org/2000/svg';
    var digits = String(value).split('');
    var cell = 9;
    var gapCols = 1;
    var digitCols = 3;
    var totalCols = digits.length * digitCols + (digits.length - 1) * gapCols;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    digits.forEach(function (digit, di) {
      var rows = DIGITS[digit];
      if (!rows) return;
      var xOffset = di * (digitCols + gapCols);
      for (var y = 0; y < rows.length; y++) {
        for (var x = 0; x < rows[y].length; x++) {
          if (rows[y][x] !== '1') continue;
          var c = document.createElementNS(ns, 'circle');
          c.setAttribute('cx', (xOffset + x) * cell + cell / 2);
          c.setAttribute('cy', y * cell + cell / 2);
          c.setAttribute('r', cell * 0.34);
          svg.appendChild(c);
        }
      }
    });

    svg.setAttribute('viewBox', '0 0 ' + (totalCols * cell) + ' ' + (5 * cell));
  }

  function init() {
    var nodes = document.querySelectorAll('[data-dot-number]');
    nodes.forEach(function (svg) {
      buildNumber(svg, svg.getAttribute('data-dot-number'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

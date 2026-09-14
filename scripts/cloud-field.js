(function () {
  var CELL = 12;
  var HOLE_CHANCE = 0.22;

  function mountedColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--fg-muted').trim() || '#6B6A63';
  }

  function bgColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F3F1EC';
  }

  function makeColony(cols, rows) {
    var seedX = Math.floor(Math.random() * cols);
    var seedY = Math.floor(Math.random() * rows);
    var maxCells = 5 + Math.floor(Math.random() * 5);
    return {
      cells: [{ x: seedX, y: seedY, hole: false }],
      frontier: [{ x: seedX, y: seedY }],
      maxCells: maxCells,
      growEvery: 35 + Math.floor(Math.random() * 25),
      frame: -Math.floor(Math.random() * 240),
      state: 'growing',
      holdFrames: 180 + Math.floor(Math.random() * 120),
      holdCount: 0
    };
  }

  function growColony(c, cols, rows) {
    if (c.cells.length >= c.maxCells || c.frontier.length === 0) {
      c.state = 'holding';
      return;
    }
    var base = c.frontier[Math.floor(Math.random() * c.frontier.length)];
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    var d = dirs[Math.floor(Math.random() * dirs.length)];
    var nx = base.x + d[0], ny = base.y + d[1];
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
    var exists = c.cells.some(function (cell) { return cell.x === nx && cell.y === ny; });
    if (!exists) {
      var isHole = Math.random() < HOLE_CHANCE;
      c.cells.push({ x: nx, y: ny, hole: isHole });
      c.frontier.push({ x: nx, y: ny });
    }
    if (c.cells.length >= c.maxCells) c.state = 'holding';
  }

  function initCloudField(canvas, density) {
    var ctx = canvas.getContext('2d');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W, H, cols, rows;
    var colonies = [];

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      W = canvas.width = rect.width;
      H = canvas.height = rect.height;
      cols = Math.max(1, Math.ceil(W / CELL));
      rows = Math.max(1, Math.ceil(H / CELL));
    }

    function seedColonies() {
      colonies = [];
      var count = Math.max(2, Math.round((W * H) / 90000 * density));
      for (var i = 0; i < count; i++) colonies.push(makeColony(cols, rows));
    }

    function drawCell(cell) {
      var px = cell.x * CELL, py = cell.y * CELL;
      ctx.fillStyle = mountedColor();
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px, py, CELL, CELL);
      if (cell.hole) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = bgColor();
        var r = CELL * 0.3;
        ctx.beginPath();
        ctx.arc(px + CELL / 2, py + CELL / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function step() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < colonies.length; i++) {
        var c = colonies[i];
        c.frame++;
        if (c.frame < 0) continue;
        if (c.state === 'growing') {
          if (c.frame % c.growEvery === 0) growColony(c, cols, rows);
        } else if (c.state === 'holding') {
          c.holdCount++;
          if (c.holdCount > c.holdFrames) c.state = 'dead';
        }
        if (c.state !== 'dead') {
          for (var j = 0; j < c.cells.length; j++) drawCell(c.cells[j]);
        } else {
          colonies[i] = makeColony(cols, rows);
        }
      }
      if (!reduced) requestAnimationFrame(step);
    }

    resize();
    seedColonies();
    window.addEventListener('resize', function () {
      resize();
      seedColonies();
    });

    if (reduced) {
      colonies.forEach(function (c) {
        while (c.state === 'growing') growColony(c, cols, rows);
        c.cells.forEach(drawCell);
      });
    } else {
      step();
    }
  }

  function init() {
    var fields = document.querySelectorAll('.works-cloud-field, .footer-cloud-field');
    fields.forEach(function (canvas) {
      initCloudField(canvas, 1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

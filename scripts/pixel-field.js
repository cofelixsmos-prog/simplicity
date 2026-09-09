    // ---------- Background pixel colonies (growth = "processing") ----------
    (function () {
      var canvas = document.getElementById('pixel-field');
      var ctx = canvas.getContext('2d');
      var hero = document.querySelector('.hero');
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var W, H;
      var protectedRect;
      var CELL = 12;
      var COLOR = '#FF5A1F';

      function resize() {
        var rect = hero.getBoundingClientRect();
        W = canvas.width = rect.width;
        H = canvas.height = rect.height;
        var content = document.querySelector('.hero-grid').getBoundingClientRect();
        protectedRect = {
          left: content.left - rect.left - CELL,
          top: content.top - rect.top - CELL,
          right: content.right - rect.left + CELL,
          bottom: content.bottom - rect.top + CELL
        };
      }
      resize();
      window.addEventListener('resize', resize);

      function isProtected(x, y) {
        return protectedRect && x * CELL < protectedRect.right &&
          (x + 1) * CELL > protectedRect.left &&
          y * CELL < protectedRect.bottom &&
          (y + 1) * CELL > protectedRect.top;
      }

      function makeColony() {
        var seedX, seedY;
        do {
          seedX = Math.floor(Math.random() * (W / CELL));
          seedY = Math.floor(Math.random() * (H / CELL));
        } while (isProtected(seedX, seedY));
        var maxCells = 4 + Math.floor(Math.random() * 3);
        return {
          cells: [{ x: seedX, y: seedY, hole: false }],
          frontier: [{ x: seedX, y: seedY }],
          maxCells: maxCells,
          growEvery: 30 + Math.floor(Math.random() * 20),
          frame: 0,
          state: 'growing',
          holdFrames: 150 + Math.floor(Math.random() * 90),
          holdCount: 0
        };
      }

      function growColony(c) {
        if (c.cells.length >= c.maxCells || c.frontier.length === 0) {
          c.state = 'holding';
          return;
        }
        var base = c.frontier[Math.floor(Math.random() * c.frontier.length)];
        var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        var d = dirs[Math.floor(Math.random() * dirs.length)];
        var nx = base.x + d[0], ny = base.y + d[1];
        var exists = c.cells.some(function (cell) { return cell.x === nx && cell.y === ny; });
        if (!exists) {
          var isHole = Math.random() < 0.22;
          c.cells.push({ x: nx, y: ny, hole: isHole });
          c.frontier.push({ x: nx, y: ny });
        }
        if (c.cells.length >= c.maxCells) c.state = 'holding';
      }

      var colonies = [];
      var maxColonies = 6;
      for (var i = 0; i < maxColonies; i++) {
        var c = makeColony();
        c.frame = -Math.floor(Math.random() * 200);
        colonies.push(c);
      }

      function drawCell(cell) {
        if (isProtected(cell.x, cell.y)) return;
        var px = cell.x * CELL, py = cell.y * CELL;
        ctx.fillStyle = COLOR;
        ctx.fillRect(px, py, CELL, CELL);
        if (cell.hole) {
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F3F1EC';
          var r = CELL * 0.28;
          ctx.beginPath();
          ctx.arc(px + CELL / 2, py + CELL / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function step() {
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < colonies.length; i++) {
          var c = colonies[i];
          c.frame++;
          if (c.frame < 0) continue;
          if (c.state === 'growing') {
            if (c.frame % c.growEvery === 0) growColony(c);
          } else if (c.state === 'holding') {
            c.holdCount++;
            if (c.holdCount > c.holdFrames) c.state = 'dead';
          }
          if (c.state !== 'dead') {
            for (var j = 0; j < c.cells.length; j++) drawCell(c.cells[j]);
          } else {
            colonies[i] = makeColony();
          }
        }
        if (!reduced) requestAnimationFrame(step);
      }

      if (reduced) {
        colonies.forEach(function (c) {
          while (c.state === 'growing') growColony(c);
          c.cells.forEach(drawCell);
        });
      } else {
        step();
      }
    })();

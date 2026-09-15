(function () {
  var CELL = 12;
  var HOLE_CHANCE = 0.22;

  function mountedColor() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--fg-muted')
      .trim() || '#6B6A63';
  }

  function bgColor() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--bg')
      .trim() || '#F3F1EC';
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

  function growColony(c, cols, rows, blocked) {
    if (c.cells.length >= c.maxCells || c.frontier.length === 0) {
      c.state = 'holding';
      return;
    }

    var base = c.frontier[Math.floor(Math.random() * c.frontier.length)];
    var dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    var d = dirs[Math.floor(Math.random() * dirs.length)];

    var nx = base.x + d[0];
    var ny = base.y + d[1];

    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
      return;
    }

    if (blocked(nx, ny)) {
      return;
    }

    var exists = c.cells.some(function (cell) {
      return cell.x === nx && cell.y === ny;
    });

    if (!exists) {
      c.cells.push({
        x: nx,
        y: ny,
        hole: Math.random() < HOLE_CHANCE
      });

      c.frontier.push({
        x: nx,
        y: ny
      });
    }

    if (c.cells.length >= c.maxCells) {
      c.state = 'holding';
    }
  }

  function initCloudField(canvas, density) {
    var ctx = canvas.getContext('2d');

    var reduced = window
      .matchMedia('(prefers-reduced-motion: reduce)')
      .matches;

    var W;
    var H;
    var cols;
    var rows;

    var colonies = [];
    var blockedCells = new Set();

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();

      W = canvas.width = rect.width;
      H = canvas.height = rect.height;

      cols = Math.max(1, Math.ceil(W / CELL));
      rows = Math.max(1, Math.ceil(H / CELL));

      calculateBlockedCells();
    }

    /*
     * Detect actual visible content instead of using
     * the element's entire bounding box.
     */
    function calculateBlockedCells() {
  blockedCells.clear();

  var canvasRect = canvas.getBoundingClientRect();

  function addRect(rect) {
    var left = Math.max(
      0,
      Math.floor((rect.left - canvasRect.left) / CELL)
    );

    var right = Math.min(
      cols - 1,
      Math.floor((rect.right - canvasRect.left - 1) / CELL)
    );

    var top = Math.max(
      0,
      Math.floor((rect.top - canvasRect.top) / CELL)
    );

    var bottom = Math.min(
      rows - 1,
      Math.floor((rect.bottom - canvasRect.top - 1) / CELL)
    );

    if (
      right < 0 ||
      bottom < 0 ||
      left >= cols ||
      top >= rows
    ) {
      return;
    }

    for (var y = top; y <= bottom; y++) {
      for (var x = left; x <= right; x++) {
        blockedCells.add(x + ',' + y);
      }
    }
  }

  function isVisible(el) {
    if (!el || el === canvas) {
      return false;
    }

    if (canvas.contains(el)) {
      return false;
    }

    var style = getComputedStyle(el);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0
    );
  }

  /*
   * 1. Block actual text geometry.
   */
  function scanText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue.trim()) {
        return;
      }

      var parent = node.parentElement;

      if (!isVisible(parent)) {
        return;
      }

      /*
       * Use a Range for the text node.
       * getClientRects() gives us the actual
       * rendered line rectangles.
       */
      var range = document.createRange();

      try {
        range.selectNodeContents(node);

        var rects = range.getClientRects();

        for (var i = 0; i < rects.length; i++) {
          if (
            rects[i].width > 0 &&
            rects[i].height > 0
          ) {
            addRect(rects[i]);
          }
        }
      } catch (e) {
        // Ignore invalid/detached text nodes.
      }

      range.detach();
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node === canvas || canvas.contains(node)) {
      return;
    }

    if (!isVisible(node)) {
      return;
    }

    for (var i = 0; i < node.childNodes.length; i++) {
      scanText(node.childNodes[i]);
    }
  }

  /*
   * Scan the page/parent for real text.
   */
  scanText(document.body);

  /*
   * 2. Block actual interactive/visual elements.
   *
   * This catches buttons, cards, images, inputs, etc.
   * but doesn't use their huge parent boxes.
   */
  var elements = document.querySelectorAll(
    'a, button, input, textarea, select, img, video, svg, [role="button"]'
  );

  elements.forEach(function (el) {
    if (!isVisible(el)) {
      return;
    }

    var rect = el.getBoundingClientRect();

    if (
      rect.width > 0 &&
      rect.height > 0
    ) {
      addRect(rect);
    }
  });
}

    function isBlocked(x, y) {
      return blockedCells.has(x + ',' + y);
    }

    function seedColonies() {
      colonies = [];

      var count = Math.max(
        2,
        Math.round((W * H) / 90000 * density)
      );

      for (var i = 0; i < count; i++) {
        var colony = null;

        /*
         * Try multiple positions until we find one
         * that isn't occupied by real content.
         */
        for (var attempt = 0; attempt < 30; attempt++) {
          var candidate = makeColony(cols, rows);

          if (
            !isBlocked(
              candidate.cells[0].x,
              candidate.cells[0].y
            )
          ) {
            colony = candidate;
            break;
          }
        }

        if (colony) {
          colonies.push(colony);
        }
      }
    }

    function drawCell(cell) {
      /*
       * Final safety check. Even if a cell somehow becomes
       * blocked after the colony was created, don't draw it.
       */
      if (isBlocked(cell.x, cell.y)) {
        return;
      }

      var px = cell.x * CELL;
      var py = cell.y * CELL;

      ctx.fillStyle = mountedColor();
      ctx.globalAlpha = 0.5;

      ctx.fillRect(
        px,
        py,
        CELL,
        CELL
      );

      if (cell.hole) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = bgColor();

        var r = CELL * 0.3;

        ctx.beginPath();

        ctx.arc(
          px + CELL / 2,
          py + CELL / 2,
          r,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    function step() {
      ctx.clearRect(
        0,
        0,
        W,
        H
      );

      for (var i = 0; i < colonies.length; i++) {
        var c = colonies[i];

        c.frame++;

        if (c.frame < 0) {
          continue;
        }

        if (c.state === 'growing') {
          if (c.frame % c.growEvery === 0) {
            growColony(
              c,
              cols,
              rows,
              isBlocked
            );
          }
        } else if (c.state === 'holding') {
          c.holdCount++;

          if (c.holdCount > c.holdFrames) {
            c.state = 'dead';
          }
        }

        if (c.state !== 'dead') {
          for (var j = 0; j < c.cells.length; j++) {
            drawCell(c.cells[j]);
          }
        } else {
          /*
           * Start a fresh colony.
           */
          var replacement = null;

          for (var attempt = 0; attempt < 30; attempt++) {
            var candidate = makeColony(cols, rows);

            if (
              !isBlocked(
                candidate.cells[0].x,
                candidate.cells[0].y
              )
            ) {
              replacement = candidate;
              break;
            }
          }

          if (replacement) {
            colonies[i] = replacement;
          } else {
            colonies[i] = makeColony(cols, rows);
          }
        }
      }

      if (!reduced) {
        requestAnimationFrame(step);
      }
    }

    resize();
    seedColonies();

    window.addEventListener('resize', function () {
      resize();
      seedColonies();
    });

    if (reduced) {
      colonies.forEach(function (c) {
        var safety = 0;

        while (
          c.state === 'growing' &&
          safety < 1000
        ) {
          growColony(
            c,
            cols,
            rows,
            isBlocked
          );

          safety++;
        }

        c.cells.forEach(drawCell);
      });
    } else {
      step();
    }
  }

  function init() {
    var fields = document.querySelectorAll(
      '.works-cloud-field, .footer-cloud-field'
    );

    fields.forEach(function (canvas) {
      initCloudField(canvas, 1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }
})();
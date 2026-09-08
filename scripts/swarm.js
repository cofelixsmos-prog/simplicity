    // ---------- Render one continuous field: sparse and large on the left (2 agents), dense and small on the right (80 agents) ----------
    (function () {
      var svg = document.getElementById('swarm-continuous');
      if (!svg) return;
      var ns = 'http://www.w3.org/2000/svg';
      var W = 1320, H = 320;

      // Two isolated, larger dots on the left edge
      [ [110, 140, 13], [190, 190, 13] ].forEach(function (p) {
        var c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', p[0]);
        c.setAttribute('cy', p[1]);
        c.setAttribute('r', p[2]);
        var anim = document.createElementNS(ns, 'animate');
        anim.setAttribute('attributeName', 'cy');
        anim.setAttribute('values', p[1] + ';' + (p[1] - 14) + ';' + p[1]);
        anim.setAttribute('dur', '3.4s');
        anim.setAttribute('repeatCount', 'indefinite');
        c.appendChild(anim);
        svg.appendChild(c);
      });

      // A field of 80 small dots, density increasing left to right
      var count = 80;
      for (var i = 0; i < count; i++) {
        var t = i / (count - 1); // 0 -> 1 across the width
        // bias x toward the right so density visibly increases
        var x = 480 + Math.pow(t, 0.6) * (W - 520);
        var y = 30 + Math.random() * (H - 60);
        var r = 2.6 + Math.random() * 2.2;
        var c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', x.toFixed(1));
        c.setAttribute('cy', y.toFixed(1));
        c.setAttribute('r', r.toFixed(1));
        c.setAttribute('opacity', (0.45 + Math.random() * 0.5).toFixed(2));

        var anim = document.createElementNS(ns, 'animate');
        anim.setAttribute('attributeName', 'cy');
        var drift = 5 + Math.random() * 9;
        anim.setAttribute('values', y.toFixed(1) + ';' + (y - drift).toFixed(1) + ';' + y.toFixed(1));
        anim.setAttribute('dur', (2.2 + Math.random() * 2.6).toFixed(1) + 's');
        anim.setAttribute('repeatCount', 'indefinite');
        c.appendChild(anim);

        svg.appendChild(c);
      }
    })();

(function () {
  var section = document.getElementById('harness-hero');
  var video = document.getElementById('harness-video');
  var heroText = document.getElementById('harness-hero-text');
  var scrim = document.getElementById('harness-hero-scrim');
  var copy = document.getElementById('harness-reveal-copy');
  if (!section || !video || !heroText || !copy) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var START_SCALE = 1.6;
  var END_SCALE = 1;
  var ticking = false;

  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var trackHeight = rect.height - window.innerHeight;
    if (trackHeight <= 0) return;

    var progress = -rect.top / trackHeight;
    progress = Math.min(1, Math.max(0, progress));

    var scale = START_SCALE - (START_SCALE - END_SCALE) * progress;
    video.style.transform = 'scale(' + scale.toFixed(3) + ')';

    var heroOpacity = 1 - Math.min(1, progress / 0.25);
    heroText.style.opacity = String(heroOpacity);

    var copyProgress = Math.min(1, Math.max(0, (progress - 0.45) / 0.35));
    copy.style.opacity = String(copyProgress);
    copy.style.transform = 'translateY(' + (18 * (1 - copyProgress)).toFixed(1) + 'px)';

    if (scrim) {
      var scrimStrength = 0.35 + 0.4 * progress;
      scrim.style.background = 'radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,' + scrimStrength.toFixed(2) + ') 100%)';
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
})();

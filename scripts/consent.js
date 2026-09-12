(function () {
  var CONSENT_COOKIE = 'simplicity-consent';
  var THEME_COOKIE = 'simplicity-theme';
  var COOKIE_DAYS = 365;

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
  }

  function getConsent() {
    return getCookie(CONSENT_COOKIE);
  }

  function setConsent(value) {
    setCookie(CONSENT_COOKIE, value, COOKIE_DAYS);
    if (value === 'rejected') {
      deleteCookie(THEME_COOKIE);
    }
  }

  // simplicitySetThemeCookie is already defined inline in <head> on every
  // page (before paint) so the theme toggle works even if this script
  // hasn't loaded yet. Fall back to defining it here only if that's missing.
  if (!window.simplicitySetThemeCookie) {
    window.simplicitySetThemeCookie = function (theme) {
      if (getConsent() === 'rejected') return;
      setCookie(THEME_COOKIE, theme, COOKIE_DAYS);
    };
  }

  window.simplicityGetConsent = getConsent;
  window.simplicitySetConsent = setConsent;
  window.simplicityGetCookie = getCookie;
  window.simplicityDeleteCookie = deleteCookie;
  document.dispatchEvent(new CustomEvent('simplicity:consent-ready'));

  function setupBanner() {
    if (getConsent()) return;
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    banner.classList.add('is-visible');

    var acceptBtn = document.getElementById('cookie-accept');
    var rejectBtn = document.getElementById('cookie-reject');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        setConsent('accepted');
        var theme = document.documentElement.getAttribute('data-theme');
        if (theme) window.simplicitySetThemeCookie(theme);
        banner.classList.remove('is-visible');
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener('click', function () {
        setConsent('rejected');
        banner.classList.remove('is-visible');
      });
    }
  }

  function setupModal() {
    var overlay = document.getElementById('cookie-modal-overlay');
    if (!overlay) return;

    var openBtns = document.querySelectorAll('#cookie-open, #mobile-cookie-open, #cookie-banner-settings, #footer-cookie-open');
    var closeBtn = document.getElementById('cookie-modal-close');
    var toggle = document.getElementById('preference-toggle');
    var status = document.getElementById('cookie-status');
    var saveBtn = document.getElementById('cookie-save');
    var banner = document.getElementById('cookie-banner');

    function refresh() {
      if (!toggle || !status) return;
      var consent = getConsent();
      if (consent === 'accepted') {
        toggle.checked = true;
        status.textContent = 'Preference cookies are currently allowed.';
      } else if (consent === 'rejected') {
        toggle.checked = false;
        status.textContent = 'Preference cookies are currently blocked. Only essential cookies are stored.';
      } else {
        toggle.checked = false;
        status.textContent = "You haven't made a choice yet — preference cookies are blocked by default.";
      }
    }

    function open(event) {
      if (event) event.preventDefault();
      refresh();
      overlay.classList.add('is-visible');
      var settingsDropdown = document.getElementById('settings-dropdown');
      var settingsToggle = document.getElementById('settings-toggle');
      if (settingsDropdown) settingsDropdown.classList.remove('is-open');
      if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'false');
    }

    function close() {
      overlay.classList.remove('is-visible');
    }

    openBtns.forEach(function (btn) {
      btn.addEventListener('click', open);
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var next = toggle.checked ? 'accepted' : 'rejected';
        setConsent(next);
        if (next === 'accepted') {
          var theme = document.documentElement.getAttribute('data-theme');
          if (theme) window.simplicitySetThemeCookie(theme);
        }
        if (banner) banner.classList.remove('is-visible');
        refresh();
        close();
      });
    }
  }

  function init() {
    setupBanner();
    setupModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

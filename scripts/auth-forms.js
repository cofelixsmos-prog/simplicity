(function () {
  function showError(errorEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function hideError(errorEl) {
    errorEl.hidden = true;
  }

  function submitAuthForm(endpoint) {
    return function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var errorEl = document.getElementById('auth-error');
      var submitBtn = form.querySelector('button[type="submit"]');

      hideError(errorEl);
      submitBtn.disabled = true;

      var payload = {
        username: form.username.value.trim(),
        password: form.password.value,
      };

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showError(errorEl, result.data.error || 'Something went wrong. Please try again.');
            submitBtn.disabled = false;
            return;
          }
          window.location.href = '/chat.html';
        })
        .catch(function () {
          showError(errorEl, 'Could not reach the server. Please try again.');
          submitBtn.disabled = false;
        });
    };
  }

  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', submitAuthForm('/api/auth/login'));
  }

  var registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', submitAuthForm('/api/auth/register'));
  }
})();

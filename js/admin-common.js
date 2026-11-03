(function () {
  function trackLogout(page) {
    if (window.ME_ANALYTICS && ME_ANALYTICS.track) {
      ME_ANALYTICS.track("admin_logout", { page: page || "admin" });
    }
  }

  function logout(options) {
    options = options || {};
    if (!window.ME_APP) return;
    ME_APP.clearAdminKey();
    ME_APP.stopSessionIdleMonitoring();
    trackLogout(options.page);
    if (typeof options.onLogout === "function") {
      options.onLogout();
      return;
    }
    window.location.href = options.redirect || "admin.html";
  }

  function bindLogoutButton(buttonId, options) {
    var btn = document.getElementById(buttonId || "btn-logout");
    if (!btn) return;
    btn.addEventListener("click", function () {
      logout(options);
    });
  }

  window.ME_ADMIN = {
    logout: logout,
    bindLogoutButton: bindLogoutButton,
  };
})();

(function () {
  function handle401() {
    ME_APP.clearAdminKey();
    var destino = window.location.pathname.split("/").pop() + window.location.search;
    window.location.replace("admin.html?destino=" + encodeURIComponent(destino));
  }

  function boot() {
    return ME_APP.requireAdminKey();
  }

  window.ME_ADMIN_PAGE = {
    boot: boot,
    handle401: handle401,
    getKey: function () {
      return ME_APP.getAdminKey();
    },
  };
})();

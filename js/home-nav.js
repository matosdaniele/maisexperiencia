(function () {
  function initHomeNav() {
    var toggle = document.getElementById("site-nav-toggle");
    var navPanel = document.getElementById("site-nav-panel");
    if (!toggle || !navPanel) return;

    toggle.addEventListener("click", function () {
      var open = navPanel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    navPanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navPanel.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeNav);
  } else {
    initHomeNav();
  }
})();

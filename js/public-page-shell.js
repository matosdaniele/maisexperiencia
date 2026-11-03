(function () {
  function basePrefix() {
    return /\/legal\//.test(window.location.pathname) ? "../" : "";
  }

  function ensureMainId() {
    var main = document.querySelector("main");
    if (main && !main.id) {
      main.id = "conteudo-principal";
    }
  }

  function ensureSkipLink() {
    if (document.querySelector(".skip-link")) return;
    var link = document.createElement("a");
    link.className = "skip-link";
    link.href = "#conteudo-principal";
    link.textContent = "Ir para o conteúdo";
    document.body.insertBefore(link, document.body.firstChild);
  }

  function ensurePublicBrand() {
    if (document.getElementById("site-home-nav") || document.getElementById("app-shell-header")) {
      return;
    }
    var nav = document.createElement("nav");
    nav.id = "site-home-nav";
    nav.className = "site-home-nav";
    nav.setAttribute("aria-label", "Marca Mais Experiência");
    nav.innerHTML =
      '<div class="site-home-nav-inner">' +
      window.ME_SITE_BRAND.buildLink(basePrefix() + "index.html") +
      "</div>";
    document.body.insertBefore(nav, document.body.firstChild);
  }

  function ensurePublicFooter() {
    if (document.getElementById("app-shell-footer") || document.getElementById("public-page-footer")) {
      return;
    }
    var p = basePrefix();
    var year = new Date().getFullYear();
    var footer = document.createElement("footer");
    footer.id = "public-page-footer";
    footer.className = "app-shell-footer public-page-footer";
    footer.innerHTML =
      '<div class="app-shell-footer-inner">' +
      '<a href="mailto:contato@maisexperiencia.com.br">contato@maisexperiencia.com.br</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      '<a href="' + p + 'legal/index.html">Documentos legais</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      '<a href="' + p + 'legal/politica-de-privacidade.html">Privacidade</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      '<a href="' + p + 'legal/termos-de-uso.html">Termos</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      "<span>Porto Alegre — Rio Grande do Sul</span>" +
      "</div>" +
      '<p class="app-shell-footer-copy">&copy; ' +
      year +
      " Mais Experiência</p>";
    document.body.appendChild(footer);
  }

  function initPublicPageShell() {
    ensureMainId();
    ensureSkipLink();
    ensurePublicBrand();
    ensurePublicFooter();
  }

  window.ME_PUBLIC_SHELL = {
    init: initPublicPageShell,
  };

  initPublicPageShell();
})();

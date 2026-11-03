(function () {
  function assetPrefix() {
    return /\/legal\//.test(window.location.pathname) ? "../" : "";
  }

  function buildSiteBrandLink(href) {
    href = href || "index.html";
    return (
      '<a class="brand" href="' +
      href +
      '" aria-label="Mais Experiência — página inicial">' +
      '<span class="brand-logo-wrap" aria-hidden="true">' +
      '<img class="brand-logo" src="' +
      assetPrefix() +
      'logo.png" width="80" height="80" alt="" decoding="async" fetchpriority="high">' +
      "</span>" +
      '<span class="brand-text">' +
      '<span class="brand-name">Mais Experiência</span>' +
      '<span class="brand-tagline">Onde experiência encontra novas oportunidades</span>' +
      "</span></a>"
    );
  }

  window.ME_SITE_BRAND = {
    buildLink: buildSiteBrandLink,
  };
})();

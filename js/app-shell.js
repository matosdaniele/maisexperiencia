(function () {
  var ZONES = {
    "50": {
      label: "Área 50+",
      hub: "area_50.html",
      bannerImage: "img/50_inicio_1.jpg",
      bannerImageAlt: "Profissional 50+",
      items: [
        { href: "area_50.html", label: "Início", navId: "inicio" },
        { href: "perfil_50.html", label: "Perfil", navId: "perfil" },
        { href: "seguranca_50.html", label: "Segurança", navId: "seguranca" },
      ],
    },
    parceiro: {
      label: "Área do parceiro",
      hub: "area_parceiro.html",
      bannerImage: "img/parceiro_inicio_1.jpg",
      bannerImageAlt: "Parceiro Mais Experiência",
      items: [
        { href: "area_parceiro.html", label: "Início", navId: "inicio" },
        { href: "pilar_parceiro.html?tipo=vaga", label: "Vagas", navId: "vaga", tipo: "vaga" },
        { href: "pilar_parceiro.html?tipo=curso", label: "Cursos", navId: "curso", tipo: "curso" },
        {
          href: "pilar_parceiro.html?tipo=bem_estar",
          label: "Bem-estar",
          navId: "bem_estar",
          tipo: "bem_estar",
        },
        { href: "pilar_parceiro.html?tipo=evento", label: "Comunidade", navId: "evento", tipo: "evento" },
        { href: "publicacoes_parceiro.html", label: "Publicações", navId: "publicacoes" },
        { href: "meu_logo.html", label: "Logo", navId: "logo" },
      ],
    },
    admin: {
      label: "Área admin",
      hub: "admin.html",
      items: [
        { href: "admin.html?secao=curadoria", label: "Curadoria", navId: "curadoria" },
        { href: "admin_parceiros.html", label: "Parceiros", navId: "parceiros" },
        { href: "admin_inscricoes.html", label: "Inscrições", navId: "inscricoes" },
      ],
    },
  };

  function isHomePage() {
    var path = window.location.pathname.replace(/\/$/, "");
    if (!path || path === "/") return true;
    return /(?:^|\/)index\.html$/.test(path);
  }

  function currentPage() {
    return (window.location.pathname.split("/").pop() || "").split("?")[0];
  }

  var AUTH_ENTRY_PAGES = {
    "entrar_50.html": true,
    "entrar_parceiro.html": true,
    "cadastro_50.html": true,
    "cadastro_parceiro.html": true,
    "ativar_parceiro.html": true,
    "recuperar_senha.html": true,
    "redefinir_senha.html": true,
  };

  function isAuthEntryPage() {
    return !!AUTH_ENTRY_PAGES[currentPage()];
  }

  function detectZone() {
    if (isAuthEntryPage()) return null;
    var page = currentPage();
    if (/^admin/.test(page) || page === "admin.html") return "admin";
    if (
      /parceiro|meu_logo|publicar_|publicacoes_parceiro|pilar_parceiro|ativar_parceiro/.test(page)
    ) {
      return "parceiro";
    }
    if (/50/.test(page)) return "50";
    return null;
  }

  function isNavLinkActive(href) {
    if (!href) return false;
    var parts = href.split("?");
    var targetPage = parts[0].replace(/^\.\//, "");
    if (currentPage() !== targetPage) return false;
    if (!parts[1]) {
      return !window.location.search;
    }
    var targetParams = new URLSearchParams(parts[1]);
    var currentParams = new URLSearchParams(window.location.search);
    var keys = [];
    targetParams.forEach(function (_value, key) {
      keys.push(key);
    });
    if (!keys.length) return true;
    return keys.every(function (key) {
      return targetParams.get(key) === currentParams.get(key);
    });
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

  function is50NavItemActive(item) {
    var page = currentPage();
    if (item.navId === "inicio") {
      return page === "area_50.html";
    }
    if (item.navId === "perfil") {
      return page === "perfil_50.html";
    }
    if (item.navId === "seguranca") {
      return page === "seguranca_50.html";
    }
    return isNavLinkActive(item.href);
  }

  function isParceiroNavItemActive(item) {
    var page = currentPage();
    var params = new URLSearchParams(window.location.search);

    if (item.navId === "inicio") {
      return page === "area_parceiro.html";
    }
    if (item.navId === "logo") {
      return page === "meu_logo.html";
    }
    if (item.navId === "publicacoes") {
      return page === "publicacoes_parceiro.html";
    }
    if (!item.tipo) {
      return isNavLinkActive(item.href);
    }

    var tipoAtual = params.get("tipo") || "";
    if (page === "publicacoes_parceiro.html") {
      return false;
    }
    if (page === "pilar_parceiro.html") {
      return tipoAtual === item.tipo;
    }
    if (item.tipo === "vaga" && page === "publicar_vaga.html") {
      return true;
    }
    if (page === "publicar_oferta.html") {
      return tipoAtual === item.tipo;
    }
    return isNavLinkActive(item.href);
  }

  function isAdminNavItemActive(item) {
    var page = currentPage();
    var params = new URLSearchParams(window.location.search);

    if (item.navId === "curadoria") {
      if (page === "admin_vagas.html" || page === "admin_ofertas.html") return true;
      return page === "admin.html" && params.get("secao") === "curadoria";
    }
    if (item.navId === "parceiros") {
      return page === "admin_parceiros.html";
    }
    if (item.navId === "inscricoes") {
      return page === "admin_inscricoes.html";
    }
    return isNavLinkActive(item.href);
  }

  function buildNavLinkLi(item, active, sub) {
    var cls =
      "app-shell-nav-link" +
      (active ? " is-active" : "") +
      (sub ? " app-shell-nav-sublink" : "");
    return (
      "<li><a class=\"" +
      cls +
      '" href="' +
      item.href +
      '"' +
      (active ? ' aria-current="page"' : "") +
      ">" +
      item.label +
      "</a></li>"
    );
  }

  function buildLogoutNavItem() {
    return (
      '<li><button type="button" class="app-shell-nav-link app-shell-nav-logout" id="app-shell-nav-logout">Sair</button></li>'
    );
  }

  function buildFlatNavItems(items, zoneKey) {
    return items
      .map(function (item) {
        var active = false;
        if (zoneKey === "parceiro") {
          active = isParceiroNavItemActive(item);
        } else if (zoneKey === "admin") {
          active = isAdminNavItemActive(item);
        } else if (zoneKey === "50") {
          active = is50NavItemActive(item);
        } else {
          active = currentPage() === item.href.split("?")[0] || isNavLinkActive(item.href);
        }
        return buildNavLinkLi(item, active, false);
      })
      .join("");
  }

  function buildNavItems(zoneKey) {
    var zone = ZONES[zoneKey];
    if (!zone) return "";
    var html = buildFlatNavItems(zone.items, zoneKey);
    if (zoneKey === "50" || zoneKey === "parceiro" || zoneKey === "admin") {
      html += buildLogoutNavItem();
    }
    return html;
  }

  function bindNavLogout(zoneKey) {
    var logoutBtn = document.getElementById("app-shell-nav-logout");
    if (!logoutBtn || !window.ME_APP) return;
    logoutBtn.addEventListener("click", function () {
      ME_APP.stopSessionIdleMonitoring();
      if (zoneKey === "parceiro") {
        ME_APP.clearParceiroSession();
        window.location.href = "index.html";
        return;
      }
      if (zoneKey === "admin") {
        if (window.ME_ADMIN) {
          ME_ADMIN.logout({ page: currentPage().replace(".html", "") || "admin" });
        } else {
          ME_APP.clearAdminKey();
          window.location.href = "admin.html";
        }
        return;
      }
      ME_APP.clearSession();
      window.location.href = "index.html";
    });
  }

  function bindMobileNavToggle(zoneKey) {
    var toggle = document.getElementById("app-shell-nav-toggle");
    var navPanel = document.getElementById("app-shell-nav-panel");
    if (!toggle || !navPanel) return;

    toggle.addEventListener("click", function () {
      var open = navPanel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    navPanel.querySelectorAll(".app-shell-nav-link:not(.app-shell-nav-logout)").forEach(function (link) {
      link.addEventListener("click", function () {
        navPanel.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    bindNavLogout(zoneKey);
  }

  function ensureAppHeader(zoneKey) {
    if (document.getElementById("app-shell-header")) return;
    var zone = ZONES[zoneKey];
    if (!zone) return;

    var header = document.createElement("header");
    header.id = "app-shell-header";
    header.className = "app-shell-header";
    var navItems = buildNavItems(zoneKey);
    var navHtml = navItems
      ? '<button type="button" class="app-shell-nav-toggle" id="app-shell-nav-toggle" aria-expanded="false" aria-controls="app-shell-nav-panel">Menu</button>' +
        '<nav class="app-shell-nav" id="app-shell-nav-panel" aria-label="Navegação da área">' +
        '<ul class="app-shell-nav-list">' +
        navItems +
        "</ul></nav>"
      : "";

    header.innerHTML =
      '<div class="app-shell-inner">' +
      window.ME_SITE_BRAND.buildLink("index.html") +
      navHtml +
      "</div>";

    document.body.insertBefore(header, document.body.firstChild);
    bindMobileNavToggle(zoneKey);
  }

  function hideDuplicateHubHeading(zoneLabel) {
    var main = document.querySelector("main");
    if (!main) return;
    var h1 = main.querySelector("h1");
    if (!h1 || h1.classList.contains("page-title-keep")) return;
    if (h1.textContent.trim() === zoneLabel) {
      h1.classList.add("visually-hidden");
    }
  }

  function firstNameFrom(nome) {
    var parts = String(nome || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return parts[0] || "";
  }

  function hydrateZoneBannerMedia(zoneKey) {
    var img = document.getElementById("zone-banner-img");
    var media = document.querySelector(".zone-banner-media");
    var titleEl = document.getElementById("zone-banner-title");
    if (!img || !window.ME_APP) return;

    if (zoneKey === "parceiro") {
      var sessaoParceiro = ME_APP.loadParceiroSession();
      if (sessaoParceiro && titleEl) {
        var empresa = sessaoParceiro.empresa || "";
        titleEl.textContent = empresa ? empresa : "Área do parceiro";
      }
      if (sessaoParceiro && sessaoParceiro.logoUrl) {
        img.src = sessaoParceiro.logoUrl;
        img.alt = sessaoParceiro.empresa ? "Logo de " + sessaoParceiro.empresa : "Logo da empresa";
        img.classList.add("zone-banner-img--logo");
        if (media) media.classList.add("zone-banner-media--logo");
        return;
      }

      fetch(ME_APP.getApiBase() + "/api/parceiros/perfil", { headers: ME_APP.getAuthHeaders() })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data.ok || !data.perfil) return;
          if (titleEl && data.perfil.empresa) {
            titleEl.textContent = data.perfil.empresa;
          }
          if (!data.perfil.logoUrl) return;
          img.src = data.perfil.logoUrl;
          img.alt = data.perfil.empresa ? "Logo de " + data.perfil.empresa : "Logo da empresa";
          img.classList.add("zone-banner-img--logo");
          if (media) media.classList.add("zone-banner-media--logo");
        })
        .catch(function () {});
      return;
    }

    if (zoneKey === "50") {
      var sessao50 = ME_APP.loadSession();
      if (sessao50 && titleEl) {
        var primeiro = firstNameFrom(sessao50.nome);
        titleEl.textContent = primeiro ? "Olá, " + primeiro : "Área 50+";
      }

      fetch(ME_APP.getApiBase() + "/api/contas/meu-perfil", { headers: ME_APP.getAuthHeaders() })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data.ok || !data.perfil || !data.perfil.fotoExibicao) {
            return;
          }
          img.src = data.perfil.fotoExibicao;
          img.alt = "Sua foto de perfil";
          img.classList.add("zone-banner-img--foto");
          if (media) media.classList.add("zone-banner-media--foto");
        })
        .catch(function () {});
    }
  }

  function ensureZoneBanner(zoneKey) {
    if (document.getElementById("app-shell-zone-banner")) return;
    var zone = ZONES[zoneKey];
    if (!zone) return;

    var page = currentPage();
    var isHubPage = page === zone.hub;
    if (isHubPage && (zoneKey === "50" || zoneKey === "parceiro")) {
      hideDuplicateHubHeading(zone.label);
      return;
    }

    var bannerImage = zone.bannerImage || "";
    var bannerImageAlt = zone.bannerImageAlt || "";
    var mediaHtml = bannerImage
      ? '<figure class="zone-banner-media">' +
        '<img id="zone-banner-img" class="zone-banner-img" src="' +
        bannerImage +
        '" alt="' +
        bannerImageAlt +
        '" width="80" height="80" decoding="async">' +
        "</figure>"
      : "";

    var banner = document.createElement("div");
    banner.id = "app-shell-zone-banner";
    banner.className = "app-shell-zone-banner";
    banner.innerHTML =
      '<div class="app-shell-zone-banner-inner app-shell-zone-banner-split">' +
      mediaHtml +
      '<p class="app-shell-zone-banner-title" id="zone-banner-title">' +
      zone.label +
      "</p>" +
      "</div>";

    var header = document.getElementById("app-shell-header");
    if (header) {
      header.insertAdjacentElement("afterend", banner);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    if (bannerImage && (zoneKey === "50" || zoneKey === "parceiro")) {
      hydrateZoneBannerMedia(zoneKey);
    }

    hideDuplicateHubHeading(zone.label);
  }

  function buildFooterInner() {
    var year = new Date().getFullYear();
    return (
      '<div class="app-shell-footer-inner">' +
      '<a href="mailto:contato@maisexperiencia.com.br">contato@maisexperiencia.com.br</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      '<a href="legal/index.html">Documentos legais</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      '<a href="legal/politica-de-privacidade.html">Privacidade</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      '<a href="legal/termos-de-uso.html">Termos</a>' +
      "<span aria-hidden=\"true\"> · </span>" +
      "<span>Porto Alegre — Rio Grande do Sul</span>" +
      "</div>" +
      '<p class="app-shell-footer-copy">&copy; ' +
      year +
      " Mais Experiência</p>"
    );
  }

  function ensureAppFooter() {
    if (document.getElementById("app-shell-footer")) return;
    var footer = document.createElement("footer");
    footer.id = "app-shell-footer";
    footer.className = "app-shell-footer";
    footer.innerHTML = buildFooterInner();
    document.body.appendChild(footer);
  }

  function initAppShell() {
    if (isHomePage() || isAuthEntryPage()) return;
    var zoneKey = detectZone();
    if (!zoneKey) return;
    ensureMainId();
    ensureSkipLink();
    document.body.classList.add("has-app-shell");
    ensureAppHeader(zoneKey);
    ensureZoneBanner(zoneKey);
    ensureAppFooter();
  }

  window.ME_APP_SHELL = {
    init: initAppShell,
    detectZone: detectZone,
  };

  initAppShell();
})();

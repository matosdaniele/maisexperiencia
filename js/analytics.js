(function () {
  var CONSENT_KEY = "me_cookie_consent";

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (error) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (error) {}
  }

  function scriptBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (/analytics\.js/.test(src)) {
        return src.replace(/analytics\.js(\?.*)?$/, "");
      }
    }
    return "js/";
  }

  function cssBase() {
    var base = scriptBase();
    return base.replace(/\/js\/$/, "/css/").replace(/^js\/$/, "css/");
  }

  function ensureCookieStyles() {
    if (document.getElementById("me-cookie-consent-css")) return;
    var link = document.createElement("link");
    link.id = "me-cookie-consent-css";
    link.rel = "stylesheet";
    link.href = cssBase() + "cookie-consent.css?v=2";
    document.head.appendChild(link);
  }

  var noopAnalytics = {
    track: function () {},
    hasConsent: function () {
      return false;
    },
  };

  function initGa() {
    var config = window.ME_SITE_CONFIG || {};
    var measurementId = config.ga4MeasurementId;
    if (!measurementId) {
      window.ME_ANALYTICS = noopAnalytics;
      return;
    }

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", measurementId, { anonymize_ip: true });

    var script = document.createElement("script");
    script.async = true;
    script.src =
      "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(script);

    window.ME_ANALYTICS = {
      track: function (eventName, params) {
        gtag("event", eventName, params || {});
      },
      hasConsent: function () {
        return true;
      },
    };
  }

  function removeBanner() {
    var banner = document.getElementById("me-cookie-banner");
    if (banner) banner.remove();
  }

  function showConsentBanner() {
    if (document.getElementById("me-cookie-banner")) return;
    ensureCookieStyles();

    var prefix = /\/legal\//.test(window.location.pathname) ? "../" : "";

    var banner = document.createElement("div");
    banner.id = "me-cookie-banner";
    banner.className = "me-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Preferências de cookies");
    banner.innerHTML =
      '<div class="me-cookie-banner-inner">' +
      '<p class="me-cookie-banner-text">Usamos cookies analíticos para melhorar a plataforma. ' +
      "Consulte os <a href=\"" +
      prefix +
      'legal/index.html">Documentos legais</a> ou a <a href="' +
      prefix +
      "legal/politica-de-privacidade.html\">Política de privacidade</a>.</p>" +
      '<div class="me-cookie-banner-actions">' +
      '<button type="button" class="me-cookie-btn me-cookie-btn--decline" id="me-cookie-decline">Recusar</button>' +
      '<button type="button" class="me-cookie-btn me-cookie-btn--accept" id="me-cookie-accept">Aceitar</button>' +
      "</div></div>";

    document.body.appendChild(banner);
    document.body.classList.add("has-cookie-banner");

    document.getElementById("me-cookie-accept").addEventListener("click", function () {
      setConsent("accepted");
      removeBanner();
      document.body.classList.remove("has-cookie-banner");
      initGa();
      window.ME_ANALYTICS.track("cookie_consent", { choice: "accepted" });
    });

    document.getElementById("me-cookie-decline").addEventListener("click", function () {
      setConsent("declined");
      removeBanner();
      document.body.classList.remove("has-cookie-banner");
      if (window.gtag) {
        gtag("event", "cookie_consent", { choice: "declined" });
      }
      window.ME_ANALYTICS = noopAnalytics;
    });
  }

  window.ME_ANALYTICS = noopAnalytics;

  var consent = getConsent();
  if (consent === "accepted") {
    initGa();
  } else if (consent !== "declined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showConsentBanner);
    } else {
      showConsentBanner();
    }
  }
})();

(function () {
  var FONT_MIN = 0;
  var FONT_MAX = 4;
  var FONT_STEPS = [1, 1.125, 1.25, 1.375, 1.5];
  var STORAGE_FONT = "me-a11y-font-level";
  var STORAGE_CONTRAST = "me-a11y-alto-contraste";

  function isHomePage() {
    var path = window.location.pathname.replace(/\/$/, "");
    if (!path || path === "/") return true;
    return /(?:^|\/)index\.html$/.test(path);
  }

  function ensureHomeNav() {
    if (isHomePage() || document.getElementById("site-home-nav") || document.getElementById("app-shell-header")) {
      return;
    }

    var nav = document.createElement("nav");
    nav.id = "site-home-nav";
    nav.className = "site-home-nav";
    nav.setAttribute("aria-label", "Marca Mais Experiência");
    nav.innerHTML =
      '<div class="site-home-nav-inner">' +
      window.ME_SITE_BRAND.buildLink("index.html") +
      "</div>";
    document.body.insertBefore(nav, document.body.firstChild);
  }

  function ensureA11yBar() {
    if (document.getElementById("a11y-bar")) {
      return;
    }

    var bar = document.createElement("nav");
    bar.id = "a11y-bar";
    bar.className = "a11y-bar";
    bar.setAttribute("aria-label", "Ferramentas de acessibilidade");
    bar.innerHTML =
      '<div class="a11y-bar-inner">' +
      '<span class="a11y-bar-label" id="a11y-bar-label">Acessibilidade</span>' +
      '<div class="a11y-bar-actions" aria-labelledby="a11y-bar-label">' +
      '<button type="button" class="a11y-btn" id="a11y-font-decrease" aria-label="Diminuir tamanho do texto">' +
      '<span class="a11y-btn-text" aria-hidden="true">A−</span>' +
      "</button>" +
      '<button type="button" class="a11y-btn" id="a11y-font-increase" aria-label="Aumentar tamanho do texto">' +
      '<span class="a11y-btn-text" aria-hidden="true">A+</span>' +
      "</button>" +
      '<button type="button" class="a11y-btn" id="a11y-contrast" aria-pressed="false" aria-label="Ativar alto contraste">' +
      '<svg class="a11y-btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z"/>' +
      "</svg>" +
      '<span class="a11y-btn-text">Contraste</span>' +
      "</button>" +
      '<button type="button" class="a11y-btn" id="a11y-speak" aria-pressed="false" aria-label="Ouvir conteúdo da página">' +
      '<svg class="a11y-btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>' +
      "</svg>" +
      '<span class="a11y-btn-text">Ouvir</span>' +
      "</button>" +
      "</div>" +
      "</div>";

    var zoneBanner = document.getElementById("app-shell-zone-banner");
    var header = document.getElementById("app-shell-header");
    var homeNav = document.getElementById("site-home-nav");
    if (zoneBanner) {
      document.body.insertBefore(bar, zoneBanner);
    } else if (header) {
      document.body.insertBefore(bar, header.nextSibling);
    } else if (homeNav) {
      document.body.insertBefore(bar, homeNav.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  function initA11yControls() {
    var root = document.documentElement;
    var fontDecrease = document.getElementById("a11y-font-decrease");
    var fontIncrease = document.getElementById("a11y-font-increase");
    var contrastBtn = document.getElementById("a11y-contrast");
    var speakBtn = document.getElementById("a11y-speak");
    if (!fontDecrease || !fontIncrease || !contrastBtn || !speakBtn) {
      return;
    }

    var mainContent =
      document.getElementById("conteudo") ||
      document.querySelector("main") ||
      document.body;
    var speech = window.speechSynthesis;
    var utterance = null;
    var fontLevel = 0;
    var altoContraste = false;

    function clampFontLevel(value) {
      return Math.min(FONT_MAX, Math.max(FONT_MIN, value));
    }

    function applyFontLevel(level) {
      fontLevel = clampFontLevel(level);
      root.style.setProperty("--font-scale", String(FONT_STEPS[fontLevel]));
      fontDecrease.disabled = fontLevel === FONT_MIN;
      fontIncrease.disabled = fontLevel === FONT_MAX;
      try {
        localStorage.setItem(STORAGE_FONT, String(fontLevel));
      } catch (error) {}
    }

    function applyContrast(active) {
      altoContraste = active;
      root.classList.toggle("alto-contraste", altoContraste);
      contrastBtn.setAttribute("aria-pressed", altoContraste ? "true" : "false");
      contrastBtn.setAttribute(
        "aria-label",
        altoContraste ? "Desativar alto contraste" : "Ativar alto contraste"
      );
      try {
        localStorage.setItem(STORAGE_CONTRAST, altoContraste ? "1" : "0");
      } catch (error) {}
    }

    function getReadableText() {
      var header = document.querySelector(".site-header");
      var parts = [];
      if (header) {
        parts.push(header.innerText.replace(/\s+/g, " ").trim());
      }
      if (mainContent) {
        parts.push(mainContent.innerText.replace(/\s+/g, " ").trim());
      }
      return parts.filter(Boolean).join(". ");
    }

    function getPortugueseVoice() {
      var voices = speech.getVoices();
      return (
        voices.find(function (voice) {
          return voice.lang === "pt-BR";
        }) ||
        voices.find(function (voice) {
          return voice.lang.indexOf("pt") === 0;
        }) ||
        null
      );
    }

    function stopSpeech() {
      if (speech.speaking || speech.pending) {
        speech.cancel();
      }
      utterance = null;
      speakBtn.setAttribute("aria-pressed", "false");
      speakBtn.setAttribute("aria-label", "Ouvir conteúdo da página");
    }

    function startSpeech() {
      var text = getReadableText();
      if (!text) {
        return;
      }
      stopSpeech();
      utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 0.95;
      var voice = getPortugueseVoice();
      if (voice) {
        utterance.voice = voice;
      }
      utterance.onend = stopSpeech;
      utterance.onerror = stopSpeech;
      speakBtn.setAttribute("aria-pressed", "true");
      speakBtn.setAttribute("aria-label", "Parar leitura em voz alta");
      speech.speak(utterance);
    }

    fontDecrease.addEventListener("click", function () {
      applyFontLevel(fontLevel - 1);
    });

    fontIncrease.addEventListener("click", function () {
      applyFontLevel(fontLevel + 1);
    });

    contrastBtn.addEventListener("click", function () {
      applyContrast(!altoContraste);
    });

    speakBtn.addEventListener("click", function () {
      if (speech.speaking || speech.pending) {
        stopSpeech();
        return;
      }
      startSpeech();
    });

    if (speech.onvoiceschanged !== undefined) {
      speech.onvoiceschanged = function () {};
    }

    try {
      var savedFont = localStorage.getItem(STORAGE_FONT);
      if (savedFont !== null) {
        applyFontLevel(parseInt(savedFont, 10));
      } else {
        applyFontLevel(0);
      }
      applyContrast(localStorage.getItem(STORAGE_CONTRAST) === "1");
    } catch (error) {
      applyFontLevel(0);
      applyContrast(false);
    }
  }

  ensureHomeNav();
  ensureA11yBar();
  initA11yControls();
})();

(function () {
  var config = window.ME_SITE_CONFIG || {};
  var IDLE_TIMEOUT_50_MS = 20 * 60 * 1000;
  var IDLE_TIMEOUT_PARCEIRO_MS = 20 * 60 * 1000;
  var IDLE_TIMEOUT_ADMIN_MS = 15 * 60 * 1000;
  var IDLE_WARN_MS = 2 * 60 * 1000;
  var ADMIN_STORAGE_KEY = "me_admin_key";
  var idleTimer = null;
  var idleWarnTimer = null;
  var idleScheduleDebounceTimer = null;
  var idleLastActivity = 0;
  var idleListenersAttached = false;
  var idleScrollThrottled = false;
  var idleMousemoveThrottled = false;
  var idleWarningVisible = false;

  function onIdleActivity() {
    bumpIdleActivity();
  }

  function onIdleScroll() {
    if (idleScrollThrottled) return;
    idleScrollThrottled = true;
    setTimeout(function () {
      idleScrollThrottled = false;
    }, 500);
    bumpIdleActivity();
  }

  function onIdleMouseMove() {
    if (idleMousemoveThrottled) return;
    idleMousemoveThrottled = true;
    setTimeout(function () {
      idleMousemoveThrottled = false;
    }, 2000);
    bumpIdleActivity();
  }

  function onIdleVisibilityChange() {
    if (document.visibilityState !== "visible") return;
    var kind = getActiveSessionKind();
    if (kind && Date.now() - idleLastActivity >= getIdleTimeoutMs(kind)) {
      expireSessionByIdle(kind);
      return;
    }
    bumpIdleActivity();
  }

  function attachIdleListeners() {
    if (idleListenersAttached) return;
    idleListenersAttached = true;
    document.addEventListener("mousedown", onIdleActivity, { passive: true });
    document.addEventListener("keydown", onIdleActivity, { passive: true });
    document.addEventListener("touchstart", onIdleActivity, { passive: true });
    document.addEventListener("scroll", onIdleScroll, { passive: true });
    document.addEventListener("mousemove", onIdleMouseMove, { passive: true });
    document.addEventListener("visibilitychange", onIdleVisibilityChange);
  }

  function detachIdleListeners() {
    if (!idleListenersAttached) return;
    idleListenersAttached = false;
    document.removeEventListener("mousedown", onIdleActivity);
    document.removeEventListener("keydown", onIdleActivity);
    document.removeEventListener("touchstart", onIdleActivity);
    document.removeEventListener("scroll", onIdleScroll);
    document.removeEventListener("mousemove", onIdleMouseMove);
    document.removeEventListener("visibilitychange", onIdleVisibilityChange);
  }

  function stopSessionIdleMonitoring() {
    clearTimeout(idleTimer);
    clearTimeout(idleWarnTimer);
    clearTimeout(idleScheduleDebounceTimer);
    hideIdleWarning();
    detachIdleListeners();
  }

  function queueIdleSchedule() {
    clearTimeout(idleScheduleDebounceTimer);
    idleScheduleDebounceTimer = setTimeout(scheduleIdleCheck, 200);
  }

  function bumpIdleActivity() {
    if (!getActiveSessionKind()) return;
    idleLastActivity = Date.now();
    if (idleWarningVisible) {
      idleWarningVisible = false;
      hideIdleWarning();
    }
    queueIdleSchedule();
  }

  function syncIdleMonitoring() {
    if (getActiveSessionKind()) {
      attachIdleListeners();
      queueIdleSchedule();
    } else {
      stopSessionIdleMonitoring();
    }
  }

  function getApiBase() {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3000";
    }
    return "https://api.maisexperiencia.com.br";
  }

  function saveSession(perfil) {
    try {
      var data = {
        nome: perfil.nome,
        email: perfil.email,
        at: Date.now(),
      };
      if (perfil.token) {
        data.token = perfil.token;
      }
      sessionStorage.setItem("me_sessao_50", JSON.stringify(data));
      initSessionIdleTimeout();
    } catch (error) {}
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem("me_sessao_50");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function isSession50Valid(sessao) {
    return !!(sessao && sessao.email && sessao.token);
  }

  function ensureSession50(redirectUrl) {
    var sessao = loadSession();
    if (!isSession50Valid(sessao)) {
      clearSession();
      window.location.replace(
        redirectUrl || ME_APP.buildAuthUrl("entrar_50.html", ME_APP.getCurrentPageDestino())
      );
      return null;
    }
    return sessao;
  }

  function clearSession() {
    try {
      sessionStorage.removeItem("me_sessao_50");
    } catch (error) {}
  }

  function saveParceiroSession(perfil) {
    try {
      var data = {
        nome: perfil.nome,
        empresa: perfil.empresa,
        email: perfil.email,
        at: Date.now(),
      };
      if (perfil.logoUrl) {
        data.logoUrl = perfil.logoUrl;
      }
      if (perfil.token) {
        data.token = perfil.token;
      }
      sessionStorage.setItem("me_sessao_parceiro", JSON.stringify(data));
      initSessionIdleTimeout();
    } catch (error) {}
  }

  function getAuthHeaders() {
    var sessao50 = loadSession();
    if (sessao50 && sessao50.token) {
      return { Authorization: "Bearer " + sessao50.token };
    }
    var sessaoParceiro = loadParceiroSession();
    if (sessaoParceiro && sessaoParceiro.token) {
      return { Authorization: "Bearer " + sessaoParceiro.token };
    }
    return {};
  }

  function authJsonHeaders(extra) {
    var headers = Object.assign({ "Content-Type": "application/json" }, getAuthHeaders());
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  function loadParceiroSession() {
    try {
      var raw = sessionStorage.getItem("me_sessao_parceiro");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function isParceiroSessionValid(sessao) {
    return !!(sessao && sessao.email && sessao.token);
  }

  function ensureParceiroSession(redirectUrl) {
    var sessao = loadParceiroSession();
    if (!isParceiroSessionValid(sessao)) {
      clearParceiroSession();
      window.location.replace(redirectUrl || "entrar_parceiro.html");
      return null;
    }
    return sessao;
  }

  function requireAdminKey() {
    var key = getAdminKey();
    if (!key) {
      var destino = window.location.pathname.split("/").pop() + window.location.search;
      window.location.replace("admin.html?destino=" + encodeURIComponent(destino));
      return "";
    }
    return key;
  }

  function clearParceiroSession() {
    try {
      sessionStorage.removeItem("me_sessao_parceiro");
    } catch (error) {}
  }

  function getAdminKey() {
    try {
      return sessionStorage.getItem(ADMIN_STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function clearAdminKey() {
    try {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (error) {}
  }

  function getActiveSessionKind() {
    var sessao50 = loadSession();
    if (isSession50Valid(sessao50)) return "50";
    var sessaoParceiro = loadParceiroSession();
    if (isParceiroSessionValid(sessaoParceiro)) return "parceiro";
    if (getAdminKey()) return "admin";
    return null;
  }

  function getIdleTimeoutMs(kind) {
    if (kind === "admin") return IDLE_TIMEOUT_ADMIN_MS;
    if (kind === "parceiro") return IDLE_TIMEOUT_PARCEIRO_MS;
    return IDLE_TIMEOUT_50_MS;
  }

  function getIdleTimeoutMinutes(kind) {
    return Math.round(getIdleTimeoutMs(kind) / 60000);
  }

  function expireSessionByIdle(kind) {
    hideIdleWarning();
    if (kind === "50") clearSession();
    else if (kind === "parceiro") clearParceiroSession();
    else if (kind === "admin") clearAdminKey();

    var destinos = {
      "50": "entrar_50.html?idle=1",
      parceiro: "entrar_parceiro.html?idle=1",
      admin: "admin.html?idle=1",
    };
    window.location.replace(destinos[kind] || "index.html");
  }

  function hideIdleWarning() {
    idleWarningVisible = false;
    var el = document.getElementById("me-idle-warning");
    if (el) el.hidden = true;
  }

  function showIdleWarning() {
    if (idleWarningVisible) return;
    idleWarningVisible = true;

    var el = document.getElementById("me-idle-warning");
    if (!el) {
      el = document.createElement("div");
      el.id = "me-idle-warning";
      el.className = "idle-warning";
      el.hidden = true;
      el.setAttribute("role", "alertdialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "me-idle-warning-title");
      el.innerHTML =
        "<div class=\"idle-warning-backdrop\"></div>" +
        "<div class=\"idle-warning-card\">" +
        "<h2 id=\"me-idle-warning-title\" class=\"idle-warning-title\">Sessão a expirar</h2>" +
        "<p class=\"idle-warning-text\">Por inatividade, a sua sessão expira em 2 minutos.</p>" +
        "<p class=\"idle-warning-actions\">" +
        "<button type=\"button\" class=\"btn idle-warning-btn\">Continuar sessão</button>" +
        "</p>" +
        "</div>";
      document.body.appendChild(el);
      el.querySelector(".idle-warning-btn").addEventListener("click", function () {
        hideIdleWarning();
        bumpIdleActivity();
      });
    }
    el.hidden = false;
    var btn = el.querySelector(".idle-warning-btn");
    if (btn) btn.focus();
  }

  function scheduleIdleCheck() {
    clearTimeout(idleTimer);
    clearTimeout(idleWarnTimer);
    var kind = getActiveSessionKind();
    if (!kind) {
      hideIdleWarning();
      return;
    }

    var timeoutMs = getIdleTimeoutMs(kind);
    var remaining = timeoutMs - (Date.now() - idleLastActivity);
    if (remaining <= 0) {
      expireSessionByIdle(kind);
      return;
    }

    if (remaining <= IDLE_WARN_MS) {
      showIdleWarning();
      idleTimer = setTimeout(function () {
        var activeKind = getActiveSessionKind();
        if (!activeKind) return;
        if (Date.now() - idleLastActivity >= getIdleTimeoutMs(activeKind)) {
          expireSessionByIdle(activeKind);
          return;
        }
        scheduleIdleCheck();
      }, remaining);
      return;
    }

    hideIdleWarning();
    var warnIn = remaining - IDLE_WARN_MS;
    idleWarnTimer = setTimeout(function () {
      var activeKind = getActiveSessionKind();
      if (!activeKind) return;
      if (Date.now() - idleLastActivity >= getIdleTimeoutMs(activeKind)) {
        expireSessionByIdle(activeKind);
        return;
      }
      showIdleWarning();
      scheduleIdleCheck();
    }, warnIn);

    idleTimer = setTimeout(function () {
      var activeKind = getActiveSessionKind();
      if (!activeKind) return;
      if (Date.now() - idleLastActivity >= getIdleTimeoutMs(activeKind)) {
        expireSessionByIdle(activeKind);
        return;
      }
      scheduleIdleCheck();
    }, remaining);
  }

  function initSessionIdleTimeout() {
    if (!idleLastActivity) {
      idleLastActivity = Date.now();
    }
    syncIdleMonitoring();
  }

  function validateSenha(senha) {
    var value = String(senha || "");
    if (value.length < 6) {
      return {
        ok: false,
        error: "A senha deve ter no mínimo 6 caracteres.",
      };
    }
    var regras = 0;
    if (/[a-zA-Z]/.test(value)) regras += 1;
    if (/[0-9]/.test(value)) regras += 1;
    if (/[^a-zA-Z0-9]/.test(value)) regras += 1;
    if (regras < 2) {
      return {
        ok: false,
        error:
          "A senha deve cumprir pelo menos 2 regras: conter letra, número ou caractere especial.",
      };
    }
    return { ok: true };
  }

  function initPasswordFields(root) {
    var scope = root || document;
    scope.querySelectorAll('input[type="password"]').forEach(function (input) {
      if (input.closest(".password-field")) {
        return;
      }

      var wrapper = document.createElement("div");
      wrapper.className = "password-field";

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "password-field-toggle";
      toggle.textContent = "Mostrar";
      toggle.setAttribute("aria-label", "Mostrar senha");

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      input.classList.add("password-field-input");

      toggle.addEventListener("click", function () {
        var visible = input.type === "text";
        input.type = visible ? "password" : "text";
        toggle.textContent = visible ? "Mostrar" : "Ocultar";
        toggle.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
      });

      wrapper.appendChild(toggle);
    });
  }

  function parseDataPublicacao(value) {
    if (!value) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var parts = value.split("-");
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatDataPublicacao(value) {
    var date = parseDataPublicacao(value);
    if (!date) return "—";
    return date.toLocaleDateString("pt-BR");
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return null;
    }
  }

  function appendQueryParam(url, key, value) {
    if (!value) return url;
    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    return url + sep + encodeURIComponent(key) + "=" + encodeURIComponent(value);
  }

  function buildAuthUrl(page, destino) {
    if (!destino) return page;
    return appendQueryParam(page, "destino", destino);
  }

  function isAllowedDestino(destino) {
    return /^(emprego_50|cursos_50|eventos_50|comunidade_50|bem_estar_50|vagas_50)\.html\?id=[a-f0-9]{24}$/i.test(String(destino || "").trim());
  }

  function resolveRedirectAfterAuth(fallback) {
    var destino = getQueryParam("destino");
    if (isAllowedDestino(destino)) return destino;
    return fallback || "area_50.html";
  }

  function getCurrentPageDestino() {
    var page = window.location.pathname.split("/").pop() || "";
    if (!page || page.indexOf(".html") === -1) return null;
    return page + window.location.search;
  }

  function normalizeId(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object") {
      if (value.$oid) return String(value.$oid);
      if (typeof value.toHexString === "function") return value.toHexString();
    }
    return String(value);
  }

  function sameId(a, b) {
    return normalizeId(a) === normalizeId(b);
  }

  function parseDataNascimento(value) {
    if (!value) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var parts = value.split("-");
      var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (
        isNaN(date.getTime()) ||
        date.getFullYear() !== Number(parts[0]) ||
        date.getMonth() !== Number(parts[1]) - 1 ||
        date.getDate() !== Number(parts[2])
      ) {
        return null;
      }
      return date;
    }
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function calcularIdade(dataNascimento, refDate) {
    var born = parseDataNascimento(dataNascimento);
    if (!born) return null;
    var hoje = refDate ? new Date(refDate) : new Date();
    hoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    var nasc = new Date(born.getFullYear(), born.getMonth(), born.getDate());
    if (nasc.getTime() > hoje.getTime()) return null;
    var idade = hoje.getFullYear() - nasc.getFullYear();
    var mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
      idade -= 1;
    }
    return idade;
  }

  function validateIdadeMinima50(dataNascimento) {
    var idade = calcularIdade(dataNascimento);
    if (idade === null) {
      return { ok: false, error: "Informe uma data de nascimento válida." };
    }
    if (idade < 50) {
      return {
        ok: false,
        error: "O cadastro é exclusivo para pessoas com 50 anos ou mais.",
      };
    }
    return { ok: true, idade: idade };
  }

  function startOfDay(date) {
    var copy = new Date(date.getTime());
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function normalizeVigencia(input) {
    if (!input || typeof input !== "object") {
      return {
        inicio: null,
        fim: parseDataPublicacao(input),
      };
    }

    var inicio = parseDataPublicacao(input.dataInicio);
    var fim = parseDataPublicacao(input.dataFim);
    var isCurso = input.tipo === "curso" || input.categoria === "curso";

    if (!fim && !inicio && !isCurso && input.dataPublicacao) {
      fim = parseDataPublicacao(input.dataPublicacao);
    }

    return {
      inicio: inicio,
      fim: fim,
    };
  }

  function formatVigenciaPeriodo(input) {
    var vigencia = normalizeVigencia(input);
    if (vigencia.inicio && vigencia.fim) {
      return formatDataPublicacao(vigencia.inicio) + " – " + formatDataPublicacao(vigencia.fim);
    }
    if (vigencia.fim) {
      return "até " + formatDataPublicacao(vigencia.fim);
    }
    return "—";
  }

  function getStatusVigencia(input) {
    var vigencia = normalizeVigencia(input);
    var inicio = vigencia.inicio;
    var fim = vigencia.fim;

    if (!fim && !inicio) {
      return {
        code: "sem_data",
        label: "Sem data",
        className: "status-aviso status-aviso--sem-data",
      };
    }

    var today = startOfDay(new Date());

    if (inicio) {
      inicio = startOfDay(inicio);
      if (today.getTime() < inicio.getTime()) {
        return {
          code: "inativo",
          label: "Inativo",
          className: "status-aviso status-aviso--inativo",
        };
      }
    }

    if (!fim) {
      return {
        code: "sem_data",
        label: "Sem data",
        className: "status-aviso status-aviso--sem-data",
      };
    }

    fim = startOfDay(fim);
    if (today.getTime() > fim.getTime()) {
      return {
        code: "inativo",
        label: "Inativo",
        className: "status-aviso status-aviso--inativo",
      };
    }
    if (today.getTime() === fim.getTime()) {
      return {
        code: "ultimo_dia",
        label: "Último dia",
        className: "status-aviso status-aviso--ultimo-dia",
      };
    }
    return {
      code: "activo",
      label: "Ativo",
      className: "status-aviso status-aviso--ativo",
    };
  }

  function isPublicacaoExpirada(input) {
    var status = getStatusVigencia(input);
    return status.code === "inativo";
  }

  function filtrarPublicacoesAbertas(items, inscritosIds) {
    return (items || []).filter(function (item) {
      var id = normalizeId(item._id);
      if (item.inscrito || item.candidatou) {
        return false;
      }
      if (inscritosIds && id && inscritosIds.has(id)) {
        return false;
      }
      return !isPublicacaoExpirada(item);
    });
  }

  function closePublicacaoAccordionItems(list, exceptLi) {
    if (!list) return;
    list.querySelectorAll(".publicacao-item.is-open").forEach(function (item) {
      if (item === exceptLi) return;
      item.classList.remove("is-open");
      var btn = item.querySelector(".publicacao-item-toggle");
      var panel = item.querySelector(".publicacao-item-panel");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    });
  }

  function setPublicacaoAccordionOpen(li, abrir) {
    if (!li) return;
    var toggle = li.querySelector(".publicacao-item-toggle");
    var panel = li.querySelector(".publicacao-item-panel");
    if (!toggle || !panel) return;
    panel.hidden = !abrir;
    li.classList.toggle("is-open", abrir);
    toggle.setAttribute("aria-expanded", abrir ? "true" : "false");
  }

  function bindPublicacaoAccordion(li, onOpen) {
    var toggle = li.querySelector(".publicacao-item-toggle");
    var panel = li.querySelector(".publicacao-item-panel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", function () {
      var abrir = panel.hidden;
      closePublicacaoAccordionItems(li.parentElement, abrir ? li : null);
      setPublicacaoAccordionOpen(li, abrir);
      if (abrir && onOpen) onOpen();
    });
  }

  function initPilarViewTabs(options) {
    options = options || {};
    var tabs = document.getElementById("pilar-view-tabs");
    var publicacoesPanel = options.publicacoesPanel
      || (options.publicacoesPanelId ? document.getElementById(options.publicacoesPanelId) : null);
    var inscricoesPanel = options.inscricoesPanel
      || (options.inscricoesPanelId ? document.getElementById(options.inscricoesPanelId) : null);

    function togglePanels(view) {
      if (publicacoesPanel) {
        publicacoesPanel.hidden = view !== "publicacoes";
      }
      if (inscricoesPanel) {
        inscricoesPanel.hidden = view !== "inscricoes";
      }
    }

    if (!tabs) {
      togglePanels("publicacoes");
      if (options.onPublicacoes) options.onPublicacoes();
      return;
    }
    if (options.hide) {
      tabs.hidden = true;
      togglePanels("publicacoes");
      if (options.onPublicacoes) options.onPublicacoes();
      return;
    }
    if (tabs.dataset.pilarTabsInit === "1") {
      return;
    }
    tabs.dataset.pilarTabsInit = "1";
    tabs.hidden = false;
    var buttons = tabs.querySelectorAll("[data-view]");
    function setView(view) {
      buttons.forEach(function (btn) {
        var active = btn.getAttribute("data-view") === view;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      togglePanels(view);
      if (view === "inscricoes" && options.onInscricoes) {
        options.onInscricoes();
      } else if (options.onPublicacoes) {
        options.onPublicacoes();
      }
    }
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setView(btn.getAttribute("data-view"));
      });
    });
    setView(options.defaultView || "publicacoes");
  }

  function dataUrlByteSize(dataUrl) {
    var base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.floor((base64.length * 3) / 4);
  }

  function loadImageElement(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("Não foi possível ler a imagem."));
      };
      img.src = src;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("Não foi possível ler a imagem."));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Reduz uma imagem grande para caber no limite da API (por omissão 400 KB).
   * Aceita ficheiros até maxSourceBytes; redimensiona e comprime no browser.
   */
  function prepareImageUpload(file, options) {
    var opts = options || {};
    var maxBytes = opts.maxBytes || 400 * 1024;
    var maxEdge = opts.maxEdge || 1600;
    var maxSourceBytes = opts.maxSourceBytes || 8 * 1024 * 1024;
    var preferPng = opts.preferPng === true;

    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("Selecione uma imagem."));
        return;
      }
      if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type || "")) {
        reject(new Error("Use uma imagem PNG, JPG ou WebP."));
        return;
      }
      if (file.size > maxSourceBytes) {
        reject(new Error("A imagem deve ter no máximo 8 MB."));
        return;
      }

      readFileAsDataUrl(file)
        .then(function (dataUrl) {
          if (file.size <= maxBytes) {
            return loadImageElement(dataUrl).then(function (img) {
              var longest = Math.max(img.naturalWidth || 0, img.naturalHeight || 0);
              if (longest && longest <= maxEdge) {
                return dataUrl;
              }
              return compressImageElement(img, {
                maxBytes: maxBytes,
                maxEdge: maxEdge,
                preferPng: preferPng || /image\/png/i.test(file.type),
              });
            });
          }
          return loadImageElement(dataUrl).then(function (img) {
            return compressImageElement(img, {
              maxBytes: maxBytes,
              maxEdge: maxEdge,
              preferPng: preferPng || /image\/png/i.test(file.type),
            });
          });
        })
        .then(resolve)
        .catch(reject);
    });
  }

  function compressImageElement(img, options) {
    var opts = options || {};
    var maxBytes = opts.maxBytes || 400 * 1024;
    var maxEdge = opts.maxEdge || 1600;
    var preferPng = opts.preferPng === true;
    var naturalW = img.naturalWidth || img.width;
    var naturalH = img.naturalHeight || img.height;

    if (!naturalW || !naturalH) {
      return Promise.reject(new Error("Não foi possível ler a imagem."));
    }

    var edgeSteps = [maxEdge, 1280, 1024, 800, 640, 512, 400];
    var qualities = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45];

    function drawScaled(edge) {
      var scale = Math.min(1, edge / Math.max(naturalW, naturalH));
      var w = Math.max(1, Math.round(naturalW * scale));
      var h = Math.max(1, Math.round(naturalH * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Não foi possível processar a imagem.");
      }
      if (!preferPng) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      return canvas;
    }

    return new Promise(function (resolve, reject) {
      var e = 0;

      function tryEdge() {
        if (e >= edgeSteps.length) {
          reject(
            new Error(
              "Não foi possível reduzir a imagem para 400 KB. Escolha outra foto."
            )
          );
          return;
        }
        var canvas;
        try {
          canvas = drawScaled(edgeSteps[e]);
        } catch (err) {
          reject(err);
          return;
        }
        e += 1;

        if (preferPng) {
          var pngUrl = canvas.toDataURL("image/png");
          if (dataUrlByteSize(pngUrl) <= maxBytes) {
            resolve(pngUrl);
            return;
          }
        }

        var q = 0;
        function tryQuality() {
          if (q >= qualities.length) {
            tryEdge();
            return;
          }
          var jpegUrl = canvas.toDataURL("image/jpeg", qualities[q]);
          q += 1;
          if (dataUrlByteSize(jpegUrl) <= maxBytes) {
            resolve(jpegUrl);
            return;
          }
          tryQuality();
        }
        tryQuality();
      }

      tryEdge();
    });
  }

  window.ME_APP = {
    getApiBase: getApiBase,
    saveSession: saveSession,
    loadSession: loadSession,
    ensureSession50: ensureSession50,
    isSession50Valid: isSession50Valid,
    clearSession: clearSession,
    saveParceiroSession: saveParceiroSession,
    loadParceiroSession: loadParceiroSession,
    ensureParceiroSession: ensureParceiroSession,
    isParceiroSessionValid: isParceiroSessionValid,
    clearParceiroSession: clearParceiroSession,
    getAdminKey: getAdminKey,
    requireAdminKey: requireAdminKey,
    clearAdminKey: clearAdminKey,
    initSessionIdleTimeout: initSessionIdleTimeout,
    stopSessionIdleMonitoring: stopSessionIdleMonitoring,
    validateSenha: validateSenha,
    parseDataPublicacao: parseDataPublicacao,
    formatDataPublicacao: formatDataPublicacao,
    formatVigenciaPeriodo: formatVigenciaPeriodo,
    getQueryParam: getQueryParam,
    buildAuthUrl: buildAuthUrl,
    resolveRedirectAfterAuth: resolveRedirectAfterAuth,
    getCurrentPageDestino: getCurrentPageDestino,
    sameId: sameId,
    normalizeId: normalizeId,
    parseDataNascimento: parseDataNascimento,
    calcularIdade: calcularIdade,
    validateIdadeMinima50: validateIdadeMinima50,
    getStatusVigencia: getStatusVigencia,
    isPublicacaoExpirada: isPublicacaoExpirada,
    filtrarPublicacoesAbertas: filtrarPublicacoesAbertas,
    initPilarViewTabs: initPilarViewTabs,
    bindPublicacaoAccordion: bindPublicacaoAccordion,
    setPublicacaoAccordionOpen: setPublicacaoAccordionOpen,
    initPasswordFields: initPasswordFields,
    getAuthHeaders: getAuthHeaders,
    authJsonHeaders: authJsonHeaders,
    prepareImageUpload: prepareImageUpload,
  };

  function bootAppCommon() {
    initPasswordFields(document);
    initSessionIdleTimeout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAppCommon);
  } else {
    bootAppCommon();
  }
})();

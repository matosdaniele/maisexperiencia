(function () {
  var config = window.ME_OFERTA_PAGE || {
    page: "cursos_50.html",
    tipo: "curso",
    titulo: "Cursos",
    lead: "Capacite-se com cursos pensados para o público 50+.",
    analyticsPage: "cursos_50",
  };

  var destaqueId = ME_APP.getQueryParam("id");
  var tipoFiltro = ME_APP.getQueryParam("tipo") || config.tipo || "";
  var destinoAtual = ME_APP.getCurrentPageDestino();

  var sessao = ME_APP.ensureSession50(ME_APP.buildAuthUrl("entrar_50.html", destinoAtual));
  if (!sessao) return;

  var titulosPorTipo = {
    curso: { titulo: "Cursos", lead: "Capacite-se com cursos pensados para o público 50+." },
    bem_estar: { titulo: "Bem-estar", lead: "Conteúdos e serviços de saúde, equilíbrio e longevidade." },
    evento: { titulo: "Comunidade", lead: "Participe de encontros, workshops e experiências presenciais ou online." },
  };

  var destaquePorTipo = {
    curso: {
      titulo: "Curso em destaque",
      lead: "Confira os detalhes e conclua sua inscrição no curso.",
    },
    bem_estar: {
      titulo: "Bem-estar em destaque",
      lead: "Confira os detalhes e conclua sua inscrição.",
    },
    evento: {
      titulo: "Comunidade em destaque",
      lead: "Confira os detalhes e conclua sua inscrição.",
    },
  };

  var apiBase = ME_APP.getApiBase();
  var list = document.getElementById("oferta-list");
  var inscricoesList = document.getElementById("inscricoes-list");
  var publicacoesPanel = document.getElementById("publicacoes-panel");
  var inscricoesPanel = document.getElementById("inscricoes-panel");
  var feedback = document.getElementById("feedback");
  var pageTitle = document.getElementById("page-title");
  var pageLead = document.getElementById("page-lead");
  var backLink = document.getElementById("back-link");
  var activeView = "publicacoes";

  function mensagemListaVaziaInscricoes() {
    if (tipoFiltro === "curso") return "Você ainda não fez inscrições em cursos.";
    if (tipoFiltro === "bem_estar") return "Você ainda não fez inscrições em bem-estar.";
    if (tipoFiltro === "evento") return "Você ainda não fez inscrições em comunidade.";
    return "Você ainda não fez inscrições nesta categoria.";
  }

  function alvoInscricoes() {
    return inscricoesList || list;
  }

  function mostrarPainelPublicacoes() {
    if (publicacoesPanel) publicacoesPanel.hidden = false;
    if (inscricoesPanel) inscricoesPanel.hidden = true;
  }

  function mostrarPainelInscricoes() {
    if (publicacoesPanel) publicacoesPanel.hidden = true;
    if (inscricoesPanel) inscricoesPanel.hidden = false;
  }

  function renderMensagemInscricoes(alvo, message) {
    if (!alvo) return;
    alvo.innerHTML =
      "<li class=\"publicacao-item publicacao-item-empty\">" + escapeHtml(message) + "</li>";
  }

  function aplicarTituloPagina(tipo) {
    if (config.skipPageTitle || !pageTitle || !pageLead) return;

    if (destaqueId) {
      var destaqueCfg = destaquePorTipo[tipo] || {
        titulo: "Oportunidade em destaque",
        lead: "Confira os detalhes e conclua sua inscrição.",
      };
      if (backLink) {
        backLink.href = "index.html#destaques";
        backLink.textContent = "← Voltar ao destaque";
      }
      pageTitle.textContent = destaqueCfg.titulo;
      pageLead.textContent = destaqueCfg.lead;
      document.title = destaqueCfg.titulo + " — Mais Experiência";
      return;
    }

    if (titulosPorTipo[tipo]) {
      pageTitle.textContent = titulosPorTipo[tipo].titulo;
      pageLead.textContent = titulosPorTipo[tipo].lead;
      document.title = titulosPorTipo[tipo].titulo + " 50+ — Mais Experiência";
      return;
    }

    pageTitle.textContent = config.titulo;
    pageLead.textContent = config.lead;
    document.title = config.titulo + " 50+ — Mais Experiência";
  }

  aplicarTituloPagina(tipoFiltro);

  if (!config.skipAnalytics) {
    ME_ANALYTICS.track(config.analyticsPage + "_visita", {
      page: config.analyticsPage,
      destaqueId: destaqueId || null,
      tipo: tipoFiltro || null,
    });
  }

  function showFeedback(message, type) {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
  }

  function formatBrl(value) {
    return "R$ " + Number(value).toFixed(2).replace(".", ",");
  }

  function labelInscricao(oferta) {
    if (Number(oferta.valorInscricaoBrl) === 0) {
      return "Inscreva-se gratuitamente";
    }
    return "Quero me inscrever";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var modalidadeLabels = {
    presencial: "Presencial",
    hibrido: "Híbrido",
    remoto: "Remoto",
  };

  function buildOfertaMeta(oferta) {
    var items = [];
    if (oferta.modalidade) {
      items.push("<li><strong>Modalidade:</strong> " + escapeHtml(modalidadeLabels[oferta.modalidade] || oferta.modalidade) + "</li>");
    }
    if (oferta.local) {
      items.push("<li><strong>Local:</strong> " + escapeHtml(oferta.local) + "</li>");
    }
    if (oferta.tipo === "curso") {
      var inicio = ME_APP.formatDataPublicacao(oferta.dataPublicacao);
      if (oferta.hora) inicio += " · " + escapeHtml(oferta.hora);
      items.push("<li><strong>Início do curso:</strong> " + inicio + "</li>");
    } else if (oferta.tipo === "evento" && oferta.dataTexto) {
      items.push("<li><strong>Data:</strong> " + escapeHtml(oferta.dataTexto) + "</li>");
    }
    items.push("<li><strong>Disponível na plataforma:</strong> " + escapeHtml(ME_APP.formatVigenciaPeriodo(oferta)) + "</li>");
    if (oferta.referencia) {
      items.push("<li><strong>Referência:</strong> " + escapeHtml(oferta.referencia) + "</li>");
    }
    return items.length ? "<ul class=\"publicacao-item-meta-list\">" + items.join("") + "</ul>" : "";
  }

  function buildOfertaPanel(oferta) {
    return (
      "<p class=\"publicacao-item-meta\"><strong>Por " + escapeHtml(oferta.parceiro) + "</strong></p>" +
      buildOfertaMeta(oferta) +
      (oferta.descricao ? "<p class=\"publicacao-item-desc\">" + escapeHtml(oferta.descricao) + "</p>" : "") +
      "<p class=\"publicacao-item-meta\"><strong>" + (Number(oferta.valorInscricaoBrl) === 0 ? "Gratuito" : formatBrl(oferta.valorInscricaoBrl)) + "</strong></p>" +
      "<div class=\"publicacao-item-actions\">" +
      (oferta.inscrito
        ? "<p class=\"oferta-inscrito\" role=\"status\">Inscrito</p>"
        : "<button type=\"button\" class=\"btn btn-small btn-inscrever\">" + labelInscricao(oferta) + "</button>") +
      "</div>"
    );
  }

  function buildInscricaoPanel(inscricao) {
    return (
      "<p class=\"publicacao-item-meta\"><strong>Por " + escapeHtml(inscricao.parceiro) + "</strong></p>" +
      buildOfertaMeta(inscricao) +
      (inscricao.descricao ? "<p class=\"publicacao-item-desc\">" + escapeHtml(inscricao.descricao) + "</p>" : "") +
      "<p class=\"publicacao-item-meta\"><strong>" + (Number(inscricao.valorInscricaoBrl) === 0 ? "Gratuito" : formatBrl(inscricao.valorInscricaoBrl)) + "</strong></p>" +
      "<div class=\"publicacao-item-actions\">" +
      "<p class=\"oferta-inscrito\" role=\"status\">" + escapeHtml(labelStatusInscricao(inscricao.inscricaoStatus)) + "</p>" +
      "<p class=\"inscricao-data\">Inscrito em " + ME_APP.formatDataPublicacao(inscricao.inscritoEm) + "</p>" +
      "</div>"
    );
  }

  function createAccordionItem(titulo, panelHtml, index, open) {
    var panelId = "oferta-panel-" + index;
    var li = document.createElement("li");
    li.className = "publicacao-item";
    if (open) li.classList.add("is-open");
    li.innerHTML =
      "<button type=\"button\" class=\"publicacao-item-toggle\" aria-expanded=\"" + (open ? "true" : "false") + "\" aria-controls=\"" + panelId + "\">" +
      "<span class=\"publicacao-item-titulo\">" + escapeHtml(titulo) + "</span>" +
      "<span class=\"publicacao-item-chevron\" aria-hidden=\"true\">▼</span>" +
      "</button>" +
      "<div class=\"publicacao-item-panel\" id=\"" + panelId + "\"" + (open ? "" : " hidden") + ">" +
      panelHtml +
      "</div>";
    ME_APP.bindPublicacaoAccordion(li);
    return li;
  }

  function emptyListMessage(message) {
    list.innerHTML = "<li class=\"publicacao-item publicacao-item-empty\">" + escapeHtml(message) + "</li>";
  }

  function labelStatusInscricao(status) {
    if (status === "paga") return "Inscrição confirmada";
    return "Inscrição registrada";
  }

  function renderInscricoes(inscricoes) {
    var alvo = alvoInscricoes();
    if (!alvo) return;
    alvo.innerHTML = "";
    if (!inscricoes.length) {
      renderMensagemInscricoes(alvo, mensagemListaVaziaInscricoes());
      return;
    }

    inscricoes.forEach(function (inscricao, index) {
      var li = createAccordionItem(
        inscricao.titulo,
        buildInscricaoPanel(inscricao),
        index,
        false
      );
      alvo.appendChild(li);
    });
  }

  function bindInscrever(li, oferta) {
    var btn = li.querySelector(".btn-inscrever");
    if (!btn) return;
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "Enviando…";
      ME_ANALYTICS.track("inscricao_submit", { oferta: oferta.titulo });

      fetch(apiBase + "/api/inscricoes", {
        method: "POST",
        headers: ME_APP.authJsonHeaders(),
        body: JSON.stringify({ ofertaId: oferta._id }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            ME_ANALYTICS.track("inscricao_sucesso", { oferta: oferta.titulo });
            showFeedback(result.data.message, "ok");
            oferta.inscrito = true;
            var ofertaId = ME_APP.normalizeId(oferta._id);
            if (ofertaId) inscritosIds.add(ofertaId);
            refreshListagemAtiva();
            return;
          }
          if (result.data && result.data.error && result.data.error.indexOf("já está inscrito") !== -1) {
            oferta.inscrito = true;
            var ofertaIdDup = ME_APP.normalizeId(oferta._id);
            if (ofertaIdDup) inscritosIds.add(ofertaIdDup);
            refreshListagemAtiva();
            return;
          }
          showFeedback(result.data.error || "Não foi possível inscrever.", "erro");
          btn.disabled = false;
          btn.textContent = labelInscricao(oferta);
        })
        .catch(function () {
          showFeedback("Erro de conexão. Tente novamente.", "erro");
          btn.disabled = false;
          btn.textContent = labelInscricao(oferta);
        });
    });
  }

  function renderOfertas(ofertas) {
    if (activeView !== "publicacoes" || !list) return;
    list.innerHTML = "";
    var visiveis = ME_APP.filtrarPublicacoesAbertas(ofertas, inscritosIds);
    if (!visiveis.length) {
      var vazio = "Nenhuma oferta disponível no momento.";
      if (tipoFiltro === "curso") vazio = "Nenhum curso disponível no momento.";
      if (tipoFiltro === "bem_estar") vazio = "Nenhuma oferta de bem-estar disponível no momento.";
      if (tipoFiltro === "evento") vazio = "Nenhuma atividade de comunidade disponível no momento.";
      emptyListMessage(vazio);
      return;
    }

    var abrirPrimeiro = !!destaqueId;
    visiveis.forEach(function (oferta, index) {
      var li = createAccordionItem(
        oferta.titulo,
        buildOfertaPanel(oferta),
        index,
        abrirPrimeiro && index === 0
      );
      bindInscrever(li, oferta);
      list.appendChild(li);
    });
  }

  var ofertasCache = [];
  var inscritosIds = new Set();
  var ofertasLoaded = false;
  var tabsInitialized = false;
  var inscricoesRequestId = 0;

  function coletarIdsInscricoes(inscricoes) {
    inscritosIds = new Set();
    (inscricoes || []).forEach(function (inscricao) {
      var id = ME_APP.normalizeId(inscricao.ofertaId || inscricao._id);
      if (id) inscritosIds.add(id);
    });
  }

  function refreshListagemAtiva() {
    if (activeView === "inscricoes") {
      loadInscricoes();
      return;
    }
    renderOfertas(ofertasCache);
  }

  function marcarOfertasInscritas(ofertas) {
    return (ofertas || []).map(function (oferta) {
      var id = ME_APP.normalizeId(oferta._id);
      var inscrito = !!oferta.inscrito || (id && inscritosIds.has(id));
      return Object.assign({}, oferta, { inscrito: inscrito });
    });
  }

  function loadPublicacoes() {
    activeView = "publicacoes";
    mostrarPainelPublicacoes();
    feedback.hidden = true;
    if (ofertasLoaded) {
      renderOfertas(ofertasCache);
      return;
    }
    fetchOfertas();
  }

  function loadInscricoes() {
    activeView = "inscricoes";
    mostrarPainelInscricoes();
    feedback.hidden = true;
    var alvo = alvoInscricoes();
    if (!alvo) return;

    var url = apiBase + "/api/inscricoes";
    if (tipoFiltro) {
      url += "?tipo=" + encodeURIComponent(tipoFiltro);
    }
    var requestId = ++inscricoesRequestId;
    renderMensagemInscricoes(alvo, "Carregando inscrições…");
    fetch(url, { headers: ME_APP.getAuthHeaders() })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (requestId !== inscricoesRequestId) return;
        if (activeView !== "inscricoes") return;
        if (!data.ok) {
          renderMensagemInscricoes(alvo, "Não foi possível carregar suas inscrições. Tente novamente.");
          return;
        }
        renderInscricoes(data.inscricoes || []);
      })
      .catch(function () {
        if (requestId !== inscricoesRequestId) return;
        if (activeView !== "inscricoes") return;
        renderMensagemInscricoes(alvo, "Não foi possível carregar suas inscrições. Tente novamente.");
      });
  }

  function iniciarTabs() {
    if (tabsInitialized) return;
    tabsInitialized = true;
    ME_APP.initPilarViewTabs({
      hide: !!destaqueId,
      publicacoesPanelId: "publicacoes-panel",
      inscricoesPanelId: "inscricoes-panel",
      onPublicacoes: loadPublicacoes,
      onInscricoes: loadInscricoes,
    });
  }

  function fetchOfertas() {
    var apiUrl = apiBase + "/api/marketplace/ofertas";
    if (tipoFiltro && !destaqueId) {
      apiUrl += "?tipo=" + encodeURIComponent(tipoFiltro);
    }

    var inscricoesUrl = apiBase + "/api/inscricoes";
    if (tipoFiltro && !destaqueId) {
      inscricoesUrl += "?tipo=" + encodeURIComponent(tipoFiltro);
    }

    var authHeaders = ME_APP.getAuthHeaders();
    Promise.all([
      fetch(apiUrl, { headers: authHeaders }).then(function (response) { return response.json(); }),
      fetch(inscricoesUrl, { headers: authHeaders }).then(function (response) { return response.json(); }),
    ])
      .then(function (results) {
        var data = results[0];
        var inscData = results[1];
        if (!data.ok) {
          showFeedback("Não foi possível carregar as ofertas.", "erro");
          return;
        }
        if (inscData.ok) {
          coletarIdsInscricoes(inscData.inscricoes);
        }

        var ofertas = marcarOfertasInscritas(data.ofertas || []);
        if (destaqueId) {
          ofertas = ofertas.filter(function (oferta) {
            return ME_APP.sameId(oferta._id, destaqueId);
          });
          if (!ofertas.length) {
            showFeedback("Esta oportunidade não está mais disponível.", "erro");
            list.innerHTML = "";
            return;
          }
          var destaque = ofertas[0];
          if (destaque.inscrito || inscritosIds.has(ME_APP.normalizeId(destaque._id))) {
            showFeedback("Você já está inscrito nesta oportunidade. Consulte «Minhas inscrições».", "ok");
            list.innerHTML = "";
            return;
          }
          if (ME_APP.isPublicacaoExpirada(destaque)) {
            showFeedback("Esta oportunidade não está mais disponível para inscrição.", "erro");
            list.innerHTML = "";
            return;
          }
          if (!tipoFiltro && ofertas[0] && ofertas[0].tipo) {
            aplicarTituloPagina(ofertas[0].tipo);
          }
        }
        ofertasCache = ofertas;
        ofertasLoaded = true;
        if (destaqueId) {
          var pubPanel = document.getElementById("publicacoes-panel");
          if (pubPanel) pubPanel.hidden = false;
          renderOfertas(ofertasCache);
          return;
        }
        if (!tabsInitialized) {
          iniciarTabs();
        } else if (activeView === "publicacoes") {
          renderOfertas(ofertasCache);
        }
      })
      .catch(function () {
        showFeedback("Não foi possível carregar as ofertas.", "erro");
      });
  }

  fetchOfertas();
})();

(function () {
  var INTENCAO_KEY = "me_comunidade_intencao";
  var VISTOS_KEY = "me_comunidade_vistos";

  var INTENCOES = [
    { id: "amizade", label: "Amizade", obrigatorio: true },
    { id: "namoro", label: "Namoro", obrigatorio: false },
  ];

  var PESSOAS = [
    {
      id: "ana",
      nome: "Ana Ribeiro",
      idade: 58,
      cidade: "Porto Alegre · RS",
      distancia: "3 km",
      bio: "Gosto de caminhar no Parque da Redenção e conversar sem pressa.",
      intencoes: ["amizade"],
      interesses: ["Caminhada", "Café"],
      iniciais: "AR",
    },
    {
      id: "carlos",
      nome: "Carlos Mendes",
      idade: 62,
      cidade: "Canoas · RS",
      distancia: "12 km",
      bio: "Aposentado recente. Quero conhecer gente nova para sair e trocar ideias.",
      intencoes: ["amizade", "namoro"],
      interesses: ["Música", "Cinema"],
      iniciais: "CM",
    },
    {
      id: "helena",
      nome: "Helena Costa",
      idade: 55,
      cidade: "Porto Alegre · RS",
      distancia: "5 km",
      bio: "Aberta a amizade e, se rolar química, namoro — sempre no meu ritmo.",
      intencoes: ["amizade", "namoro"],
      interesses: ["Dança", "Livros"],
      iniciais: "HC",
    },
    {
      id: "paulo",
      nome: "Paulo Ferreira",
      idade: 67,
      cidade: "São Leopoldo · RS",
      distancia: "28 km",
      bio: "Procuro companhia para conversar e eventualmente um grupo local.",
      intencoes: ["amizade"],
      interesses: ["História", "Trilha"],
      iniciais: "PF",
    },
    {
      id: "lucia",
      nome: "Lúcia Andrade",
      idade: 60,
      cidade: "Porto Alegre · RS",
      distancia: "7 km",
      bio: "Viúva há dois anos. Quero recomeçar com leveza — amizade primeiro.",
      intencoes: ["amizade", "namoro"],
      interesses: ["Jardinagem", "Teatro"],
      iniciais: "LA",
    },
    {
      id: "mario",
      nome: "Mário Souza",
      idade: 64,
      cidade: "Viamão · RS",
      distancia: "18 km",
      bio: "Bom papo, humor leve e vontade de conhecer a cidade com alguém.",
      intencoes: ["amizade"],
      interesses: ["Fotografia", "Feiras"],
      iniciais: "MS",
    },
    {
      id: "sonia",
      nome: "Sônia Prado",
      idade: 56,
      cidade: "Porto Alegre · RS",
      distancia: "4 km",
      bio: "Prefiro conhecer pessoas perto de mim, sem pressa e com respeito.",
      intencoes: ["namoro", "amizade"],
      interesses: ["Yoga", "Culinária"],
      iniciais: "SP",
    },
  ];

  var TIPO_LABEL = { interesse: "Interesse", encontros: "Encontros" };

  var destinoAtual = ME_APP.getCurrentPageDestino();
  var sessao = ME_APP.ensureSession50(ME_APP.buildAuthUrl("entrar_50.html", destinoAtual));
  if (!sessao) return;

  var feedback = document.getElementById("feedback");
  var intencaoChips = document.getElementById("intencao-chips");
  var descobertaRoot = document.getElementById("descoberta-root");
  var gruposMeusList = document.getElementById("grupos-meus-list");
  var gruposDescobrirList = document.getElementById("grupos-descobrir-list");
  var grupoDetalhe = document.getElementById("grupo-detalhe");
  var viewMeus = document.getElementById("grupos-view-meus");
  var viewDescobrir = document.getElementById("grupos-view-descobrir");
  var viewDetalhe = document.getElementById("grupos-view-detalhe");
  var btnDescobrirGrupos = document.getElementById("btn-descobrir-grupos");
  var btnVoltarMeusGrupos = document.getElementById("btn-voltar-meus-grupos");
  var btnVoltarGrupoDetalhe = document.getElementById("btn-voltar-grupo-detalhe");
  var btnAbrirCriarGrupo = document.getElementById("btn-abrir-criar-grupo");
  var btnCancelarCriarGrupo = document.getElementById("btn-cancelar-criar-grupo");
  var formCriarGrupo = document.getElementById("form-criar-grupo");
  var tabs = document.getElementById("comunidade-tabs");

  var apiBase = ME_APP.getApiBase();
  var intencoesAtivas = loadIntencoes();
  var vistos = loadVistos();
  var fila = [];
  var indiceAtual = 0;
  var gruposView = "meus";
  var grupoAbertoId = null;
  var meusGruposCache = [];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadIntencoes() {
    try {
      var raw = localStorage.getItem(INTENCAO_KEY);
      var list = raw ? JSON.parse(raw) : ["amizade"];
      if (!Array.isArray(list) || !list.length) list = ["amizade"];
      if (list.indexOf("amizade") === -1) list.unshift("amizade");
      return list;
    } catch (error) {
      return ["amizade"];
    }
  }

  function saveIntencoes() {
    try {
      localStorage.setItem(INTENCAO_KEY, JSON.stringify(intencoesAtivas));
    } catch (error) {}
  }

  function loadVistos() {
    try {
      var raw = localStorage.getItem(VISTOS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function saveVistos() {
    try {
      localStorage.setItem(VISTOS_KEY, JSON.stringify(vistos));
    } catch (error) {}
  }

  function apiFetch(path, options) {
    var opts = options || {};
    var config = { method: opts.method || "GET", headers: ME_APP.authJsonHeaders() };
    if (opts.body) config.body = JSON.stringify(opts.body);
    return fetch(apiBase + path, config).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
    });
  }

  function tipoLabel(tipo) {
    return TIPO_LABEL[tipo] || "Comunidade";
  }

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
  }

  function labelIntencao(id) {
    var found = INTENCOES.filter(function (item) {
      return item.id === id;
    })[0];
    return found ? found.label : id;
  }

  function rebuildFila() {
    fila = PESSOAS.filter(function (pessoa) {
      if (vistos.indexOf(pessoa.id) !== -1) return false;
      return pessoa.intencoes.some(function (intent) {
        return intencoesAtivas.indexOf(intent) !== -1;
      });
    });
    indiceAtual = 0;
  }

  function renderIntencoes() {
    if (!intencaoChips) return;
    intencaoChips.innerHTML = INTENCOES.map(function (item) {
      var active = intencoesAtivas.indexOf(item.id) !== -1;
      return (
        '<button type="button" class="comunidade-chip' +
        (active ? " is-active" : "") +
        '" data-intencao="' +
        escapeHtml(item.id) +
        '" aria-pressed="' +
        (active ? "true" : "false") +
        '">' +
        escapeHtml(item.label) +
        (item.obrigatorio ? "" : ' <span class="comunidade-chip-opt">opcional</span>') +
        "</button>"
      );
    }).join("");

    intencaoChips.querySelectorAll("[data-intencao]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-intencao");
        var idx = intencoesAtivas.indexOf(id);
        if (idx !== -1) {
          if (id === "amizade") {
            showFeedback("Amizade fica sempre disponível. Você pode só acrescentar namoro.", "ok");
            return;
          }
          intencoesAtivas.splice(idx, 1);
        } else {
          intencoesAtivas.push(id);
        }
        saveIntencoes();
        rebuildFila();
        renderIntencoes();
        renderDescoberta();
        ME_ANALYTICS.track("comunidade_intencao", { intencoes: intencoesAtivas.slice() });
      });
    });
  }

  function pessoaAtual() {
    return fila[indiceAtual] || null;
  }

  function renderDescoberta() {
    if (!descobertaRoot) return;
    var pessoa = pessoaAtual();

    if (!pessoa) {
      descobertaRoot.innerHTML =
        '<div class="comunidade-descoberta-empty">' +
        "<p><strong>Por agora é isso.</strong></p>" +
        "<p>Não há mais perfis com este filtro perto de você. Volte mais tarde ou ajuste amizade/namoro.</p>" +
        '<button type="button" class="btn btn-secondary" id="btn-reiniciar-descoberta">Ver perfis de novo</button>' +
        "</div>";
      var reiniciar = document.getElementById("btn-reiniciar-descoberta");
      if (reiniciar) {
        reiniciar.addEventListener("click", function () {
          vistos = [];
          saveVistos();
          rebuildFila();
          renderDescoberta();
          ME_ANALYTICS.track("comunidade_descoberta_reiniciar", {});
        });
      }
      return;
    }

    var intentsHtml = pessoa.intencoes
      .map(function (intent) {
        return (
          '<span class="comunidade-pessoa-pill">' + escapeHtml(labelIntencao(intent)) + "</span>"
        );
      })
      .join("");

    var interessesHtml = (pessoa.interesses || [])
      .map(function (item) {
        return '<span class="comunidade-interesse">' + escapeHtml(item) + "</span>";
      })
      .join("");

    descobertaRoot.innerHTML =
      '<article class="comunidade-card-descoberta" aria-label="Perfil para descobrir">' +
      '<div class="comunidade-card-avatar" aria-hidden="true">' +
      escapeHtml(pessoa.iniciais) +
      "</div>" +
      '<p class="comunidade-card-nome">' +
      escapeHtml(pessoa.nome) +
      ", " +
      escapeHtml(String(pessoa.idade)) +
      "</p>" +
      '<p class="comunidade-card-local">' +
      escapeHtml(pessoa.cidade) +
      " · a " +
      escapeHtml(pessoa.distancia) +
      "</p>" +
      '<p class="comunidade-card-bio">' +
      escapeHtml(pessoa.bio) +
      "</p>" +
      '<div class="comunidade-card-pills">' +
      intentsHtml +
      "</div>" +
      (interessesHtml
        ? '<div class="comunidade-card-interesses">' + interessesHtml + "</div>"
        : "") +
      '<p class="comunidade-card-ritmo">No seu ritmo — sem obrigação de responder na hora.</p>' +
      '<div class="comunidade-card-acoes">' +
      '<button type="button" class="btn btn-secondary" id="btn-agora-nao">Agora não</button>' +
      '<button type="button" class="btn" id="btn-quero-conhecer">Quero conhecer</button>' +
      "</div>" +
      '<p class="comunidade-card-progresso">' +
      (indiceAtual + 1) +
      " de " +
      fila.length +
      "</p>" +
      "</article>";

    document.getElementById("btn-agora-nao").addEventListener("click", function () {
      decidir("passar", pessoa);
    });
    document.getElementById("btn-quero-conhecer").addEventListener("click", function () {
      decidir("conhecer", pessoa);
    });
  }

  function decidir(acao, pessoa) {
    if (vistos.indexOf(pessoa.id) === -1) {
      vistos.push(pessoa.id);
      saveVistos();
    }
    ME_ANALYTICS.track("comunidade_descoberta_acao", {
      acao: acao,
      pessoaId: pessoa.id,
      intencoes: intencoesAtivas.slice(),
    });

    if (acao === "conhecer") {
      showFeedback(
        "Interesse registrado em " +
          pessoa.nome +
          ". Se houver reciprocidade, a conversa começa com mediação segura — sem pressão.",
        "ok"
      );
    }

    rebuildFila();
    renderDescoberta();
  }

  function setGruposView(view, grupoId) {
    gruposView = view || "meus";
    grupoAbertoId = grupoId || null;
    if (viewMeus) viewMeus.hidden = gruposView !== "meus";
    if (viewDescobrir) viewDescobrir.hidden = gruposView !== "descobrir";
    if (viewDetalhe) viewDetalhe.hidden = gruposView !== "detalhe";
    renderGrupos();
  }

  function metaGrupo(grupo) {
    var partes = [];
    if (grupo.cidade) partes.push(grupo.cidade);
    partes.push(grupo.membros + (grupo.membros === 1 ? " membro" : " membros"));
    return partes.join(" · ");
  }

  function cardGrupoHtml(grupo, modo) {
    var badge = tipoLabel(grupo.tipo);
    if (grupo.papel === "admin") badge = "Criador";
    var acao =
      modo === "meus"
        ? '<button type="button" class="btn btn-small" data-abrir-grupo="' +
          escapeHtml(grupo.id) +
          '">Abrir</button>'
        : '<button type="button" class="btn btn-small" data-entrar-grupo="' +
          escapeHtml(grupo.id) +
          '">Participar</button>';
    return (
      '<li class="comunidade-grupo-card' +
      (modo === "meus" ? " is-member" : "") +
      '">' +
      '<div class="comunidade-grupo-top">' +
      '<h3 class="comunidade-grupo-titulo">' +
      escapeHtml(grupo.titulo) +
      "</h3>" +
      '<span class="comunidade-grupo-badge">' +
      escapeHtml(badge) +
      "</span>" +
      "</div>" +
      '<p class="comunidade-grupo-meta">' +
      escapeHtml(metaGrupo(grupo)) +
      "</p>" +
      (grupo.descricao
        ? '<p class="comunidade-grupo-desc">' + escapeHtml(grupo.descricao) + "</p>"
        : "") +
      '<div class="comunidade-grupo-actions">' +
      acao +
      "</div>" +
      "</li>"
    );
  }

  function renderMeusGrupos() {
    if (!gruposMeusList) return;
    gruposMeusList.innerHTML = '<li class="comunidade-empty">Carregando suas comunidades…</li>';

    apiFetch("/api/comunidades/minhas")
      .then(function (result) {
        if (!result.ok) {
          gruposMeusList.innerHTML =
            '<li class="comunidade-empty">Não foi possível carregar suas comunidades.</li>';
          return;
        }
        meusGruposCache = result.data.comunidades || [];
        if (!meusGruposCache.length) {
          gruposMeusList.innerHTML =
            '<li class="comunidade-empty">' +
            "Você ainda não participa de nenhuma comunidade. Use <strong>Descobrir comunidades</strong> ou <strong>Criar comunidade</strong> para começar." +
            "</li>";
          return;
        }
        gruposMeusList.innerHTML = meusGruposCache
          .map(function (grupo) {
            return cardGrupoHtml(grupo, "meus");
          })
          .join("");
        gruposMeusList.querySelectorAll("[data-abrir-grupo]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.getAttribute("data-abrir-grupo");
            ME_ANALYTICS.track("comunidade_abrir_grupo", { grupoId: id });
            setGruposView("detalhe", id);
          });
        });
      })
      .catch(function () {
        gruposMeusList.innerHTML =
          '<li class="comunidade-empty">Erro de conexão ao carregar comunidades.</li>';
      });
  }

  function renderDescobrirGrupos() {
    if (!gruposDescobrirList) return;
    gruposDescobrirList.innerHTML =
      '<li class="comunidade-empty">Procurando comunidades abertas…</li>';

    apiFetch("/api/comunidades/descobrir")
      .then(function (result) {
        if (!result.ok) {
          gruposDescobrirList.innerHTML =
            '<li class="comunidade-empty">Não foi possível carregar as comunidades.</li>';
          return;
        }
        var novos = result.data.comunidades || [];
        if (!novos.length) {
          gruposDescobrirList.innerHTML =
            '<li class="comunidade-empty">Nenhuma comunidade aberta nova por agora. Que tal <strong>criar a sua</strong>?</li>';
          return;
        }
        gruposDescobrirList.innerHTML = novos
          .map(function (grupo) {
            return cardGrupoHtml(grupo, "descobrir");
          })
          .join("");
        gruposDescobrirList.querySelectorAll("[data-entrar-grupo]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.getAttribute("data-entrar-grupo");
            entrarGrupo(id, null, btn);
          });
        });
      })
      .catch(function () {
        gruposDescobrirList.innerHTML =
          '<li class="comunidade-empty">Erro de conexão ao carregar comunidades.</li>';
      });
  }

  function entrarGrupo(id, codigo, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Entrando…";
    }
    apiFetch("/api/comunidades/" + encodeURIComponent(id) + "/entrar", {
      method: "POST",
      body: codigo ? { codigo: codigo } : {},
    })
      .then(function (result) {
        if (!result.ok) {
          showFeedback((result.data && result.data.error) || "Não foi possível entrar.", "erro");
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Participar";
          }
          return;
        }
        ME_ANALYTICS.track("comunidade_entrar_grupo", { grupoId: id });
        showFeedback("Você entrou na comunidade. Ela agora aparece em Minhas comunidades.", "ok");
        setGruposView("detalhe", id);
      })
      .catch(function () {
        showFeedback("Erro de conexão ao entrar na comunidade.", "erro");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Participar";
        }
      });
  }

  function membrosHtml(membros) {
    if (!membros || !membros.length) {
      return '<p class="comunidade-empty">Ainda não há membros visíveis nesta comunidade.</p>';
    }
    return (
      '<ul class="comunidade-grupo-membros">' +
      membros
        .map(function (pessoa) {
          var papel = pessoa.papel === "admin" ? " · Criador" : "";
          return (
            '<li class="comunidade-grupo-membro">' +
            '<div class="comunidade-grupo-membro-avatar" aria-hidden="true">' +
            escapeHtml(pessoa.iniciais) +
            "</div>" +
            '<div class="comunidade-grupo-membro-body">' +
            '<p class="comunidade-grupo-membro-nome">' +
            escapeHtml(pessoa.nome) +
            "</p>" +
            '<p class="comunidade-grupo-membro-cidade">' +
            escapeHtml(pessoa.cidade || "") +
            escapeHtml(papel) +
            "</p>" +
            "</div>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderGrupoDetalhe() {
    if (!grupoDetalhe) return;
    if (!grupoAbertoId) {
      setGruposView("meus");
      return;
    }
    grupoDetalhe.innerHTML = '<p class="comunidade-empty">Carregando comunidade…</p>';

    apiFetch("/api/comunidades/" + encodeURIComponent(grupoAbertoId))
      .then(function (result) {
        if (!result.ok) {
          grupoDetalhe.innerHTML =
            '<p class="comunidade-empty">' +
            escapeHtml((result.data && result.data.error) || "Comunidade não encontrada.") +
            "</p>";
          return;
        }
        var grupo = result.data.comunidade;
        var membros = result.data.membros || [];
        var ehMembro = !!grupo.papel;
        var ehAdmin = grupo.papel === "admin";

        var acoesHtml = "";
        if (ehMembro) {
          acoesHtml =
            '<button type="button" class="btn btn-small" id="btn-convidar-grupo">Convidar pessoas</button>' +
            (ehAdmin
              ? '<button type="button" class="btn btn-small btn-danger" id="btn-excluir-grupo">Excluir comunidade</button>'
              : '<button type="button" class="btn btn-small btn-secondary" id="btn-sair-grupo">Sair da comunidade</button>');
        } else {
          acoesHtml =
            '<button type="button" class="btn btn-small" id="btn-entrar-grupo-detalhe">Participar</button>';
        }

        grupoDetalhe.innerHTML =
          '<div class="comunidade-grupo-detalhe-cabecalho">' +
          '<p class="comunidade-grupo-badge">' +
          escapeHtml(tipoLabel(grupo.tipo)) +
          "</p>" +
          "<h3>" +
          escapeHtml(grupo.titulo) +
          "</h3>" +
          '<p class="comunidade-grupo-meta">' +
          escapeHtml(metaGrupo(grupo)) +
          "</p>" +
          (grupo.descricao
            ? '<p class="comunidade-grupo-desc">' + escapeHtml(grupo.descricao) + "</p>"
            : "") +
          '<div class="comunidade-grupo-actions">' +
          acoesHtml +
          "</div>" +
          "</div>" +
          '<div id="convite-box" class="comunidade-convite" hidden></div>' +
          '<h4 class="comunidade-grupo-membros-title">Membros (' +
          membros.length +
          ")</h4>" +
          membrosHtml(membros);

        ligarAcoesDetalhe(grupo);
      })
      .catch(function () {
        grupoDetalhe.innerHTML =
          '<p class="comunidade-empty">Erro de conexão ao carregar a comunidade.</p>';
      });
  }

  function ligarAcoesDetalhe(grupo) {
    var btnEntrar = document.getElementById("btn-entrar-grupo-detalhe");
    if (btnEntrar) {
      btnEntrar.addEventListener("click", function () {
        entrarGrupo(grupo.id, null, btnEntrar);
      });
    }

    var btnSair = document.getElementById("btn-sair-grupo");
    if (btnSair) {
      btnSair.addEventListener("click", function () {
        if (!window.confirm("Deseja sair desta comunidade?")) return;
        apiFetch("/api/comunidades/" + encodeURIComponent(grupo.id) + "/sair", { method: "POST" })
          .then(function (result) {
            if (!result.ok) {
              showFeedback((result.data && result.data.error) || "Não foi possível sair.", "erro");
              return;
            }
            showFeedback("Você saiu da comunidade.", "ok");
            setGruposView("meus");
          })
          .catch(function () {
            showFeedback("Erro de conexão ao sair da comunidade.", "erro");
          });
      });
    }

    var btnExcluir = document.getElementById("btn-excluir-grupo");
    if (btnExcluir) {
      btnExcluir.addEventListener("click", function () {
        if (!window.confirm("Excluir a comunidade para todos os membros? Esta ação não pode ser desfeita.")) {
          return;
        }
        apiFetch("/api/comunidades/" + encodeURIComponent(grupo.id), { method: "DELETE" })
          .then(function (result) {
            if (!result.ok) {
              showFeedback((result.data && result.data.error) || "Não foi possível excluir.", "erro");
              return;
            }
            showFeedback("Comunidade excluída.", "ok");
            setGruposView("meus");
          })
          .catch(function () {
            showFeedback("Erro de conexão ao excluir a comunidade.", "erro");
          });
      });
    }

    var btnConvidar = document.getElementById("btn-convidar-grupo");
    if (btnConvidar) {
      btnConvidar.addEventListener("click", function () {
        btnConvidar.disabled = true;
        btnConvidar.textContent = "Gerando…";
        apiFetch("/api/comunidades/" + encodeURIComponent(grupo.id) + "/convite", { method: "POST" })
          .then(function (result) {
            btnConvidar.disabled = false;
            btnConvidar.textContent = "Convidar pessoas";
            if (!result.ok) {
              showFeedback(
                (result.data && result.data.error) || "Não foi possível gerar o convite.",
                "erro"
              );
              return;
            }
            renderConvite(grupo, result.data.codigo);
          })
          .catch(function () {
            btnConvidar.disabled = false;
            btnConvidar.textContent = "Convidar pessoas";
            showFeedback("Erro de conexão ao gerar o convite.", "erro");
          });
      });
    }
  }

  function conviteLink(codigo) {
    return window.location.origin + "/cadastro_50.html?c=" + encodeURIComponent(codigo);
  }

  function renderConvite(grupo, codigo) {
    var box = document.getElementById("convite-box");
    if (!box) return;
    var link = conviteLink(codigo);
    var mensagem =
      "Convido você para a comunidade \"" +
      grupo.titulo +
      "\" no Mais Experiência (50+). Entre por aqui: " +
      link;
    var whats = "https://wa.me/?text=" + encodeURIComponent(mensagem);
    var mailto =
      "mailto:?subject=" +
      encodeURIComponent("Convite: " + grupo.titulo) +
      "&body=" +
      encodeURIComponent(mensagem);
    var qr =
      "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" +
      encodeURIComponent(link);

    box.hidden = false;
    box.innerHTML =
      '<p class="comunidade-convite-titulo">Convide pessoas para esta comunidade</p>' +
      '<p class="comunidade-convite-codigo">Código: <strong>' +
      escapeHtml(codigo) +
      "</strong></p>" +
      '<div class="comunidade-convite-linkrow">' +
      '<input type="text" class="comunidade-convite-input" id="convite-link" readonly value="' +
      escapeHtml(link) +
      '">' +
      '<button type="button" class="btn btn-small" id="btn-copiar-convite">Copiar link</button>' +
      "</div>" +
      '<div class="comunidade-convite-acoes">' +
      '<a class="btn btn-small btn-secondary" href="' +
      escapeHtml(whats) +
      '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a class="btn btn-small btn-secondary" href="' +
      escapeHtml(mailto) +
      '">E-mail</a>' +
      "</div>" +
      '<img class="comunidade-convite-qr" src="' +
      escapeHtml(qr) +
      '" alt="QR code do convite" width="180" height="180">';

    var btnCopiar = document.getElementById("btn-copiar-convite");
    if (btnCopiar) {
      btnCopiar.addEventListener("click", function () {
        var input = document.getElementById("convite-link");
        function feedbackCopiado() {
          btnCopiar.textContent = "Copiado!";
          setTimeout(function () {
            btnCopiar.textContent = "Copiar link";
          }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(feedbackCopiado, function () {
            if (input) input.select();
          });
        } else if (input) {
          input.select();
          try {
            document.execCommand("copy");
            feedbackCopiado();
          } catch (error) {}
        }
      });
    }
    ME_ANALYTICS.track("comunidade_convite_gerado", { grupoId: grupo.id });
  }

  function renderGrupos() {
    if (gruposView === "descobrir") {
      renderDescobrirGrupos();
      return;
    }
    if (gruposView === "detalhe") {
      renderGrupoDetalhe();
      return;
    }
    renderMeusGrupos();
  }

  function setTab(tabId) {
    var panels = {
      descobrir: document.getElementById("panel-descobrir"),
      grupos: document.getElementById("panel-grupos"),
      encontros: document.getElementById("panel-encontros"),
      pessoas: document.getElementById("panel-descobrir"),
      circulos: document.getElementById("panel-grupos"),
    };

    var resolved =
      tabId === "pessoas" ? "descobrir" : tabId === "circulos" ? "grupos" : tabId;

    ["descobrir", "grupos", "encontros"].forEach(function (key) {
      var panel = panels[key];
      if (!panel) return;
      panel.hidden = key !== resolved;
    });

    if (tabs) {
      tabs.querySelectorAll("[data-tab]").forEach(function (btn) {
        var active = btn.getAttribute("data-tab") === resolved;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    if (resolved === "grupos") {
      setGruposView("meus");
    }

    try {
      var url = new URL(window.location.href);
      if (resolved === "descobrir") url.searchParams.delete("aba");
      else url.searchParams.set("aba", resolved);
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) {}

    ME_ANALYTICS.track("comunidade_aba", { aba: resolved });
  }

  function initTabs() {
    if (!tabs) return;
    tabs.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.getAttribute("data-tab"));
      });
    });

    var destaqueId = ME_APP.getQueryParam("id");
    var abaQuery = (ME_APP.getQueryParam("aba") || "").toLowerCase();
    if (destaqueId || abaQuery === "encontros") {
      setTab("encontros");
    } else if (abaQuery === "grupos" || abaQuery === "circulos") {
      setTab("grupos");
    } else {
      setTab("descobrir");
    }
  }

  if (btnDescobrirGrupos) {
    btnDescobrirGrupos.addEventListener("click", function () {
      ME_ANALYTICS.track("comunidade_descobrir_grupos", {});
      setGruposView("descobrir");
    });
  }
  if (btnVoltarMeusGrupos) {
    btnVoltarMeusGrupos.addEventListener("click", function () {
      setGruposView("meus");
    });
  }
  if (btnVoltarGrupoDetalhe) {
    btnVoltarGrupoDetalhe.addEventListener("click", function () {
      setGruposView("meus");
    });
  }

  function toggleCriarForm(show) {
    if (!formCriarGrupo) return;
    formCriarGrupo.hidden = !show;
    if (show) {
      var titulo = document.getElementById("grupo-titulo");
      if (titulo) titulo.focus();
    }
  }

  if (btnAbrirCriarGrupo) {
    btnAbrirCriarGrupo.addEventListener("click", function () {
      toggleCriarForm(formCriarGrupo && formCriarGrupo.hidden);
    });
  }
  if (btnCancelarCriarGrupo) {
    btnCancelarCriarGrupo.addEventListener("click", function () {
      toggleCriarForm(false);
    });
  }
  if (formCriarGrupo) {
    formCriarGrupo.addEventListener("submit", function (event) {
      event.preventDefault();
      var btnSalvar = document.getElementById("btn-salvar-grupo");
      var payload = {
        titulo: formCriarGrupo.titulo.value.trim(),
        descricao: formCriarGrupo.descricao.value.trim(),
        tipo: formCriarGrupo.tipo.value,
        cidade: formCriarGrupo.cidade.value.trim(),
        visibilidade: formCriarGrupo.visibilidade.value,
      };
      if (payload.titulo.length < 3) {
        showFeedback("Dê um nome com pelo menos 3 letras à comunidade.", "erro");
        return;
      }
      if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Criando…";
      }
      apiFetch("/api/comunidades", { method: "POST", body: payload })
        .then(function (result) {
          if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.textContent = "Criar comunidade";
          }
          if (!result.ok) {
            showFeedback(
              (result.data && result.data.error) || "Não foi possível criar a comunidade.",
              "erro"
            );
            return;
          }
          ME_ANALYTICS.track("comunidade_criar_grupo", { tipo: payload.tipo });
          formCriarGrupo.reset();
          toggleCriarForm(false);
          showFeedback("Comunidade criada! Convide pessoas para participar.", "ok");
          setGruposView("detalhe", result.data.comunidade.id);
        })
        .catch(function () {
          if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.textContent = "Criar comunidade";
          }
          showFeedback("Erro de conexão ao criar a comunidade.", "erro");
        });
    });
  }

  function processarConviteUrl() {
    var codigo = (ME_APP.getQueryParam("c") || "").trim().toUpperCase();
    if (!codigo) return;
    apiFetch("/api/convites/" + encodeURIComponent(codigo))
      .then(function (result) {
        if (!result.ok || !result.data.convite) {
          showFeedback("Convite inválido ou expirado.", "erro");
          return;
        }
        var convite = result.data.convite;
        entrarGrupo(convite.comunidadeId, codigo, null);
        setTab("grupos");
        try {
          var url = new URL(window.location.href);
          url.searchParams.delete("c");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        } catch (error) {}
      })
      .catch(function () {});
  }

  rebuildFila();
  renderIntencoes();
  renderDescoberta();
  renderGrupos();
  initTabs();
  processarConviteUrl();

  ME_ANALYTICS.track("comunidade_50_visita", { page: "comunidade_50" });
})();

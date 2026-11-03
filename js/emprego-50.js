(function () {
      var destaqueId = ME_APP.getQueryParam("id");
      var destinoAtual = ME_APP.getCurrentPageDestino();
      var sessao = ME_APP.ensureSession50();
      if (!sessao) return;

      var apiBase = ME_APP.getApiBase();
      var list = document.getElementById("vaga-list");
      var inscricoesList = document.getElementById("inscricoes-list");
      var feedback = document.getElementById("feedback");
      var pageTitle = document.getElementById("page-title");
      var pageLead = document.getElementById("page-lead");
      var backLink = document.getElementById("back-link");
      var publicacoesPanel = document.getElementById("publicacoes-panel");
      var inscricoesPanel = document.getElementById("inscricoes-panel");
      var interessesSection = document.getElementById("interesses-section");
      var vagasSection = document.getElementById("vagas-section");

      if (destaqueId) {
        backLink.href = "index.html#destaques";
        backLink.textContent = "← Voltar ao destaque";
        pageTitle.textContent = "Vaga em destaque";
        pageLead.textContent = "Confira os detalhes e candidate-se à oportunidade selecionada.";
      }

      if (destaqueId && publicacoesPanel) {
        publicacoesPanel.hidden = false;
        if (interessesSection) interessesSection.hidden = true;
        if (vagasSection) vagasSection.open = true;
      }

      ME_ANALYTICS.track("emprego_50_visita", { page: "emprego_50", destaqueId: destaqueId || null });

      function renderChecklist(steps) {
        var ul = document.getElementById("hub-checklist");
        if (!ul) return;
        ul.innerHTML = steps
          .map(function (step) {
            return (
              '<li class="hub-checklist-item' + (step.done ? " is-done" : "") + '">' +
              '<span class="hub-checklist-marker" aria-hidden="true">' + (step.done ? "✓" : String(step.num)) + "</span>" +
              '<div class="hub-checklist-body">' +
              '<p class="hub-checklist-title">' + step.title + "</p>" +
              '<p class="hub-checklist-text">' + step.text + "</p>" +
              (step.done
                ? '<p class="hub-checklist-done">Concluído</p>'
                : '<a class="hub-checklist-link link-inline" href="' + step.href + '">' + step.linkLabel + "</a>") +
              "</div></li>"
            );
          })
          .join("");
      }

      function loadProximosPassos() {
        var box = document.getElementById("vagas-proximos-passos");
        if (!box) return;
        if (destaqueId) {
          box.hidden = true;
          return;
        }

        var fallbackSteps = [
          {
            num: 1,
            title: "Complete seu currículo",
            text: "Com o perfil preenchido, fica mais fácil encontrar vagas alinhadas a você.",
            href: "meu_curriculo_50.html",
            linkLabel: "Ir ao currículo",
            done: false,
          },
          {
            num: 2,
            title: "Escolha áreas de interesse",
            text: "Assim mostramos só as vagas que fazem sentido para o seu momento.",
            href: "#interesses-section",
            linkLabel: "Escolher áreas",
            done: false,
          },
          {
            num: 3,
            title: "Faça sua 1.ª candidatura",
            text: "O primeiro passo já conta — candidate-se a uma vaga alinhada ao seu perfil.",
            href: "#vagas-section",
            linkLabel: "Ver vagas",
            done: false,
          },
        ];

        Promise.all([
          fetch(apiBase + "/api/contas/curriculo", { headers: ME_APP.getAuthHeaders() }).then(function (r) {
            return r.json();
          }),
          fetch(apiBase + "/api/contas/interesses", { headers: ME_APP.getAuthHeaders() }).then(function (r) {
            return r.json();
          }),
          fetch(apiBase + "/api/candidaturas", { headers: ME_APP.getAuthHeaders() }).then(function (r) {
            return r.json();
          }),
        ])
          .then(function (results) {
            var curriculo = results[0];
            var interesses = results[1];
            var candidaturas = results[2];
            var hasPerfil =
              curriculo.ok && curriculo.curriculo && curriculo.curriculo.hasPerfil;
            var hasInteresses =
              interesses.ok && interesses.areasInteresse && interesses.areasInteresse.length > 0;
            var hasCandidatura =
              candidaturas.ok &&
              candidaturas.candidaturas &&
              candidaturas.candidaturas.length > 0;

            renderChecklist([
              Object.assign({}, fallbackSteps[0], { done: hasPerfil }),
              Object.assign({}, fallbackSteps[1], { done: hasInteresses }),
              Object.assign({}, fallbackSteps[2], { done: hasCandidatura }),
            ]);
          })
          .catch(function () {
            renderChecklist(fallbackSteps);
          });
      }

      loadProximosPassos();

      var regimeLabels = {
        clt: "CLT",
        pj: "PJ",
        temporario: "Temporário",
        meio_periodo: "Meio período",
        outro: "Outro",
      };

      var modalidadeLabels = {
        presencial: "Presencial",
        hibrido: "Híbrido",
        remoto: "Remoto",
      };

      function escapeHtml(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function showFeedback(message, type) {
        feedback.hidden = false;
        feedback.textContent = message;
        feedback.className = "feedback feedback--" + type;
      }

      function emptyListMessage(message) {
        list.innerHTML = "<li class=\"publicacao-item publicacao-item-empty\">" + escapeHtml(message) + "</li>";
      }

      function buildVagaMeta(vaga) {
        var items = [];
        items.push("<li><strong>Empresa:</strong> " + escapeHtml(vaga.empresa) + "</li>");
        if (vaga.areaTrabalhoLabel) {
          items.push("<li><strong>Área:</strong> " + escapeHtml(vaga.areaTrabalhoLabel) + "</li>");
        }
        if (vaga.regime) {
          items.push("<li><strong>Regime:</strong> " + escapeHtml(regimeLabels[vaga.regime] || vaga.regime) + "</li>");
        }
        if (vaga.modalidade) {
          items.push("<li><strong>Modalidade:</strong> " + escapeHtml(modalidadeLabels[vaga.modalidade] || vaga.modalidade) + "</li>");
        }
        if (vaga.local) {
          items.push("<li><strong>Local:</strong> " + escapeHtml(vaga.local) + "</li>");
        }
        if (vaga.salarioTexto) {
          items.push("<li><strong>Remuneração:</strong> " + escapeHtml(vaga.salarioTexto) + "</li>");
        }
        items.push("<li><strong>Disponível na plataforma:</strong> " + escapeHtml(ME_APP.formatVigenciaPeriodo(vaga)) + "</li>");
        return "<ul class=\"publicacao-item-meta-list\">" + items.join("") + "</ul>";
      }

      function formatDescricaoVaga(descricao) {
        if (!descricao) return "";
        return (
          "<p class=\"publicacao-item-block-label\">Descrição da vaga</p>" +
          "<p class=\"publicacao-item-desc\">" + escapeHtml(descricao) + "</p>"
        );
      }

      function formatBlocoVaga(titulo, texto) {
        if (!texto) return "";
        return (
          "<p class=\"publicacao-item-block-label\">" + escapeHtml(titulo) + "</p>" +
          "<p class=\"publicacao-item-desc\">" + escapeHtml(texto) + "</p>"
        );
      }

      function buildVagaPanel(vaga) {
        return (
          buildVagaMeta(vaga) +
          "<div class=\"vaga-match\" data-vaga-match aria-live=\"polite\"></div>" +
          formatDescricaoVaga(vaga.descricao) +
          formatBlocoVaga("Requisitos essenciais", vaga.requisitosEssenciais) +
          formatBlocoVaga("Requisitos desejáveis", vaga.requisitosDesejaveis) +
          formatBlocoVaga("O que a empresa oferece", vaga.oQueEmpresaOferece) +
          "<div class=\"publicacao-item-actions\">" +
          (vaga.candidatou
            ? "<p class=\"vaga-inscrito\" role=\"status\">Candidatura enviada</p>"
            : "<button type=\"button\" class=\"btn btn-small btn-candidatar\">Quero me candidatar</button>") +
          "</div>"
        );
      }

      var matchCache = new Map();

      function getScoreClass(score) {
        if (score >= 70) return "vaga-match-score--alto";
        if (score >= 40) return "vaga-match-score--medio";
        return "vaga-match-score--baixo";
      }

      function renderMatchBox(box, data) {
        if (!data.temCurriculo) {
          box.innerHTML =
            "<p class=\"vaga-match-label\">Compatibilidade</p>" +
            "<p class=\"vaga-match-hint\">" + escapeHtml(data.message || "Complete seu currículo para ver sua compatibilidade.") +
            " <a class=\"link-inline\" href=\"meu_curriculo_50.html\">Ir para Meu currículo</a></p>";
          return;
        }

        box.innerHTML =
          "<p class=\"vaga-match-label\">Sua compatibilidade com esta vaga</p>" +
          "<div class=\"vaga-match-score-row\">" +
          "<span class=\"vaga-match-score " + getScoreClass(data.score) + "\">" + escapeHtml(String(data.score)) + "%</span>" +
          "</div>" +
          (data.motivo
            ? "<p class=\"vaga-match-motivo\">" + escapeHtml(data.motivo) + "</p>"
            : "");
      }

      function updateMatchBadge(li, score) {
        var toggle = li.querySelector(".publicacao-item-toggle");
        if (!toggle) return;
        var badge = toggle.querySelector(".vaga-match-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "vaga-match-badge";
          badge.setAttribute("aria-label", "Compatibilidade " + score + " por cento");
          toggle.querySelector(".publicacao-item-titulo").after(badge);
        }
        badge.textContent = score + "% match";
        badge.setAttribute("aria-label", "Compatibilidade " + score + " por cento");
      }

      function carregarMatchVaga(vaga, li) {
        var box = li.querySelector("[data-vaga-match]");
        if (!box) return;

        var vagaId = ME_APP.normalizeId(vaga._id);
        if (!vagaId) return;

        if (matchCache.has(vagaId)) {
          var cached = matchCache.get(vagaId);
          renderMatchBox(box, cached);
          if (cached.temCurriculo && cached.score != null) {
            updateMatchBadge(li, cached.score);
          }
          return;
        }

        box.innerHTML = "<p class=\"vaga-match-loading\">A calcular sua compatibilidade…</p>";

        fetch(apiBase + "/api/vagas/" + encodeURIComponent(vagaId) + "/match", {
          headers: ME_APP.getAuthHeaders(),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              if (result.data && result.data.code === "INDISPONIVEL") {
                box.innerHTML = "";
                return;
              }
              box.innerHTML =
                "<p class=\"vaga-match-hint\">" +
                escapeHtml(result.data && result.data.error
                  ? result.data.error
                  : "Não foi possível calcular a compatibilidade agora. Tente novamente mais tarde.") +
                "</p>";
              return;
            }

            matchCache.set(vagaId, result.data);
            renderMatchBox(box, result.data);
            if (result.data.temCurriculo && result.data.score != null) {
              updateMatchBadge(li, result.data.score);
              ME_ANALYTICS.track("vaga_match_exibido", {
                page: "emprego_50",
                score: result.data.score,
                vagaId: vagaId,
              });
            }
          })
          .catch(function () {
            box.innerHTML =
              "<p class=\"vaga-match-hint\">Erro de conexão ao calcular compatibilidade.</p>";
          });
      }

      function buildCandidaturaPanel(candidatura) {
        return (
          buildVagaMeta(candidatura) +
          formatDescricaoVaga(candidatura.descricao) +
          formatBlocoVaga("Requisitos essenciais", candidatura.requisitosEssenciais) +
          formatBlocoVaga("Requisitos desejáveis", candidatura.requisitosDesejaveis) +
          formatBlocoVaga("O que a empresa oferece", candidatura.oQueEmpresaOferece) +
          "<div class=\"publicacao-item-actions\">" +
          "<p class=\"vaga-inscrito\" role=\"status\">Candidatura enviada</p>" +
          "<p class=\"inscricao-data\">Candidatura em " + ME_APP.formatDataPublicacao(candidatura.candidatouEm) + "</p>" +
          "</div>"
        );
      }

      function createAccordionItem(titulo, panelHtml, index, open, onOpen) {
        var panelId = "vaga-panel-" + index;
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
        ME_APP.bindPublicacaoAccordion(li, onOpen);
        return li;
      }

      function bindCandidatar(li, vaga) {
        var btn = li.querySelector(".btn-candidatar");
        if (!btn) return;
        btn.addEventListener("click", function () {
          btn.disabled = true;
          btn.textContent = "Enviando…";
          ME_ANALYTICS.track("candidatura_submit", { vaga: vaga.titulo });

          fetch(apiBase + "/api/candidaturas", {
            method: "POST",
            headers: ME_APP.authJsonHeaders(),
            body: JSON.stringify({ vagaId: vaga._id }),
          })
            .then(function (response) {
              return response.json().then(function (data) {
                return { ok: response.ok, data: data };
              });
            })
            .then(function (result) {
              if (result.ok) {
                ME_ANALYTICS.track("candidatura_sucesso", { vaga: vaga.titulo });
                var msg = result.data.message;
                if (result.data.linkCandidatura) {
                  msg += " Link: " + result.data.linkCandidatura;
                }
                showFeedback(msg, "ok");
                vaga.candidatou = true;
                var vagaId = ME_APP.normalizeId(vaga._id);
                if (vagaId) candidatosIds.add(vagaId);
                refreshListagemAtiva();
                return;
              }
              if (result.data && result.data.error && result.data.error.indexOf("já se candidatou") !== -1) {
                vaga.candidatou = true;
                var vagaIdDup = ME_APP.normalizeId(vaga._id);
                if (vagaIdDup) candidatosIds.add(vagaIdDup);
                refreshListagemAtiva();
                return;
              }
              showFeedback(result.data.error || "Não foi possível candidatar.", "erro");
              btn.disabled = false;
              btn.textContent = "Quero me candidatar";
            })
            .catch(function () {
              showFeedback("Erro de conexão. Tente novamente.", "erro");
              btn.disabled = false;
              btn.textContent = "Quero me candidatar";
            });
        });
      }

      function renderVagas(vagas) {
        if (activeView !== "publicacoes") return;
        list.innerHTML = "";
        var visiveis = ME_APP.filtrarPublicacoesAbertas(vagas, candidatosIds);
        if (!visiveis.length) {
          if (semAreasInteresse) {
            emptyListMessage("Selecione suas áreas de interesse acima para ver vagas compatíveis.");
            return;
          }
          emptyListMessage("Nenhuma vaga disponível nas áreas selecionadas. Ajuste suas áreas de interesse ou volte em breve.");
          return;
        }

        var abrirPrimeiro = !!destaqueId;
        visiveis.forEach(function (vaga, index) {
          var abrir = abrirPrimeiro && index === 0;
          var li = createAccordionItem(
            vaga.titulo,
            buildVagaPanel(vaga),
            index,
            abrir,
            function () {
              carregarMatchVaga(vaga, li);
            }
          );
          bindCandidatar(li, vaga);
          list.appendChild(li);
          if (abrir) {
            carregarMatchVaga(vaga, li);
          }
        });
      }

      function renderCandidaturas(candidaturas) {
        inscricoesList.innerHTML = "";
        if (!candidaturas.length) {
          inscricoesList.innerHTML = "<li class=\"publicacao-item publicacao-item-empty\">Você ainda não se candidatou a vagas.</li>";
          return;
        }

        candidaturas.forEach(function (candidatura, index) {
          var li = createAccordionItem(
            candidatura.titulo,
            buildCandidaturaPanel(candidatura),
            index,
            false
          );
          inscricoesList.appendChild(li);
        });
      }

      var vagasCache = [];
      var candidatosIds = new Set();
      var vagasLoaded = false;
      var candidaturasRequestId = 0;
      var semAreasInteresse = false;
      var areasInteresseAtuais = [];
      var interessesGrid = document.getElementById("interesses-grid");
      var btnSalvarInteresses = document.getElementById("btn-salvar-interesses");
      var tabsNav = document.getElementById("pilar-view-tabs");
      var activeView = "publicacoes";

      function renderInteressesForm(selected) {
        if (!interessesGrid || !window.ME_VAGA_AREAS) return;
        var selectedSet = new Set(selected || []);
        interessesGrid.innerHTML = ME_VAGA_AREAS.list.map(function (area) {
          var checked = selectedSet.has(area.id) ? " checked" : "";
          return (
            "<label class=\"interesses-option\">" +
            "<input type=\"checkbox\" name=\"areasInteresse\" value=\"" + escapeHtml(area.id) + "\"" + checked + ">" +
            "<span>" + escapeHtml(area.label) + "</span>" +
            "</label>"
          );
        }).join("");
      }

      function getInteressesSelecionados() {
        if (!interessesGrid) return [];
        return Array.prototype.slice
          .call(interessesGrid.querySelectorAll("input[name=\"areasInteresse\"]:checked"))
          .map(function (input) {
            return input.value;
          });
      }

      function salvarInteresses() {
        var selecionados = getInteressesSelecionados();
        btnSalvarInteresses.disabled = true;
        btnSalvarInteresses.textContent = "Salvando…";

        fetch(apiBase + "/api/contas/interesses", {
          method: "PATCH",
          headers: ME_APP.authJsonHeaders(),
          body: JSON.stringify({
            areasInteresse: selecionados,
          }),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              showFeedback(result.data.error || "Não foi possível salvar.", "erro");
              return;
            }
            areasInteresseAtuais = result.data.areasInteresse || selecionados;
            semAreasInteresse = areasInteresseAtuais.length === 0;
            showFeedback(result.data.message || "Interesses guardados.", "ok");
            vagasCache = [];
            vagasLoaded = false;
            setView("publicacoes");
            ME_ANALYTICS.track("interesses_vaga_salvos", {
              page: "emprego_50",
              total: areasInteresseAtuais.length,
            });
          })
          .catch(function () {
            showFeedback("Erro de conexão ao salvar interesses.", "erro");
          })
          .finally(function () {
            btnSalvarInteresses.disabled = false;
            btnSalvarInteresses.textContent = "Salvar interesses";
          });
      }

      function loadInteressesPanel() {
        fetch(apiBase + "/api/contas/interesses", { headers: ME_APP.getAuthHeaders() })
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            if (!data.ok) {
              showFeedback(data.error || "Não foi possível carregar interesses.", "erro");
              renderInteressesForm(areasInteresseAtuais);
              return;
            }
            areasInteresseAtuais = data.areasInteresse || [];
            renderInteressesForm(areasInteresseAtuais);
          })
          .catch(function () {
            renderInteressesForm(areasInteresseAtuais);
          });
      }

      function setView(view) {
        activeView = view;
        var buttons = tabsNav.querySelectorAll("[data-view]");
        buttons.forEach(function (btn) {
          var active = btn.getAttribute("data-view") === view;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        if (publicacoesPanel) {
          publicacoesPanel.hidden = view !== "publicacoes";
        }
        if (inscricoesPanel) {
          inscricoesPanel.hidden = view !== "inscricoes";
        }
        if (view === "publicacoes") {
          loadPublicacoes();
        } else if (view === "inscricoes") {
          loadInscricoes();
        }
      }

      function iniciarTabs() {
        if (destaqueId) {
          tabsNav.hidden = true;
          if (publicacoesPanel) {
            publicacoesPanel.hidden = false;
          }
          if (interessesSection) {
            interessesSection.hidden = true;
          }
          if (vagasSection) {
            vagasSection.open = true;
          }
          loadPublicacoes();
          return;
        }
        tabsNav.hidden = false;
        tabsNav.querySelectorAll("[data-view]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            setView(btn.getAttribute("data-view"));
          });
        });
        if (btnSalvarInteresses) {
          btnSalvarInteresses.addEventListener("click", salvarInteresses);
        }
        var viewInicial =
          (ME_APP.getQueryParam("view") || "").toLowerCase() === "inscricoes"
            ? "inscricoes"
            : "publicacoes";
        setView(viewInicial);
        if (semAreasInteresse && viewInicial === "publicacoes") {
          if (interessesSection) interessesSection.open = true;
          if (vagasSection) vagasSection.open = true;
          showFeedback("Selecione ao menos uma área de interesse para ver vagas compatíveis.", "ok");
        }
      }

      function coletarIdsCandidaturas(candidaturas) {
        candidatosIds = new Set();
        (candidaturas || []).forEach(function (candidatura) {
          var id = ME_APP.normalizeId(candidatura.vagaId || candidatura._id);
          if (id) candidatosIds.add(id);
        });
      }

      function refreshListagemAtiva() {
        if (activeView === "inscricoes") {
          loadInscricoes();
          return;
        }
        renderVagas(vagasCache);
      }

      function marcarVagasCandidatadas(vagas) {
        return (vagas || []).map(function (vaga) {
          var id = ME_APP.normalizeId(vaga._id);
          var candidatou = !!vaga.candidatou || (id && candidatosIds.has(id));
          return Object.assign({}, vaga, { candidatou: candidatou });
        });
      }

      function loadPublicacoes() {
        feedback.hidden = true;
        loadInteressesPanel();
        if (vagasLoaded) {
          renderVagas(vagasCache);
          return;
        }
        fetchVagas();
      }

      function loadInscricoes() {
        feedback.hidden = true;
        if (!inscricoesList) return;
        var requestId = ++candidaturasRequestId;
        inscricoesList.innerHTML = "<li class=\"publicacao-item publicacao-item-empty\">Carregando inscrições…</li>";
        fetch(apiBase + "/api/candidaturas", { headers: ME_APP.getAuthHeaders() })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (requestId !== candidaturasRequestId) return;
            if (activeView !== "inscricoes") return;
            if (!data.ok) {
              inscricoesList.innerHTML =
                "<li class=\"publicacao-item publicacao-item-empty\">Não foi possível carregar suas candidaturas. Tente novamente.</li>";
              return;
            }
            renderCandidaturas(data.candidaturas || []);
          })
          .catch(function () {
            if (requestId !== candidaturasRequestId) return;
            if (activeView !== "inscricoes") return;
            inscricoesList.innerHTML =
              "<li class=\"publicacao-item publicacao-item-empty\">Não foi possível carregar suas candidaturas. Tente novamente.</li>";
          });
      }

      function fetchVagas() {
        Promise.all([
          fetch(apiBase + "/api/vagas", { headers: ME_APP.getAuthHeaders() }).then(function (response) {
            return response.json();
          }),
          fetch(apiBase + "/api/candidaturas", { headers: ME_APP.getAuthHeaders() }).then(function (response) {
            return response.json();
          }),
        ])
          .then(function (results) {
            var data = results[0];
            var candData = results[1];
            if (!data.ok) {
              showFeedback("Não foi possível carregar as vagas.", "erro");
              return;
            }
            semAreasInteresse = !!data.semAreasInteresse;
            areasInteresseAtuais = data.areasInteresse || [];
            if (candData.ok) {
              coletarIdsCandidaturas(candData.candidaturas);
            }
            var vagas = marcarVagasCandidatadas(data.vagas || []);
            if (destaqueId) {
              vagas = vagas.filter(function (vaga) {
                return ME_APP.sameId(vaga._id, destaqueId);
              });
              if (!vagas.length) {
                if (semAreasInteresse) {
                  showFeedback("Selecione suas áreas de interesse em «Publicações» para acessar esta vaga.", "erro");
                } else {
                  showFeedback("Esta vaga não está disponível para as suas áreas de interesse.", "erro");
                }
                list.innerHTML = "";
                return;
              }
              var destaque = vagas[0];
              if (destaque.candidatou || candidatosIds.has(ME_APP.normalizeId(destaque._id))) {
                showFeedback("Você já se candidatou a esta vaga. Consulte «Minhas candidaturas».", "ok");
                list.innerHTML = "";
                return;
              }
              if (ME_APP.isPublicacaoExpirada(destaque)) {
                showFeedback("Esta vaga não está mais disponível para candidatura.", "erro");
                list.innerHTML = "";
                return;
              }
              vagasCache = vagas;
              vagasLoaded = true;
              renderVagas(vagasCache);
              return;
            }
            vagasCache = vagas;
            vagasLoaded = true;
            if (!tabsNav.dataset.initialized) {
              tabsNav.dataset.initialized = "1";
              iniciarTabs();
            } else if (publicacoesPanel && !publicacoesPanel.hidden) {
              renderVagas(vagasCache);
            }
          })
          .catch(function () {
            showFeedback("Não foi possível carregar as vagas.", "erro");
          });
      }

      fetchVagas();
})();

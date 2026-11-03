(function () {
      var sessao = ME_APP.ensureParceiroSession();
      if (!sessao) return;

      var apiBase = ME_APP.getApiBase();
      var lista = document.getElementById("lista");
      var feedback = document.getElementById("feedback");
      var pageTitle = document.getElementById("page-title");
      var pageLead = document.getElementById("page-lead");
      var tipoFiltro = (ME_APP.getQueryParam("tipo") || "").trim().toLowerCase();

      var pilaresPublicacao = {
        vaga: {
          titulo: "Minhas publicações — Vagas",
          lead: "Acompanhe o estado de vigência e curadoria das suas vagas de emprego.",
          vazio: "Ainda não há vagas publicadas. Use «Publicar» na área do parceiro para enviar uma nova oportunidade.",
        },
        curso: {
          titulo: "Minhas publicações — Cursos",
          lead: "Acompanhe o estado de vigência e curadoria dos seus cursos.",
          vazio: "Ainda não há cursos publicados. Use «Publicar» na área do parceiro para enviar um novo curso.",
        },
        bem_estar: {
          titulo: "Minhas publicações — Bem-estar",
          lead: "Acompanhe o estado de vigência e curadoria das suas ofertas de bem-estar.",
          vazio: "Ainda não há ofertas de bem-estar publicadas. Use «Publicar» na área do parceiro para enviar uma nova oferta.",
        },
        evento: {
          titulo: "Minhas publicações — Comunidade",
          lead: "Acompanhe o estado de vigência e curadoria das suas publicações de comunidade.",
          vazio: "Ainda não há publicações de comunidade. Use «Publicar» na área do parceiro para enviar um novo encontro.",
        },
      };

      if (pilaresPublicacao[tipoFiltro]) {
        pageTitle.textContent = pilaresPublicacao[tipoFiltro].titulo;
        pageLead.textContent = pilaresPublicacao[tipoFiltro].lead;
        document.title = pilaresPublicacao[tipoFiltro].titulo + " — Mais Experiência";
        var backLink = document.getElementById("back-link");
        if (backLink) {
          backLink.href = "pilar_parceiro.html?tipo=" + encodeURIComponent(tipoFiltro);
          backLink.textContent = "← Voltar a " + pilaresPublicacao[tipoFiltro].titulo;
        }
      }

      ME_ANALYTICS.track("publicacoes_parceiro_visita", {
        page: "publicacoes_parceiro",
        tipo: tipoFiltro || null,
      });

      function showFeedback(message, type) {
        feedback.hidden = false;
        feedback.textContent = message;
        feedback.className = "feedback feedback--" + type;
      }

      function escapeHtml(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function getStatusPublicacao(item) {
        if (item.status === "pendente") {
          return {
            label: "Em curadoria",
            className: "status-aviso status-aviso--curadoria",
          };
        }
        if (item.status === "rejeitada") {
          return {
            label: "Rejeitada",
            className: "status-aviso status-aviso--inativo",
          };
        }
        if (item.status === "encerrada") {
          return {
            label: "Encerrada",
            className: "status-aviso status-aviso--inativo",
          };
        }
        if (item.status === "arquivada") {
          return {
            label: "Arquivada",
            className: "status-aviso status-aviso--inativo",
          };
        }
        return ME_APP.getStatusVigencia(item);
      }

      function podeEncerrarPublicacao(item) {
        return item.status === "activa" || item.status === "pendente";
      }

      var modalidadeLabels = {
        presencial: "Presencial",
        hibrido: "Híbrido",
        remoto: "Remoto",
      };

      var regimeLabels = {
        clt: "CLT",
        pj: "PJ",
        temporario: "Temporário",
        meio_periodo: "Meio período",
        outro: "Outro",
      };

      function formatBrl(value) {
        var num = Number(value);
        if (!Number.isFinite(num)) return "—";
        if (num === 0) return "Gratuito";
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }

      function blocoDetalhe(titulo, valor) {
        if (!valor) return "";
        return (
          "<div class=\"publicacao-detalhe-bloco\">" +
          "<p class=\"publicacao-detalhe-label\">" + escapeHtml(titulo) + "</p>" +
          "<p class=\"publicacao-detalhe-texto\">" + escapeHtml(valor) + "</p>" +
          "</div>"
        );
      }

      function buildPublicacaoConteudo(item) {
        var html = "";
        html += blocoDetalhe("Período na plataforma", ME_APP.formatVigenciaPeriodo(item));
        html += blocoDetalhe("Estado", item.status);

        if (item.categoria === "vaga") {
          html += blocoDetalhe("Cargo", item.tituloOriginal || item.titulo);
          html += blocoDetalhe("Empresa", item.parceiro);
          html += blocoDetalhe("Área de trabalho", item.areaTrabalhoLabel || item.areaTrabalho);
          html += blocoDetalhe("Descrição do cargo", item.descricaoOriginal || item.descricao);
          if (item.tituloOriginal && item.titulo !== item.tituloOriginal) {
            html += blocoDetalhe("Cargo publicado", item.titulo);
          }
          if (item.descricaoOriginal && item.descricao !== item.descricaoOriginal) {
            html += blocoDetalhe("Descrição publicada", item.descricao);
          }
          html += blocoDetalhe("Requisitos essenciais", item.requisitosEssenciais);
          html += blocoDetalhe("Requisitos desejáveis", item.requisitosDesejaveis);
          html += blocoDetalhe("O que a empresa oferece", item.oQueEmpresaOferece);
          html += blocoDetalhe("Regime", regimeLabels[item.regime] || item.regime);
          html += blocoDetalhe("Modalidade", modalidadeLabels[item.modalidade] || item.modalidade);
          html += blocoDetalhe("Local", item.local);
          html += blocoDetalhe("Faixa salarial", item.salarioTexto);
          html += blocoDetalhe("Link para candidatura", item.linkCandidatura);
          html += blocoDetalhe("Responsável (RH)", item.nomeContatoParceiro);
          html += blocoDetalhe("E-mail de contato (RH)", item.emailContatoParceiro);
        } else {
          html += blocoDetalhe("Título", item.titulo);
          html += blocoDetalhe("Organização", item.parceiro);
          html += blocoDetalhe("Descrição", item.descricao);
          html += blocoDetalhe("Valor da inscrição", formatBrl(item.valorInscricaoBrl));
          html += blocoDetalhe("Modalidade", modalidadeLabels[item.modalidade] || item.modalidade);
          html += blocoDetalhe("Local", item.local);
          html += blocoDetalhe("Referência", item.referencia);
          if (item.categoria === "curso") {
            var inicioCurso = ME_APP.formatDataPublicacao(item.dataPublicacao);
            if (item.hora) inicioCurso += " · " + item.hora;
            html += blocoDetalhe("Início do curso", inicioCurso);
          }
          if (item.categoria === "evento") {
            html += blocoDetalhe("Data", item.dataTexto);
          }
        }

        html += blocoDetalhe("Nota da curadoria", item.notaCuradoria);
        html += blocoDetalhe("Motivo da rejeição", item.motivoRejeicao);
        if (item.flagsCuradoria && item.flagsCuradoria.length) {
          html += blocoDetalhe("Alertas de curadoria", item.flagsCuradoria.join(", "));
        }
        return html || "<p class=\"publicacao-item-meta\">Sem detalhes adicionais.</p>";
      }

      function formatDetalhesResumo(item) {
        var partes = ["Plataforma: " + ME_APP.formatVigenciaPeriodo(item)];
        if (item.modalidade) {
          partes.push("Modalidade: " + (modalidadeLabels[item.modalidade] || item.modalidade));
        }
        if (item.local) {
          partes.push("Local: " + item.local);
        }
        if (item.categoria === "vaga" && item.regime) {
          partes.push("Regime: " + (regimeLabels[item.regime] || item.regime));
        }
        return escapeHtml(partes.join(" · "));
      }

      function formatContagem(item) {
        var total = Number(item.totalInscricoes) || 0;
        if (item.categoria === "vaga") {
          return total === 1 ? "1 candidatura" : total + " candidaturas";
        }
        return total === 1 ? "1 inscrição" : total + " inscrições";
      }

      function formatDataHora(value) {
        if (!value) return "—";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "—";
        return date.toLocaleString("pt-BR");
      }

      function buildRelatorioHtml(data) {
        var pub = data.publicacao || {};
        var linhas = (data.inscritos || []).map(function (inscrito, index) {
          return "<tr>" +
            "<td>" + (index + 1) + "</td>" +
            "<td>" + escapeHtml(inscrito.nome) + "</td>" +
            "<td>" + escapeHtml(inscrito.email) + "</td>" +
            "<td>" + escapeHtml(inscrito.telefone || "—") + "</td>" +
            "<td>" + escapeHtml(formatDataHora(inscrito.inscritoEm)) + "</td>" +
            "</tr>";
        }).join("");

        if (!linhas) {
          linhas = "<tr><td colspan=\"5\">Nenhuma inscrição registrada até o momento.</td></tr>";
        }

        return "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">" +
          "<title>Relatório de inscrições — " + escapeHtml(pub.titulo || "") + "</title>" +
          "<style>" +
          "body{font-family:Arial,sans-serif;color:#222;margin:24px;}" +
          "h1{font-size:20px;margin:0 0 8px;}" +
          "p{margin:0 0 6px;}" +
          "table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}" +
          "th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top;}" +
          "th{background:#f5f5f5;}" +
          "@media print{body{margin:12mm;}}" +
          "</style></head><body>" +
          "<h1>Relatório de inscrições</h1>" +
          "<p><strong>Publicação:</strong> " + escapeHtml(pub.titulo || "") + "</p>" +
          "<p><strong>Tipo:</strong> " + escapeHtml(pub.tipoLabel || "") + "</p>" +
          "<p><strong>Parceiro:</strong> " + escapeHtml(pub.parceiro || "") + "</p>" +
          "<p><strong>Total:</strong> " + (data.total || 0) + "</p>" +
          "<p><strong>Gerado em:</strong> " + escapeHtml(new Date().toLocaleString("pt-BR")) + "</p>" +
          "<table><thead><tr>" +
          "<th>#</th><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Data</th>" +
          "</tr></thead><tbody>" + linhas + "</tbody></table>" +
          "</body></html>";
      }

      function normalizeId(value) {
        if (value && typeof value === "object" && value.$oid) {
          return value.$oid;
        }
        return String(value || "");
      }

      function renderCandidatoBadge(status, cobrancaStatus, candidatou) {
        if (status === "contratada") {
          var taxaTxt = cobrancaStatus === "paga"
            ? " <span class=\"alinhamento-tag alinhamento-tag--paga\">taxa paga</span>"
            : " <span class=\"alinhamento-tag alinhamento-tag--pendente\">taxa pendente</span>";
          return " · <span class=\"alinhamento-tag alinhamento-tag--contratada\">✓ Contratado</span>" + taxaTxt;
        }
        return candidatou ? " · candidatou-se" : "";
      }

      function renderAlinhamentoHtml(data) {
        if (!data.ranking || !data.ranking.length) {
          return "<p class=\"alinhamento-meta\">" +
            escapeHtml(data.message || "Nenhum currículo avaliado.") +
            "</p>";
        }

        var linhas = data.ranking.map(function (item, index) {
          var contratada = item.status === "contratada";
          var badge = renderCandidatoBadge(item.status, item.cobrancaStatus, item.candidatou);
          var acoes = "";
          if (item.candidatou) {
            acoes =
              "<div class=\"alinhamento-item-actions\">" +
              "<button type=\"button\" class=\"btn btn-secondary btn-small btn-ver-curriculo\"" +
              " data-email=\"" + escapeHtml(item.email) + "\"" +
              " data-nome=\"" + escapeHtml(item.nome) + "\">Ver currículo do candidato</button>" +
              "<button type=\"button\" class=\"btn btn-small btn-contratar" + (contratada ? " btn-secondary" : "") + "\"" +
              " data-email=\"" + escapeHtml(item.email) + "\"" +
              " data-nome=\"" + escapeHtml(item.nome) + "\"" +
              " data-status=\"" + escapeHtml(item.status || "enviada") + "\">" +
              (contratada ? "Desfazer contratação" : "Marcar como contratado") +
              "</button>" +
              "</div>";
          }
          return "<li class=\"alinhamento-item\">" +
            "<div class=\"alinhamento-score\">" + escapeHtml(String(item.score)) + "%</div>" +
            "<div>" +
            "<div class=\"alinhamento-nome\">" + (index + 1) + ". " + escapeHtml(item.nome) + "</div>" +
            "<div class=\"alinhamento-motivo\">" + escapeHtml(item.motivo || "—") + "</div>" +
            "<div class=\"alinhamento-meta\">" + escapeHtml(item.email) + badge + "</div>" +
            acoes +
            "</div></li>";
        }).join("");

        return "<ul class=\"alinhamento-list\" aria-label=\"Top de alinhamento\">" + linhas + "</ul>" +
          "<p class=\"alinhamento-meta\">Avaliados: " + (data.totalAvaliados || 0) +
          " · escopo: " + escapeHtml(data.escopo || "plataforma") + "</p>";
      }

      function getIniciais(nome) {
        var partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
        if (!partes.length) return "?";
        if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
        return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
      }

      function renderAvatar(perfil) {
        if (perfil.fotoDataUrl) {
          return "<img class=\"curriculo-print-avatar curriculo-print-avatar--foto\" src=\"" +
            escapeHtml(perfil.fotoDataUrl) + "\" alt=\"\">";
        }
        return "<div class=\"curriculo-print-avatar curriculo-print-avatar--iniciais\" aria-hidden=\"true\">" +
          escapeHtml(getIniciais(perfil.nome)) + "</div>";
      }

      function renderMetaLine(label, value) {
        if (!value) return "";
        return "<p class=\"curriculo-print-meta\"><strong>" + escapeHtml(label) + ":</strong> " +
          escapeHtml(value) + "</p>";
      }

      function renderLinkedInMeta(url) {
        if (!url) return "";
        return "<p class=\"curriculo-print-meta\"><strong>LinkedIn:</strong> " +
          escapeHtml(url) + "</p>";
      }

      function renderExperiencias(experiencias) {
        if (!experiencias || !experiencias.length) return "";
        var blocks = experiencias.map(function (exp) {
          var title = [exp.cargo, exp.empresa].filter(Boolean).join(" · ");
          var meta = [exp.periodo, exp.local].filter(Boolean).join(" · ");
          var html =
            "<article class=\"curriculo-print-block\">" +
            "<h3 class=\"curriculo-print-block-title\">" + escapeHtml(title || "Experiência") + "</h3>";
          if (meta) {
            html += "<p class=\"curriculo-print-block-meta\">" + escapeHtml(meta) + "</p>";
          }
          if (exp.descricao) {
            html += "<p class=\"curriculo-print-texto\">" + escapeHtml(exp.descricao) + "</p>";
          }
          html += "</article>";
          return html;
        }).join("");
        return "<section class=\"curriculo-print-section\"><h2>Experiências</h2>" + blocks + "</section>";
      }

      function renderFormacao(formacao) {
        if (!formacao || !formacao.length) return "";
        var blocks = formacao.map(function (item) {
          var title = [item.curso, item.instituicao].filter(Boolean).join(" · ");
          var html =
            "<article class=\"curriculo-print-block\">" +
            "<h3 class=\"curriculo-print-block-title\">" + escapeHtml(title || "Formação") + "</h3>";
          if (item.periodo) {
            html += "<p class=\"curriculo-print-block-meta\">" + escapeHtml(item.periodo) + "</p>";
          }
          html += "</article>";
          return html;
        }).join("");
        return "<section class=\"curriculo-print-section\"><h2>Formação</h2>" + blocks + "</section>";
      }

      function renderCompetencias(competencias) {
        if (!competencias || !competencias.length) return "";
        var items = competencias.map(function (c) {
          return "<li>" + escapeHtml(c) + "</li>";
        }).join("");
        return "<section class=\"curriculo-print-section\"><h2>Competências</h2><ul class=\"curriculo-print-list\">" +
          items + "</ul></section>";
      }

      function renderIdiomas(idiomas) {
        if (!idiomas || !idiomas.length) return "";
        var items = idiomas.map(function (item) {
          var text = item.nivel ? item.idioma + " — " + item.nivel : item.idioma;
          return "<li>" + escapeHtml(text) + "</li>";
        }).join("");
        return "<section class=\"curriculo-print-section\"><h2>Idiomas</h2><ul class=\"curriculo-print-list\">" +
          items + "</ul></section>";
      }

      function renderCurriculoPreview(perfil) {
        var resumoSection = perfil.resumo
          ? "<section class=\"curriculo-print-section\"><h2>Resumo</h2><p class=\"curriculo-print-texto\">" +
            escapeHtml(perfil.resumo) + "</p></section>"
          : "";

        return (
          "<header class=\"curriculo-print-header\">" +
          renderAvatar(perfil) +
          "<div class=\"curriculo-print-headline\">" +
          "<h1 class=\"curriculo-print-nome\">" + escapeHtml(perfil.nome || "Currículo") + "</h1>" +
          (perfil.titulo ? "<p class=\"curriculo-print-meta\">" + escapeHtml(perfil.titulo) + "</p>" : "") +
          renderMetaLine("Localização", perfil.localizacao) +
          renderMetaLine("E-mail", perfil.email) +
          renderMetaLine("Telefone", perfil.telefone) +
          renderLinkedInMeta(perfil.linkedinUrl) +
          "</div></header>" +
          "<div class=\"curriculo-print-body\">" +
          resumoSection +
          renderExperiencias(perfil.experiencias) +
          renderFormacao(perfil.formacao) +
          renderCompetencias(perfil.competencias) +
          renderIdiomas(perfil.idiomas) +
          "</div>"
        );
      }

      var curriculoModal = null;

      function fecharCurriculoModal() {
        if (!curriculoModal) return;
        curriculoModal.hidden = true;
        document.body.style.overflow = "";
      }

      function ensureCurriculoModal() {
        if (curriculoModal) return curriculoModal;
        var modal = document.createElement("div");
        modal.className = "curriculo-preview-modal";
        modal.hidden = true;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Currículo do candidato");
        modal.innerHTML =
          "<div class=\"curriculo-preview-backdrop\"></div>" +
          "<div class=\"curriculo-preview-dialog\">" +
          "<div class=\"curriculo-preview-toolbar curriculo-no-print\">" +
          "<p class=\"curriculo-preview-toolbar-title\"></p>" +
          "<div class=\"curriculo-preview-toolbar-actions\">" +
          "<button type=\"button\" class=\"btn btn-secondary\" data-fechar-cv>Fechar</button>" +
          "</div></div>" +
          "<div class=\"curriculo-preview-sheet\" data-cv-content></div>" +
          "</div>";
        document.body.appendChild(modal);
        modal.querySelector(".curriculo-preview-backdrop").addEventListener("click", fecharCurriculoModal);
        modal.querySelector("[data-fechar-cv]").addEventListener("click", fecharCurriculoModal);
        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && !modal.hidden) fecharCurriculoModal();
        });
        curriculoModal = modal;
        return modal;
      }

      function abrirCurriculoModal(nome, conteudoHtml) {
        var modal = ensureCurriculoModal();
        modal.querySelector(".curriculo-preview-toolbar-title").textContent =
          "Currículo — " + (nome || "candidato");
        modal.querySelector("[data-cv-content]").innerHTML = conteudoHtml;
        modal.hidden = false;
        document.body.style.overflow = "hidden";
      }

      function verCurriculoCandidato(publicacao, email, nome, btn) {
        var id = normalizeId(publicacao._id);
        var url = apiBase + "/api/parceiros/publicacoes/" + encodeURIComponent(id) +
          "/candidato-curriculo?categoria=" + encodeURIComponent(publicacao.categoria) +
          "&email=" + encodeURIComponent(email);

        var original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "A abrir…";

        fetch(url, { headers: ME_APP.getAuthHeaders() })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok || !result.data.ok) {
              abrirCurriculoModal(nome, "<p class=\"alinhamento-meta\">" +
                escapeHtml((result.data && result.data.error) || "Não foi possível abrir o currículo.") +
                "</p>");
              return;
            }
            if (!result.data.hasPerfil) {
              abrirCurriculoModal(nome, "<p class=\"alinhamento-meta\">" +
                escapeHtml(result.data.message || "Este candidato ainda não preencheu o currículo.") +
                "</p>");
              return;
            }
            abrirCurriculoModal(nome, renderCurriculoPreview(result.data.perfil));
            ME_ANALYTICS.track("parceiro_ver_curriculo_candidato", {
              page: "publicacoes_parceiro",
            });
          })
          .catch(function () {
            abrirCurriculoModal(nome, "<p class=\"alinhamento-meta\">Erro de conexão ao abrir o currículo.</p>");
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = original;
          });
      }

      function marcarContratacao(publicacao, email, statusAtual, btnContratar, onDone) {
        var id = normalizeId(publicacao._id);
        var novoStatus = statusAtual === "contratada" ? "enviada" : "contratada";
        if (novoStatus === "contratada" &&
          !window.confirm("Confirmar que este candidato foi contratado para a vaga?")) {
          return;
        }

        btnContratar.disabled = true;
        var original = btnContratar.textContent;
        btnContratar.textContent = "A guardar…";

        fetch(apiBase + "/api/parceiros/publicacoes/" + encodeURIComponent(id) + "/candidato-status", {
          method: "PATCH",
          headers: Object.assign({ "Content-Type": "application/json" }, ME_APP.getAuthHeaders()),
          body: JSON.stringify({
            categoria: publicacao.categoria,
            email: email,
            status: novoStatus,
          }),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok || !result.data.ok) {
              showFeedback((result.data && result.data.error) || "Não foi possível atualizar o estado.", "erro");
              btnContratar.disabled = false;
              btnContratar.textContent = original;
              return;
            }
            var msgContratada = "Contratação registrada. A equipe Mais Experiência foi notificada.";
            if (result.data.cobranca && typeof result.data.cobranca.valorBrl === "number") {
              msgContratada =
                "Contratação registrada. Taxa de contratação (R$ " +
                result.data.cobranca.valorBrl.toFixed(2).replace(".", ",") +
                ") será cobrada pela plataforma.";
            }

            // Alterna o item no lugar (sem recalcular o alinhamento por IA),
            // garantindo que o botão volte a "Marcar como contratado" ao desfazer.
            var ehContratada = novoStatus === "contratada";
            var cobrancaStatus = result.data.cobranca ? result.data.cobranca.status : null;
            btnContratar.disabled = false;
            btnContratar.setAttribute("data-status", novoStatus);
            btnContratar.textContent = ehContratada ? "Desfazer contratação" : "Marcar como contratado";
            btnContratar.classList.toggle("btn-secondary", ehContratada);
            var li = btnContratar.closest ? btnContratar.closest(".alinhamento-item") : null;
            var meta = li ? li.querySelector(".alinhamento-meta") : null;
            if (meta) {
              meta.innerHTML = escapeHtml(email) + renderCandidatoBadge(novoStatus, cobrancaStatus, true);
            }

            showFeedback(
              ehContratada ? msgContratada : "Contratação desfeita.",
              "ok"
            );
            ME_ANALYTICS.track("parceiro_candidato_contratado", {
              page: "publicacoes_parceiro",
              status: novoStatus,
            });
            if (typeof onDone === "function") onDone();
          })
          .catch(function () {
            showFeedback("Erro de conexão ao atualizar o estado.", "erro");
            btnContratar.disabled = false;
            btnContratar.textContent = original;
          });
      }

      function carregarAlinhamento(item, box, btn) {
        var id = normalizeId(item._id);
        var url = apiBase + "/api/parceiros/publicacoes/" + encodeURIComponent(id) +
          "/alinhamento?categoria=" + encodeURIComponent(item.categoria) +
          "&escopo=candidatos" +
          "&limit=10";

        btn.disabled = true;
        btn.textContent = "A calcular…";
        box.hidden = false;
        box.innerHTML = "<p class=\"alinhamento-meta\">A calcular alinhamento com IA…</p>";

        fetch(url, { headers: ME_APP.getAuthHeaders() })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              box.innerHTML = "<p class=\"alinhamento-meta\">" +
                escapeHtml(result.data.error || "Não foi possível calcular o alinhamento.") +
                "</p>";
              return;
            }
            box.innerHTML =
              "<h3>Top candidatos</h3>" +
              renderAlinhamentoHtml(result.data);
            Array.prototype.forEach.call(
              box.querySelectorAll(".btn-ver-curriculo"),
              function (btnCv) {
                btnCv.addEventListener("click", function (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  verCurriculoCandidato(
                    item,
                    btnCv.getAttribute("data-email"),
                    btnCv.getAttribute("data-nome"),
                    btnCv
                  );
                });
              }
            );
            Array.prototype.forEach.call(
              box.querySelectorAll(".btn-contratar"),
              function (btnCt) {
                btnCt.addEventListener("click", function (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  marcarContratacao(
                    item,
                    btnCt.getAttribute("data-email"),
                    btnCt.getAttribute("data-status"),
                    btnCt
                  );
                });
              }
            );
            ME_ANALYTICS.track("parceiro_alinhamento_vaga", {
              page: "publicacoes_parceiro",
              total: result.data.totalAvaliados || 0,
              escopo: "candidatos",
            });
          })
          .catch(function () {
            box.innerHTML = "<p class=\"alinhamento-meta\">Erro de conexão ao calcular alinhamento.</p>";
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = "Top candidatos";
          });
      }

      function imprimirRelatorio(item, btn) {
        var id = normalizeId(item._id);
        var url = apiBase + "/api/parceiros/publicacoes/" + encodeURIComponent(id) +
          "/relatorio?categoria=" + encodeURIComponent(item.categoria);

        if (btn) {
          btn.disabled = true;
          btn.textContent = "A gerar…";
        }
        feedback.hidden = true;

        fetch(url, { headers: ME_APP.getAuthHeaders() })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              showFeedback(result.data.error || "Não foi possível gerar o relatório.", "erro");
              return;
            }

            var html = buildRelatorioHtml(result.data);
            var iframe = document.createElement("iframe");
            iframe.setAttribute("title", "Relatório de inscrições");
            iframe.setAttribute("aria-hidden", "true");
            iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
            document.body.appendChild(iframe);

            var doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();

            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            setTimeout(function () {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            }, 1500);

            ME_ANALYTICS.track("parceiro_relatorio_impresso", {
              page: "publicacoes_parceiro",
              categoria: item.categoria,
              total: result.data.total || 0,
            });
          })
          .catch(function () {
            showFeedback("Erro de conexão ao gerar relatório.", "erro");
          })
          .finally(function () {
            if (btn) {
              btn.disabled = false;
              btn.textContent = "Imprimir relatório";
            }
          });
      }

      function encerrarPublicacao(item, btn, li) {
        var confirmar = window.confirm(
          "Encerrar esta publicação agora?\n\nEla deixará de ser exibida ao público antes da data de fim. Esta ação não pode ser desfeita."
        );
        if (!confirmar) return;

        var id = item._id || item.id;
        var original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "A encerrar…";
        feedback.hidden = true;

        fetch(
          apiBase + "/api/parceiros/publicacoes/" + encodeURIComponent(id) +
            "/encerrar?categoria=" + encodeURIComponent(item.categoria),
          {
            method: "PATCH",
            headers: ME_APP.authJsonHeaders(),
            body: JSON.stringify({ categoria: item.categoria }),
          }
        )
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              showFeedback(result.data.error || "Não foi possível encerrar a publicação.", "erro");
              btn.disabled = false;
              btn.textContent = original;
              return;
            }

            item.status = "encerrada";
            var statusEl = li.querySelector(".publicacao-item-header .status-aviso");
            if (statusEl) {
              var novoStatus = getStatusPublicacao(item);
              statusEl.className = novoStatus.className;
              statusEl.textContent = novoStatus.label;
            }
            if (btn.parentNode) {
              btn.parentNode.removeChild(btn);
            }
            showFeedback(result.data.message || "Publicação encerrada.", "ok");

            ME_ANALYTICS.track("parceiro_publicacao_encerrada", {
              page: "publicacoes_parceiro",
              categoria: item.categoria,
            });
          })
          .catch(function () {
            showFeedback("Erro de conexão ao encerrar a publicação.", "erro");
            btn.disabled = false;
            btn.textContent = original;
          });
      }

      function fecharOutrasPublicacoes(exceptLi) {
        lista.querySelectorAll(".publicacao-item.is-open").forEach(function (aberta) {
          if (aberta === exceptLi) return;
          aberta.classList.remove("is-open");
          var btn = aberta.querySelector(".publicacao-item-toggle");
          var panel = aberta.querySelector(".publicacao-item-panel");
          if (btn) btn.setAttribute("aria-expanded", "false");
          if (panel) panel.hidden = true;
        });
      }

      function renderLista(publicacoes) {
        lista.innerHTML = "";
        var filtradas = publicacoes;
        if (tipoFiltro) {
          filtradas = publicacoes.filter(function (item) {
            return item.categoria === tipoFiltro;
          });
        }
        if (!filtradas.length) {
          var vazio = pilaresPublicacao[tipoFiltro]
            ? pilaresPublicacao[tipoFiltro].vazio
            : "Ainda não há publicações. Use a área do parceiro para enviar vagas, cursos, comunidade ou bem-estar.";
          lista.innerHTML =
            "<li class=\"publicacao-item publicacao-item--empty-padded\">" + escapeHtml(vazio) + "</li>";
          return;
        }

        filtradas.forEach(function (item, index) {
          var status = getStatusPublicacao(item);
          var panelId = "publicacao-panel-" + index;
          var li = document.createElement("li");
          li.className = "publicacao-item";

          li.innerHTML =
            "<button type=\"button\" class=\"publicacao-item-toggle\" aria-expanded=\"false\" aria-controls=\"" + panelId + "\">" +
            "<span class=\"publicacao-item-titulo\">" + escapeHtml(item.titulo) + "</span>" +
            "<span class=\"publicacao-item-chevron\" aria-hidden=\"true\">▼</span>" +
            "</button>" +
            "<div class=\"publicacao-item-panel\" id=\"" + panelId + "\" hidden>" +
            "<div class=\"publicacao-item-header\">" +
            "<div>" +
            "<p class=\"publicacao-item-meta\">" +
            escapeHtml(item.tipoLabel) + " · " + escapeHtml(item.parceiro) +
            "</p>" +
            "</div>" +
            "<span class=\"" + status.className + "\" role=\"status\">" + escapeHtml(status.label) + "</span>" +
            "</div>" +
            "<p class=\"publicacao-item-meta\">" +
            formatDetalhesResumo(item) +
            "</p>" +
            "<div class=\"publicacao-detalhe\">" +
            buildPublicacaoConteudo(item) +
            "</div>" +
            "<div class=\"publicacao-item-actions\">" +
            "<span class=\"publicacao-item-inscricoes\">" + escapeHtml(formatContagem(item)) + "</span>" +
            (item.categoria === "vaga"
              ? "<button type=\"button\" class=\"btn btn-secondary btn-small btn-alinhamento-candidatos\">Top candidatos</button>"
              : "") +
            "<button type=\"button\" class=\"btn btn-secondary btn-small btn-relatorio\">Imprimir relatório</button>" +
            (podeEncerrarPublicacao(item)
              ? "<button type=\"button\" class=\"btn btn-secondary btn-small btn-encerrar-publicacao\">Encerrar publicação</button>"
              : "") +
            "</div>" +
            (item.categoria === "vaga"
              ? "<div class=\"alinhamento-box\" hidden aria-live=\"polite\"></div>"
              : "") +
            "</div>";

          var toggle = li.querySelector(".publicacao-item-toggle");
          var panel = li.querySelector(".publicacao-item-panel");

          toggle.addEventListener("click", function () {
            var abrir = panel.hidden;
            fecharOutrasPublicacoes(abrir ? li : null);
            panel.hidden = !abrir;
            li.classList.toggle("is-open", abrir);
            toggle.setAttribute("aria-expanded", abrir ? "true" : "false");
            if (abrir) {
              ME_ANALYTICS.track("publicacao_parceiro_aberta", {
                page: "publicacoes_parceiro",
                categoria: item.categoria,
              });
            }
          });

          li.querySelector(".btn-relatorio").addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            imprimirRelatorio(item, this);
          });

          if (item.categoria === "vaga") {
            var alinhamentoBox = li.querySelector(".alinhamento-box");
            var btnCandidatos = li.querySelector(".btn-alinhamento-candidatos");
            btnCandidatos.addEventListener("click", function (event) {
              event.preventDefault();
              event.stopPropagation();
              carregarAlinhamento(item, alinhamentoBox, btnCandidatos);
            });
          }

          var btnEncerrar = li.querySelector(".btn-encerrar-publicacao");
          if (btnEncerrar) {
            btnEncerrar.addEventListener("click", function (event) {
              event.preventDefault();
              event.stopPropagation();
              encerrarPublicacao(item, this, li);
            });
          }

          lista.appendChild(li);
        });
      }

      fetch(apiBase + "/api/parceiros/publicacoes", { headers: ME_APP.getAuthHeaders() })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showFeedback(result.data.error || "Não foi possível carregar as publicações.", "erro");
            return;
          }
          renderLista(result.data.publicacoes || []);
        })
        .catch(function () {
          showFeedback("Erro de conexão. Tente novamente.", "erro");
        });
})();

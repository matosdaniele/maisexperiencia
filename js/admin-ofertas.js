(function () {
      if (!ME_ADMIN_PAGE.boot()) return;
      var apiBase = ME_APP.getApiBase();
      var panel = document.getElementById("panel");
      var lista = document.getElementById("lista");
      var feedback = document.getElementById("feedback");
      var statusAtual = "pendente";

      var TIPOS = {
        curso: {
          titulo: "Admin — curadoria de cursos",
          lead: "Aprove ou rejeite cursos enviados por parceiros.",
        },
        evento: {
          titulo: "Admin — curadoria de comunidade",
          lead: "Aprove ou rejeite publicações de comunidade enviadas por parceiros.",
        },
        bem_estar: {
          titulo: "Admin — curadoria de bem-estar",
          lead: "Aprove ou rejeite serviços de bem-estar enviados por parceiros.",
        },
      };

      var params = new URLSearchParams(window.location.search);
      var tipoAtual = params.get("tipo") || "";
      var config = TIPOS[tipoAtual];

      if (!config) {
        window.location.href = "admin.html";
        return;
      }

      document.getElementById("page-title").textContent = config.titulo;
      document.title = config.titulo + " — Mais Experiência";
      document.getElementById("page-lead").textContent = config.lead;

      var TIPO_LABELS = {
        curso: "Curso",
        bem_estar: "Bem-estar",
        evento: "Comunidade",
      };

      function getKey() {
        return ME_ADMIN_PAGE.getKey();
      }

      function showFeedback(message, type) {
        feedback.hidden = false;
        feedback.textContent = message;
        feedback.className = "feedback feedback--" + type;
      }

      function formatDate(value) {
        if (!value) return "—";
        return new Date(value).toLocaleString("pt-BR");
      }

      function formatData(value) {
        return ME_APP.formatDataPublicacao(value);
      }

      function escapeHtml(text) {
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      function escapeAttr(text) {
        return escapeHtml(text).replace(/"/g, "&quot;");
      }

      function formatBrl(value) {
        return "R$ " + Number(value).toFixed(2).replace(".", ",");
      }

      function renderDetalhes(oferta) {
        var partes = [];
        if (oferta.modalidade) partes.push("Modalidade: " + oferta.modalidade);
        if (oferta.local) partes.push("Local: " + oferta.local);
        if (oferta.referencia) partes.push("Ref.: " + oferta.referencia);
        if (oferta.dataPublicacao) {
          partes.push("Data: " + formatData(oferta.dataPublicacao));
        }
        if (oferta.hora) partes.push("Hora: " + oferta.hora);
        if (oferta.dataTexto) partes.push("Data: " + oferta.dataTexto);
        partes.push("Valor: " + formatBrl(oferta.valorInscricaoBrl || 0));
        return partes.map(escapeHtml).join(" · ");
      }

      function renderCard(oferta) {
        var card = document.createElement("article");
        card.className = "oferta-card";
        var tipoLabel = TIPO_LABELS[oferta.tipo] || oferta.tipo || "Oferta";

        card.innerHTML =
          "<h2><span class=\"tipo-badge\">" + escapeHtml(tipoLabel) + "</span>" +
          escapeHtml(oferta.titulo) + " · " + escapeHtml(oferta.parceiro) + "</h2>" +
          "<p class=\"oferta-meta\">" + oferta.status + " · " + formatDate(oferta.createdAt) + "</p>" +
          "<p class=\"oferta-meta\">" + renderDetalhes(oferta) + "</p>" +
          "<p class=\"oferta-body\">" + escapeHtml(oferta.descricao) + "</p>" +
          "<p class=\"oferta-meta\">Contato: " + escapeHtml(oferta.emailContatoParceiro || "—") +
          (oferta.nomeContatoParceiro ? " · " + escapeHtml(oferta.nomeContatoParceiro) : "") +
          "</p>";

        if (oferta.status === "pendente") {
          var box = document.createElement("div");
          box.className = "curadoria-box";
          box.innerHTML =
            "<div><label>Título publicado</label><input type=\"text\" class=\"inp-titulo\" value=\"" + escapeAttr(oferta.titulo) + "\"></div>" +
            "<div><label>Descrição publicada</label><textarea class=\"inp-desc\">" + escapeHtml(oferta.descricao) + "</textarea></div>" +
            "<div><label>Nota interna (opcional)</label><input type=\"text\" class=\"inp-nota\"></div>" +
            "<div class=\"acoes\">" +
            "<button type=\"button\" class=\"btn btn-small btn-aprovar\">Aprovar</button>" +
            "<button type=\"button\" class=\"btn btn-secondary btn-small btn-rejeitar\">Rejeitar</button>" +
            "</div>";
          card.appendChild(box);

          box.querySelector(".btn-aprovar").addEventListener("click", function () {
            var btn = this;
            btn.disabled = true;
            fetch(apiBase + "/api/admin/ofertas/" + oferta._id + "/aprovar", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": getKey(),
              },
              body: JSON.stringify({
                titulo: box.querySelector(".inp-titulo").value.trim(),
                descricao: box.querySelector(".inp-desc").value.trim(),
                notaCuradoria: box.querySelector(".inp-nota").value.trim(),
              }),
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  if (window.ME_ANALYTICS) {
                    ME_ANALYTICS.track("admin_oferta_aprovada", { page: "admin_ofertas" });
                  }
                  showFeedback("Publicação aprovada.", "ok");
                  loadOfertas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
                btn.disabled = false;
              });
          });

          box.querySelector(".btn-rejeitar").addEventListener("click", function () {
            var motivo = window.prompt("Motivo da rejeição (opcional):", "");
            if (motivo === null) return;
            fetch(apiBase + "/api/admin/ofertas/" + oferta._id + "/rejeitar", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": getKey(),
              },
              body: JSON.stringify({
                motivoRejeicao: motivo.trim(),
                notaCuradoria: box.querySelector(".inp-nota").value.trim(),
              }),
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  if (window.ME_ANALYTICS) {
                    ME_ANALYTICS.track("admin_oferta_rejeitada", { page: "admin_ofertas" });
                  }
                  showFeedback("Publicação rejeitada.", "ok");
                  loadOfertas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
              });
          });
        }

        if (oferta.status === "activa") {
          var acoes = document.createElement("div");
          acoes.className = "acoes";

          if (oferta.promovida) {
            var badge = document.createElement("p");
            badge.className = "oferta-meta";
            badge.innerHTML = "<strong>★ Em destaque na home</strong>";
            card.appendChild(badge);
          }

          var promover = document.createElement("button");
          promover.type = "button";
          promover.className = "btn btn-small";
          promover.textContent = oferta.promovida ? "Remover destaque" : "Promover na home";
          promover.addEventListener("click", function () {
            fetch(apiBase + "/api/admin/ofertas/" + oferta._id + "/promover", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": getKey(),
              },
              body: JSON.stringify({ promover: !oferta.promovida }),
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  showFeedback(data.message, "ok");
                  loadOfertas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
              });
          });
          acoes.appendChild(promover);

          var arquivar = document.createElement("button");
          arquivar.type = "button";
          arquivar.className = "btn btn-secondary btn-small";
          arquivar.textContent = "Arquivar";
          arquivar.addEventListener("click", function () {
            fetch(apiBase + "/api/admin/ofertas/" + oferta._id + "/arquivar", {
              method: "PATCH",
              headers: { "X-Admin-Key": getKey() },
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  showFeedback("Publicação arquivada.", "ok");
                  loadOfertas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
              });
          });
          acoes.appendChild(arquivar);
          card.appendChild(acoes);
        }

        return card;
      }

      function loadOfertas() {
        fetch(apiBase + "/api/admin/ofertas?status=" + statusAtual + "&tipo=" + encodeURIComponent(tipoAtual), {
          headers: { "X-Admin-Key": getKey() },
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, status: response.status, data: data };
            });
          })
          .then(function (result) {
            if (result.status === 401) {
              ME_ADMIN_PAGE.handle401();
              return;
            }
            if (!result.ok) {
              showFeedback(result.data.error || "Erro ao carregar.", "erro");
              return;
            }

            feedback.hidden = true;
            lista.innerHTML = "";
            if (!result.data.ofertas.length) {
              lista.innerHTML = "<p>Nenhuma publicação neste pilar e filtro.</p>";
              return;
            }

            result.data.ofertas.forEach(function (oferta) {
              lista.appendChild(renderCard(oferta));
            });
          });
      }

      document.querySelectorAll("[data-status]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          statusAtual = btn.getAttribute("data-status");
          loadOfertas();
        });
      });

      document.getElementById("btn-reload").addEventListener("click", loadOfertas);

      loadOfertas();
})();

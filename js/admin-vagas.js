(function () {
      if (!ME_ADMIN_PAGE.boot()) return;
      var apiBase = ME_APP.getApiBase();
      var panel = document.getElementById("panel");
      var lista = document.getElementById("lista");
      var feedback = document.getElementById("feedback");
      var statusAtual = "pendente";

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

      function renderCard(vaga) {
        var card = document.createElement("article");
        card.className = "vaga-card";

        var flagsHtml = "";
        if (vaga.flagsCuradoria && vaga.flagsCuradoria.length) {
          flagsHtml = "<p class=\"flags\">⚠ Flags: " + vaga.flagsCuradoria.join(", ") + "</p>";
        }

        card.innerHTML =
          "<h2>" + vaga.titulo + " · " + vaga.empresa + "</h2>" +
          "<p class=\"vaga-meta\">" + vaga.status + " · " + formatDate(vaga.createdAt) + " · " + vaga.local +
          (vaga.areaTrabalho ? " · " + vaga.areaTrabalho.replace(/_/g, " ") : "") + "</p>" +
          flagsHtml +
          "<p class=\"vaga-body\">" + vaga.descricao + "</p>" +
          "<p class=\"vaga-body\"><strong>Essencial:</strong> " + vaga.requisitosEssenciais + "</p>" +
          "<p class=\"vaga-meta\">Contato: " + vaga.emailContatoParceiro + "</p>";

        if (vaga.status === "pendente") {
          var box = document.createElement("div");
          box.className = "curadoria-box";
          box.innerHTML =
            "<div><label>Título publicado</label><input type=\"text\" class=\"inp-titulo\" value=\"" + escapeAttr(vaga.titulo) + "\"></div>" +
            "<div><label>Descrição publicada</label><textarea class=\"inp-desc\">" + escapeHtml(vaga.descricao) + "</textarea></div>" +
            "<div><label>Nota interna (opcional)</label><input type=\"text\" class=\"inp-nota\"></div>" +
            "<div class=\"acoes\">" +
            "<button type=\"button\" class=\"btn btn-small btn-aprovar\">Aprovar</button>" +
            "<button type=\"button\" class=\"btn btn-secondary btn-small btn-rejeitar\">Rejeitar</button>" +
            "</div>";
          card.appendChild(box);

          box.querySelector(".btn-aprovar").addEventListener("click", function () {
            var btn = this;
            btn.disabled = true;
            fetch(apiBase + "/api/admin/vagas/" + vaga._id + "/aprovar", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": getKey(),
              },
              body: JSON.stringify({
                tituloPublicado: box.querySelector(".inp-titulo").value.trim(),
                descricaoPublicada: box.querySelector(".inp-desc").value.trim(),
                notaCuradoria: box.querySelector(".inp-nota").value.trim(),
              }),
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  if (window.ME_ANALYTICS) {
                    ME_ANALYTICS.track("admin_vaga_aprovada", { page: "admin_vagas" });
                  }
                  showFeedback("Vaga aprovada.", "ok");
                  loadVagas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
                btn.disabled = false;
              });
          });

          box.querySelector(".btn-rejeitar").addEventListener("click", function () {
            var motivo = window.prompt("Motivo da rejeição (opcional):", "");
            if (motivo === null) return;
            fetch(apiBase + "/api/admin/vagas/" + vaga._id + "/rejeitar", {
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
                    ME_ANALYTICS.track("admin_vaga_rejeitada", { page: "admin_vagas" });
                  }
                  showFeedback("Vaga rejeitada.", "ok");
                  loadVagas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
              });
          });
        }

        if (vaga.status === "activa") {
          var acoes = document.createElement("div");
          acoes.className = "acoes";

          if (vaga.promovida) {
            var badge = document.createElement("p");
            badge.className = "vaga-meta";
            badge.innerHTML = "<strong>★ Em destaque na home</strong>";
            card.appendChild(badge);
          }

          var promover = document.createElement("button");
          promover.type = "button";
          promover.className = "btn btn-small";
          promover.textContent = vaga.promovida ? "Remover destaque" : "Promover na home";
          promover.addEventListener("click", function () {
            fetch(apiBase + "/api/admin/vagas/" + vaga._id + "/promover", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": getKey(),
              },
              body: JSON.stringify({ promover: !vaga.promovida }),
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  showFeedback(data.message, "ok");
                  loadVagas();
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
            fetch(apiBase + "/api/admin/vagas/" + vaga._id + "/arquivar", {
              method: "PATCH",
              headers: { "X-Admin-Key": getKey() },
            })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (data.ok) {
                  showFeedback("Vaga arquivada.", "ok");
                  loadVagas();
                  return;
                }
                showFeedback(data.error || "Erro.", "erro");
              });
          });
          acoes.appendChild(arquivar);

          var alinhamento = document.createElement("button");
          alinhamento.type = "button";
          alinhamento.className = "btn btn-secondary btn-small";
          alinhamento.textContent = "Top alinhamento";
          alinhamento.addEventListener("click", function () {
            var box = card.querySelector(".alinhamento-admin");
            if (!box) {
              box = document.createElement("div");
              box.className = "alinhamento-admin";
              box.setAttribute("aria-live", "polite");
              card.appendChild(box);
            }
            alinhamento.disabled = true;
            alinhamento.textContent = "A calcular…";
            box.textContent = "A calcular alinhamento com IA…";
            fetch(apiBase + "/api/admin/vagas/" + vaga._id + "/alinhamento?escopo=plataforma&limit=10", {
              headers: { "X-Admin-Key": getKey() },
            })
              .then(function (response) {
                return response.json().then(function (data) {
                  return { ok: response.ok, data: data };
                });
              })
              .then(function (result) {
                if (!result.ok) {
                  box.textContent = result.data.error || "Erro ao calcular alinhamento.";
                  return;
                }
                if (!result.data.ranking || !result.data.ranking.length) {
                  box.textContent = result.data.message || "Nenhum currículo avaliado.";
                  return;
                }
                var html = "<strong>Top alinhamento</strong><ol>";
                result.data.ranking.forEach(function (item) {
                  html += "<li><strong>" + escapeHtml(item.nome) + "</strong> — " +
                    escapeHtml(String(item.score)) + "%<br>" +
                    escapeHtml(item.motivo || "") + "</li>";
                });
                html += "</ol><p class=\"vaga-meta\">Avaliados: " + (result.data.totalAvaliados || 0) + "</p>";
                box.innerHTML = html;
              })
              .catch(function () {
                box.textContent = "Erro de conexão.";
              })
              .finally(function () {
                alinhamento.disabled = false;
                alinhamento.textContent = "Top alinhamento";
              });
          });
          acoes.appendChild(alinhamento);

          card.appendChild(acoes);
        }

        return card;
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

      function loadVagas() {
        fetch(apiBase + "/api/admin/vagas?status=" + statusAtual, {
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
            if (!result.data.vagas.length) {
              lista.innerHTML = "<p>Nenhuma vaga neste filtro.</p>";
              return;
            }

            result.data.vagas.forEach(function (vaga) {
              lista.appendChild(renderCard(vaga));
            });
          });
      }

      document.querySelectorAll("[data-status]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          statusAtual = btn.getAttribute("data-status");
          loadVagas();
        });
      });

      document.getElementById("btn-reload").addEventListener("click", loadVagas);

      loadVagas();
})();

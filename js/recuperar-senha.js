(function () {
  var PERFIS = {
    "50": {
      lead: "Informe o e-mail usado no cadastro 50+. Se ele estiver na plataforma, enviaremos um link para criar uma nova senha.",
      voltar: "entrar_50.html",
      voltarLabel: "← Voltar ao login 50+",
      api: "/api/contas/recuperar-senha",
      page: "recuperar_senha_50",
    },
    parceiro: {
      lead: "Informe o e-mail da conta de parceiro. Se ele estiver na plataforma, enviaremos um link para criar uma nova senha.",
      voltar: "entrar_parceiro.html",
      voltarLabel: "← Voltar ao login de parceiro",
      api: "/api/parceiros/recuperar-senha",
      page: "recuperar_senha_parceiro",
    },
  };

  var perfil = ME_APP.getQueryParam("perfil");
  var config = PERFIS[perfil];
  var backLink = document.getElementById("back-link");
  var lead = document.getElementById("lead");
  var escolha = document.getElementById("escolha-perfil");
  var form = document.getElementById("form-recuperar");
  var feedback = document.getElementById("feedback");
  var btn = document.getElementById("btn-enviar");
  var destino = ME_APP.getQueryParam("destino");

  function showFeedback(message, type) {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
  }

  function loginUrl() {
    if (!config) return "entrar.html";
    if (perfil === "50") return ME_APP.buildAuthUrl(config.voltar, destino);
    return config.voltar;
  }

  if (!config) {
    ME_ANALYTICS.track("recuperar_senha_inicio", { page: "recuperar_senha" });
    return;
  }

  document.title = "Recuperar senha — " + (perfil === "parceiro" ? "Parceiro" : "Mais Experiência");
  lead.textContent = config.lead;
  backLink.href = loginUrl();
  backLink.textContent = config.voltarLabel;
  escolha.hidden = true;
  form.hidden = false;

  var emailParam = ME_APP.getQueryParam("email");
  if (emailParam) {
    form.email.value = emailParam;
  }

  ME_ANALYTICS.track("recuperar_senha_inicio", { page: config.page });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    feedback.hidden = true;
    var email = form.email.value.trim().toLowerCase();
    if (!email) {
      showFeedback("Informe o e-mail da conta.", "erro");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Enviando…";
    ME_ANALYTICS.track("recuperar_senha_submit", { page: config.page });

    var body = { email: email };
    if (perfil === "50" && destino) {
      body.destino = destino;
    }

    fetch(ME_APP.getApiBase() + config.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          form.hidden = true;
          lead.textContent = "Verifique o seu e-mail.";
          ME_ANALYTICS.track("recuperar_senha_sucesso", { page: config.page });
          showFeedback(
            result.data.message ||
              "Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Verifique também a caixa de spam.",
            "ok"
          );
          return;
        }
        ME_ANALYTICS.track("recuperar_senha_erro", { page: config.page, motivo: "api" });
        showFeedback(result.data.error || "Não foi possível enviar o e-mail.", "erro");
      })
      .catch(function () {
        ME_ANALYTICS.track("recuperar_senha_erro", { page: config.page, motivo: "rede" });
        showFeedback("Não foi possível contatar a API. Tente novamente em instantes.", "erro");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Enviar link";
      });
  });
})();

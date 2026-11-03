(function () {
  var PERFIS = {
    "50": {
      api: "/api/contas/redefinir-senha",
      voltar: "entrar_50.html",
      voltarLabel: "← Voltar ao login 50+",
      page: "redefinir_senha_50",
    },
    parceiro: {
      api: "/api/parceiros/redefinir-senha",
      voltar: "entrar_parceiro.html",
      voltarLabel: "← Voltar ao login de parceiro",
      page: "redefinir_senha_parceiro",
    },
  };

  var perfil = ME_APP.getQueryParam("perfil");
  var config = PERFIS[perfil];
  var token = ME_APP.getQueryParam("token") || "";
  var destino = ME_APP.getQueryParam("destino");
  var backLink = document.getElementById("back-link");
  var lead = document.getElementById("lead");
  var feedback = document.getElementById("feedback");
  var loading = document.getElementById("loading");
  var form = document.getElementById("form-redefinir");
  var perfilResumo = document.getElementById("perfil-resumo");
  var btn = document.getElementById("btn-salvar");

  function showFeedback(message, type) {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
  }

  function loginUrl(email) {
    if (!config) return "entrar.html";
    var url = config.voltar + "?senha=redefinida";
    if (email) {
      url += "&email=" + encodeURIComponent(email);
    }
    if (perfil === "50") {
      return ME_APP.buildAuthUrl(url, destino);
    }
    return url;
  }

  if (config) {
    backLink.href = perfil === "50" ? ME_APP.buildAuthUrl(config.voltar, destino) : config.voltar;
    backLink.textContent = config.voltarLabel;
    ME_ANALYTICS.track("redefinir_senha_inicio", { page: config.page });
  }

  if (!config || !token) {
    loading.hidden = true;
    lead.hidden = true;
    showFeedback("Link inválido. Peça um novo e-mail de recuperação a partir do login.", "erro");
    if (!config) {
      backLink.href = "recuperar_senha.html";
      backLink.textContent = "← Pedir novo link";
    }
    return;
  }

  fetch(ME_APP.getApiBase() + config.api + "?token=" + encodeURIComponent(token))
    .then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    })
    .then(function (result) {
      loading.hidden = true;
      if (!result.ok) {
        lead.hidden = true;
        showFeedback(result.data.error || "Link inválido ou expirado.", "erro");
        backLink.href = "recuperar_senha.html?perfil=" + encodeURIComponent(perfil);
        backLink.textContent = "← Pedir novo link";
        return;
      }
      var dados = result.data.perfil || {};
      var partes = [];
      if (dados.empresa) partes.push(dados.empresa);
      if (dados.nome) partes.push(dados.nome);
      if (dados.email) partes.push(dados.email);
      perfilResumo.textContent = partes.join(" · ");
      form.hidden = false;
    })
    .catch(function () {
      loading.hidden = true;
      showFeedback("Não foi possível validar o link. Tente novamente em instantes.", "erro");
    });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    feedback.hidden = true;

    var senhaCheck = ME_APP.validateSenha(form.senha.value);
    if (!senhaCheck.ok) {
      showFeedback(senhaCheck.error, "erro");
      return;
    }
    if (form.senha.value !== form.senhaConfirma.value) {
      showFeedback("A confirmação da senha não confere.", "erro");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Salvando…";

    fetch(ME_APP.getApiBase() + config.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, senha: form.senha.value }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          form.hidden = true;
          lead.textContent = "Senha redefinida.";
          ME_ANALYTICS.track("redefinir_senha_sucesso", { page: config.page });
          showFeedback("Redirecionando para o login…", "ok");
          var email = result.data.perfil && result.data.perfil.email;
          setTimeout(function () {
            window.location.href = loginUrl(email);
          }, 1200);
          return;
        }
        ME_ANALYTICS.track("redefinir_senha_erro", { page: config.page, motivo: "api" });
        showFeedback(result.data.error || "Não foi possível redefinir a senha.", "erro");
        btn.disabled = false;
        btn.textContent = "Salvar nova senha";
      })
      .catch(function () {
        ME_ANALYTICS.track("redefinir_senha_erro", { page: config.page, motivo: "rede" });
        showFeedback("Não foi possível contatar a API. Tente novamente em instantes.", "erro");
        btn.disabled = false;
        btn.textContent = "Salvar nova senha";
      });
  });
})();

(function () {
  var sessao = ME_APP.ensureSession50(
    ME_APP.buildAuthUrl("entrar_50.html", "seguranca_50.html")
  );
  if (!sessao) return;

  var apiBase = ME_APP.getApiBase();
  var feedback = document.getElementById("feedback");
  var formSenha = document.getElementById("form-senha");
  var formCancelar = document.getElementById("form-cancelar-conta");
  var btnSalvarSenha = document.getElementById("btn-salvar-senha");
  var btnCancelarConta = document.getElementById("btn-cancelar-conta");

  ME_ANALYTICS.track("seguranca_50_visita", { page: "seguranca_50" });

  function showFeedback(message, type) {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function limparDadosLocaisConta() {
    try {
      localStorage.removeItem("me_comunidade_intencao");
      localStorage.removeItem("me_comunidade_vistos");
      localStorage.removeItem("me_comunidade_grupos");
      localStorage.removeItem("me_comunidade_busca");
      localStorage.removeItem("me_comunidade_circulos");
    } catch (error) {}
    ME_APP.clearSession();
  }

  formSenha.addEventListener("submit", function (event) {
    event.preventDefault();
    var senhaAtual = formSenha.senhaAtual.value;
    var senhaNova = formSenha.senhaNova.value;
    var senhaConfirma = formSenha.senhaNovaConfirma.value;

    if (senhaNova !== senhaConfirma) {
      showFeedback("A confirmação da nova senha não coincide.", "erro");
      return;
    }

    var senhaCheck = ME_APP.validateSenha(senhaNova);
    if (!senhaCheck.ok) {
      showFeedback(senhaCheck.error, "erro");
      return;
    }

    btnSalvarSenha.disabled = true;
    btnSalvarSenha.textContent = "Alterando…";

    fetch(apiBase + "/api/contas/meu-perfil/senha", {
      method: "PATCH",
      headers: ME_APP.authJsonHeaders(),
      body: JSON.stringify({
        senhaAtual: senhaAtual,
        senhaNova: senhaNova,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showFeedback(result.data.error || "Não foi possível alterar a senha.", "erro");
          return;
        }
        formSenha.reset();
        showFeedback(result.data.message || "Senha alterada.", "ok");
        ME_ANALYTICS.track("seguranca_50_senha_alterada", { page: "seguranca_50" });
      })
      .catch(function () {
        showFeedback("Erro de conexão. Tente novamente.", "erro");
      })
      .finally(function () {
        btnSalvarSenha.disabled = false;
        btnSalvarSenha.textContent = "Alterar senha";
      });
  });

  formCancelar.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!formCancelar.ciente.checked) {
      showFeedback(
        "Marque a caixa confirmando que está ciente da exclusão permanente dos dados.",
        "erro"
      );
      return;
    }

    var confirmacao = String(formCancelar.confirmacao.value || "").trim().toUpperCase();
    if (confirmacao !== "CANCELAR") {
      showFeedback("Digite a palavra CANCELAR para confirmar o cancelamento da conta.", "erro");
      return;
    }

    var senhaAtual = formCancelar.senhaAtual.value;
    if (!senhaAtual) {
      showFeedback("Informe a senha atual para cancelar a conta.", "erro");
      return;
    }

    var ok = window.confirm(
      "Último aviso:\n\n" +
        "Ao continuar, a sua conta será cancelada e TODOS os seus dados serão excluídos de forma permanente " +
        "(perfil, foto, currículo, candidaturas, inscrições e Comunidade).\n\n" +
        "Esta ação não pode ser desfeita.\n\n" +
        "Deseja cancelar a conta agora?"
    );
    if (!ok) return;

    btnCancelarConta.disabled = true;
    btnCancelarConta.textContent = "Excluindo dados…";

    fetch(apiBase + "/api/contas/meu-perfil", {
      method: "DELETE",
      headers: ME_APP.authJsonHeaders(),
      body: JSON.stringify({
        senhaAtual: senhaAtual,
        confirmacao: confirmacao,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showFeedback(result.data.error || "Não foi possível cancelar a conta.", "erro");
          return;
        }
        ME_ANALYTICS.track("seguranca_50_conta_cancelada", { page: "seguranca_50" });
        limparDadosLocaisConta();
        window.alert(
          result.data.message || "Conta cancelada. Todos os seus dados foram excluídos."
        );
        window.location.href = "index.html";
      })
      .catch(function () {
        showFeedback("Erro de conexão. Tente novamente.", "erro");
      })
      .finally(function () {
        btnCancelarConta.disabled = false;
        btnCancelarConta.textContent = "Cancelar a conta e excluir meus dados";
      });
  });
})();

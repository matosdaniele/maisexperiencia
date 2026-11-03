(function () {
  var destinoAtual = ME_APP.getCurrentPageDestino();
  var sessao = ME_APP.ensureSession50(ME_APP.buildAuthUrl("entrar_50.html", destinoAtual));
  if (!sessao) return;

  var apiBase = ME_APP.getApiBase();
  var feedback = document.getElementById("feedback");

  var DIAS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // --- Preferência / canal ---
  var canalRadios = document.querySelectorAll("input[name='lm-canal']");
  var telegramBox = document.getElementById("lm-telegram-box");
  var telegramStatus = document.getElementById("lm-telegram-status");
  var telegramConvite = document.getElementById("lm-telegram-convite");
  var telegramLink = document.getElementById("lm-telegram-link");
  var telegramQr = document.getElementById("lm-telegram-qr");
  var btnVincular = document.getElementById("lm-btn-vincular");
  var btnDesvincular = document.getElementById("lm-btn-desvincular");
  var btnRecheck = document.getElementById("lm-btn-recheck");
  var emailHint = document.getElementById("lm-email-hint");
  var optin = document.getElementById("lm-optin");
  var btnSalvarPref = document.getElementById("lm-btn-salvar-pref");

  // --- Medicamentos ---
  var form = document.getElementById("lm-form");
  var editId = document.getElementById("lm-edit-id");
  var inputNome = document.getElementById("lm-nome");
  var inputDose = document.getElementById("lm-dose");
  var inputInstrucoes = document.getElementById("lm-instrucoes");
  var horariosRoot = document.getElementById("lm-horarios");
  var btnAddHorario = document.getElementById("lm-add-horario");
  var diaTodos = document.getElementById("lm-dia-todos");
  var diasWrap = document.getElementById("lm-dias");
  var diasCbs = document.querySelectorAll(".lm-dia-cb");
  var btnSalvarMed = document.getElementById("lm-btn-salvar-med");
  var btnCancelarEdicao = document.getElementById("lm-btn-cancelar-edicao");
  var lista = document.getElementById("lm-lista");

  var prefCache = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideFeedback() {
    if (feedback) feedback.hidden = true;
  }

  function apiGet(path) {
    return fetch(apiBase + path, { headers: ME_APP.getAuthHeaders() }).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, data: data };
      });
    });
  }

  function apiSend(path, method, body) {
    var opcoes = { method: method, headers: ME_APP.authJsonHeaders() };
    if (body !== undefined) opcoes.body = JSON.stringify(body);
    return fetch(apiBase + path, opcoes).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, data: data };
      });
    });
  }

  function canalSelecionado() {
    for (var i = 0; i < canalRadios.length; i += 1) {
      if (canalRadios[i].checked) return canalRadios[i].value;
    }
    return null;
  }

  function setCanalSelecionado(valor) {
    for (var i = 0; i < canalRadios.length; i += 1) {
      canalRadios[i].checked = canalRadios[i].value === valor;
    }
  }

  // ---------------------------------------------------------------------------
  // Preferências
  // ---------------------------------------------------------------------------
  function renderTelegramBox() {
    var canal = canalSelecionado();
    var disponiveis = (prefCache && prefCache.canaisDisponiveis) || {};
    if (canal !== "telegram") {
      telegramBox.hidden = true;
      return;
    }
    telegramBox.hidden = false;
    telegramConvite.hidden = true;
    if (!disponiveis.telegram) {
      telegramStatus.textContent = "O canal Telegram está indisponível no momento.";
      btnVincular.hidden = true;
      btnDesvincular.hidden = true;
      return;
    }
    if (prefCache && prefCache.telegramVinculado) {
      telegramStatus.textContent = "✅ Telegram vinculado.";
      btnVincular.hidden = true;
      btnDesvincular.hidden = false;
    } else {
      telegramStatus.textContent = "Seu Telegram ainda não está vinculado.";
      btnVincular.hidden = false;
      btnDesvincular.hidden = true;
    }
  }

  function aplicarPreferencia(pref) {
    prefCache = pref;
    if (pref.canal) setCanalSelecionado(pref.canal);
    optin.checked = !!pref.optIn;
    if (emailHint && pref.email) {
      emailHint.textContent = "Enviaremos para " + pref.email + ".";
    }
    var disponiveis = pref.canaisDisponiveis || {};
    for (var i = 0; i < canalRadios.length; i += 1) {
      var v = canalRadios[i].value;
      var ok = v === "telegram" ? disponiveis.telegram : disponiveis.email;
      canalRadios[i].disabled = !ok;
    }
    renderTelegramBox();
  }

  function carregarPreferencia() {
    return apiGet("/api/contas/lembretes/preferencia").then(function (result) {
      if (!result.ok || !result.data.preferencia) {
        showFeedback("Não foi possível carregar suas preferências.", "erro");
        return;
      }
      aplicarPreferencia(result.data.preferencia);
    });
  }

  function salvarPreferencia() {
    hideFeedback();
    var canal = canalSelecionado();
    var querAtivar = optin.checked;
    if (querAtivar && !canal) {
      showFeedback("Escolha um canal (Telegram ou e-mail) para ativar os lembretes.", "erro");
      return;
    }
    btnSalvarPref.disabled = true;
    var rotulo = btnSalvarPref.textContent;
    btnSalvarPref.textContent = "Salvando…";
    apiSend("/api/contas/lembretes/preferencia", "PATCH", { canal: canal, optIn: querAtivar })
      .then(function (result) {
        if (!result.ok) {
          showFeedback((result.data && result.data.error) || "Não foi possível salvar.", "erro");
          return;
        }
        showFeedback(result.data.message || "Preferências salvas.", "ok");
        ME_ANALYTICS.track("lembretes_pref_salva", { canal: canal, optIn: querAtivar });
      })
      .catch(function () {
        showFeedback("Erro de conexão ao salvar preferências.", "erro");
      })
      .finally(function () {
        btnSalvarPref.disabled = false;
        btnSalvarPref.textContent = rotulo;
      });
  }

  function gerarCodigoTelegram() {
    hideFeedback();
    btnVincular.disabled = true;
    var rotulo = btnVincular.textContent;
    btnVincular.textContent = "Gerando…";
    apiSend("/api/contas/lembretes/telegram/codigo", "POST")
      .then(function (result) {
        if (!result.ok || !result.data.link) {
          showFeedback((result.data && result.data.error) || "Não foi possível gerar o vínculo.", "erro");
          return;
        }
        telegramLink.href = result.data.link;
        telegramQr.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" +
          encodeURIComponent(result.data.link);
        telegramQr.hidden = false;
        telegramConvite.hidden = false;
        ME_ANALYTICS.track("lembretes_telegram_codigo", {});
      })
      .catch(function () {
        showFeedback("Erro de conexão ao gerar o vínculo.", "erro");
      })
      .finally(function () {
        btnVincular.disabled = false;
        btnVincular.textContent = rotulo;
      });
  }

  function recheckTelegram() {
    btnRecheck.disabled = true;
    carregarPreferencia().then(function () {
      btnRecheck.disabled = false;
      if (prefCache && prefCache.telegramVinculado) {
        showFeedback("Telegram vinculado com sucesso!", "ok");
      } else {
        showFeedback("Ainda não recebemos o vínculo. Toque em Iniciar no Telegram e tente de novo.", "erro");
      }
    });
  }

  function desvincularTelegram() {
    if (!window.confirm("Desvincular seu Telegram? Você deixará de receber lembretes por esse canal.")) return;
    btnDesvincular.disabled = true;
    apiSend("/api/contas/lembretes/telegram", "DELETE")
      .then(function (result) {
        if (!result.ok) {
          showFeedback((result.data && result.data.error) || "Não foi possível desvincular.", "erro");
          return;
        }
        showFeedback("Telegram desvinculado.", "ok");
        return carregarPreferencia();
      })
      .catch(function () {
        showFeedback("Erro de conexão ao desvincular.", "erro");
      })
      .finally(function () {
        btnDesvincular.disabled = false;
      });
  }

  // ---------------------------------------------------------------------------
  // Medicamentos
  // ---------------------------------------------------------------------------
  function criarHorarioRow(valor) {
    var row = document.createElement("div");
    row.className = "lm-horario-row";
    var input = document.createElement("input");
    input.type = "time";
    input.className = "lm-horario-input";
    input.value = valor || "";
    var remover = document.createElement("button");
    remover.type = "button";
    remover.className = "lm-horario-remover";
    remover.setAttribute("aria-label", "Remover horário");
    remover.textContent = "✕";
    remover.addEventListener("click", function () {
      row.remove();
      if (!horariosRoot.querySelector(".lm-horario-row")) criarHorarioRow("");
    });
    row.appendChild(input);
    row.appendChild(remover);
    horariosRoot.appendChild(row);
    return input;
  }

  function lerHorarios() {
    var inputs = horariosRoot.querySelectorAll(".lm-horario-input");
    var out = [];
    for (var i = 0; i < inputs.length; i += 1) {
      var v = String(inputs[i].value || "").trim();
      if (v) out.push(v);
    }
    return out;
  }

  function setHorarios(horarios) {
    horariosRoot.innerHTML = "";
    var valores = horarios && horarios.length ? horarios : [""];
    valores.forEach(function (h) {
      criarHorarioRow(h);
    });
  }

  function lerDias() {
    if (diaTodos.checked) return "todos";
    var out = [];
    for (var i = 0; i < diasCbs.length; i += 1) {
      if (diasCbs[i].checked) out.push(Number(diasCbs[i].value));
    }
    return out;
  }

  function setDias(dias) {
    if (dias === "todos" || dias == null) {
      diaTodos.checked = true;
      diasWrap.hidden = true;
      for (var i = 0; i < diasCbs.length; i += 1) diasCbs[i].checked = false;
      return;
    }
    diaTodos.checked = false;
    diasWrap.hidden = false;
    for (var j = 0; j < diasCbs.length; j += 1) {
      diasCbs[j].checked = dias.indexOf(Number(diasCbs[j].value)) !== -1;
    }
  }

  function diasTexto(dias) {
    if (dias === "todos" || dias == null) return "Todos os dias";
    if (!dias.length) return "Todos os dias";
    return dias
      .map(function (d) {
        return DIAS_LABEL[d];
      })
      .join(", ");
  }

  function resetForm() {
    editId.value = "";
    form.reset();
    setHorarios([""]);
    setDias("todos");
    btnSalvarMed.textContent = "Adicionar medicamento";
    btnCancelarEdicao.hidden = true;
  }

  function medItemHtml(med) {
    var badge = med.ativo
      ? '<span class="lm-badge lm-badge--ativo">Ativo</span>'
      : '<span class="lm-badge lm-badge--pausado">Pausado</span>';
    return (
      '<li class="lm-item" data-id="' + escapeHtml(med.id) + '">' +
      '<div class="lm-item-info">' +
      '<p class="lm-item-nome">' + escapeHtml(med.nome) +
      (med.dose ? ' <span class="lm-item-dose">' + escapeHtml(med.dose) + "</span>" : "") +
      " " + badge + "</p>" +
      '<p class="lm-item-meta">🕑 ' + escapeHtml(med.horarios.join(", ")) +
      " · " + escapeHtml(diasTexto(med.diasSemana)) + "</p>" +
      (med.instrucoes ? '<p class="lm-item-instr">' + escapeHtml(med.instrucoes) + "</p>" : "") +
      "</div>" +
      '<div class="lm-item-acoes">' +
      '<button type="button" class="btn btn-small btn-secondary" data-acao="editar">Editar</button>' +
      '<button type="button" class="btn btn-small btn-secondary" data-acao="toggle">' +
      (med.ativo ? "Pausar" : "Reativar") + "</button>" +
      '<button type="button" class="btn btn-small btn-danger" data-acao="excluir">Excluir</button>' +
      "</div>" +
      "</li>"
    );
  }

  function renderMedicamentos(meds) {
    if (!meds.length) {
      lista.innerHTML = '<li class="lm-vazio">Você ainda não cadastrou medicamentos.</li>';
      return;
    }
    lista.innerHTML = meds.map(medItemHtml).join("");
  }

  function carregarMedicamentos() {
    return apiGet("/api/contas/medicamentos").then(function (result) {
      if (!result.ok) {
        showFeedback("Não foi possível carregar seus medicamentos.", "erro");
        return;
      }
      renderMedicamentos(result.data.medicamentos || []);
    });
  }

  function coletarMed() {
    return {
      nome: inputNome.value.trim(),
      dose: inputDose.value.trim(),
      instrucoes: inputInstrucoes.value.trim(),
      horarios: lerHorarios(),
      diasSemana: lerDias(),
    };
  }

  function validarLocal(dados) {
    if (window.ME_MEDICACAO && ME_MEDICACAO.validarMedicamento) {
      var check = ME_MEDICACAO.validarMedicamento(dados);
      if (!check.ok) return check.error;
    }
    return null;
  }

  function submitMed(event) {
    event.preventDefault();
    hideFeedback();
    var dados = coletarMed();
    var erro = validarLocal(dados);
    if (erro) {
      showFeedback(erro, "erro");
      return;
    }
    var id = editId.value;
    var path = id ? "/api/contas/medicamentos/" + encodeURIComponent(id) : "/api/contas/medicamentos";
    var metodo = id ? "PATCH" : "POST";
    btnSalvarMed.disabled = true;
    apiSend(path, metodo, dados)
      .then(function (result) {
        if (!result.ok) {
          showFeedback((result.data && result.data.error) || "Não foi possível salvar.", "erro");
          return;
        }
        showFeedback(result.data.message || "Medicamento salvo.", "ok");
        resetForm();
        ME_ANALYTICS.track(id ? "lembretes_med_editado" : "lembretes_med_criado", {});
        return carregarMedicamentos();
      })
      .catch(function () {
        showFeedback("Erro de conexão ao salvar o medicamento.", "erro");
      })
      .finally(function () {
        btnSalvarMed.disabled = false;
      });
  }

  function preencherEdicao(med) {
    editId.value = med.id;
    inputNome.value = med.nome || "";
    inputDose.value = med.dose || "";
    inputInstrucoes.value = med.instrucoes || "";
    setHorarios(med.horarios || [""]);
    setDias(med.diasSemana);
    btnSalvarMed.textContent = "Salvar alterações";
    btnCancelarEdicao.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function acaoNaLista(event) {
    var botao = event.target.closest("button[data-acao]");
    if (!botao) return;
    var li = botao.closest(".lm-item");
    if (!li) return;
    var id = li.getAttribute("data-id");
    var acao = botao.getAttribute("data-acao");

    if (acao === "editar") {
      apiGet("/api/contas/medicamentos").then(function (result) {
        var med = (result.data.medicamentos || []).filter(function (m) {
          return m.id === id;
        })[0];
        if (med) preencherEdicao(med);
      });
      return;
    }

    if (acao === "toggle") {
      var ativarAgora = botao.textContent.trim() === "Reativar";
      apiSend("/api/contas/medicamentos/" + encodeURIComponent(id), "PATCH", { ativo: ativarAgora })
        .then(function (result) {
          if (!result.ok) {
            showFeedback((result.data && result.data.error) || "Não foi possível atualizar.", "erro");
            return;
          }
          return carregarMedicamentos();
        })
        .catch(function () {
          showFeedback("Erro de conexão.", "erro");
        });
      return;
    }

    if (acao === "excluir") {
      if (!window.confirm("Excluir este medicamento e seus lembretes?")) return;
      apiSend("/api/contas/medicamentos/" + encodeURIComponent(id), "DELETE")
        .then(function (result) {
          if (!result.ok) {
            showFeedback((result.data && result.data.error) || "Não foi possível excluir.", "erro");
            return;
          }
          showFeedback("Medicamento removido.", "ok");
          return carregarMedicamentos();
        })
        .catch(function () {
          showFeedback("Erro de conexão ao excluir.", "erro");
        });
    }
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  for (var i = 0; i < canalRadios.length; i += 1) {
    canalRadios[i].addEventListener("change", renderTelegramBox);
  }
  btnSalvarPref.addEventListener("click", salvarPreferencia);
  btnVincular.addEventListener("click", gerarCodigoTelegram);
  btnRecheck.addEventListener("click", recheckTelegram);
  btnDesvincular.addEventListener("click", desvincularTelegram);

  btnAddHorario.addEventListener("click", function () {
    criarHorarioRow("");
  });
  diaTodos.addEventListener("change", function () {
    diasWrap.hidden = diaTodos.checked;
    if (diaTodos.checked) {
      for (var k = 0; k < diasCbs.length; k += 1) diasCbs[k].checked = false;
    }
  });
  form.addEventListener("submit", submitMed);
  btnCancelarEdicao.addEventListener("click", resetForm);
  lista.addEventListener("click", acaoNaLista);

  // Init
  setHorarios([""]);
  setDias("todos");
  ME_ANALYTICS.track("lembretes_medicacao_50_visita", { page: "lembretes_medicacao_50" });
  carregarPreferencia();
  carregarMedicamentos();
})();

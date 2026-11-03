(function () {
  var sessao = ME_APP.ensureSession50(
    ME_APP.buildAuthUrl("entrar_50.html", "meu_curriculo_50.html")
  );
  if (!sessao) return;

  var IDIOMA_OPCOES = [
    { value: "", label: "Selecione…" },
    { value: "Português", label: "Português" },
    { value: "Inglês", label: "Inglês" },
    { value: "Espanhol", label: "Espanhol" },
    { value: "Francês", label: "Francês" },
    { value: "Alemão", label: "Alemão" },
    { value: "Italiano", label: "Italiano" },
    { value: "Mandarim", label: "Mandarim" },
    { value: "Japonês", label: "Japonês" },
    { value: "Outro", label: "Outro" },
  ];

  var NIVEL_OPCOES = [
    { value: "", label: "Selecione…" },
    { value: "Básico", label: "Básico" },
    { value: "Intermediário", label: "Intermediário" },
    { value: "Intermediário avançado", label: "Intermediário avançado" },
    { value: "Avançado", label: "Avançado" },
    { value: "Fluente", label: "Fluente" },
    { value: "Nativo", label: "Nativo" },
    { value: "Outro", label: "Outro" },
  ];

  var ESTADOS_BR = [
    { value: "", label: "Selecione…" },
    { value: "AC", label: "AC" },
    { value: "AL", label: "AL" },
    { value: "AP", label: "AP" },
    { value: "AM", label: "AM" },
    { value: "BA", label: "BA" },
    { value: "CE", label: "CE" },
    { value: "DF", label: "DF" },
    { value: "ES", label: "ES" },
    { value: "GO", label: "GO" },
    { value: "MA", label: "MA" },
    { value: "MT", label: "MT" },
    { value: "MS", label: "MS" },
    { value: "MG", label: "MG" },
    { value: "PA", label: "PA" },
    { value: "PB", label: "PB" },
    { value: "PR", label: "PR" },
    { value: "PE", label: "PE" },
    { value: "PI", label: "PI" },
    { value: "RJ", label: "RJ" },
    { value: "RN", label: "RN" },
    { value: "RS", label: "RS" },
    { value: "RO", label: "RO" },
    { value: "RR", label: "RR" },
    { value: "SC", label: "SC" },
    { value: "SP", label: "SP" },
    { value: "SE", label: "SE" },
    { value: "TO", label: "TO" },
  ];

  var apiBase = ME_APP.getApiBase();
  var feedback = document.getElementById("feedback");
  var saveStatus = document.getElementById("save-status");
  var form = document.getElementById("form-criar-curriculo");
  var fotoPreview = document.getElementById("foto-preview");
  var fotoPlaceholder = document.getElementById("foto-placeholder");

  var curriculoCache = null;
  var fotoPendente = null;
  var saveTimer = null;
  var saveInFlight = false;
  var saveQueued = false;
  var saveStatusTimer = null;
  var formReady = false;

  ME_ANALYTICS.track("meu_curriculo_50_visita", { page: "meu_curriculo_50" });

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

  function showSaveStatus(message, type) {
    if (!saveStatus) return;
    saveStatus.hidden = false;
    saveStatus.textContent = message;
    saveStatus.className = "curriculo-save-status" + (type ? " is-" + type : "");
    if (saveStatusTimer) {
      clearTimeout(saveStatusTimer);
    }
    if (type === "ok") {
      saveStatusTimer = setTimeout(function () {
        saveStatus.hidden = true;
      }, 3000);
    }
  }

  function prefillContactFromPlatform() {
    if (!form) return;
    var conta = curriculoCache && curriculoCache.conta ? curriculoCache.conta : {};
    form.nome.value = conta.nome || sessao.nome || form.nome.value;
    form.email.value = sessao.email || conta.email || form.email.value;
    if (conta.telefone || !form.telefone.value) {
      form.telefone.value = conta.telefone || form.telefone.value || "";
    }
  }

  function openAccordion(id) {
    var accordion = document.getElementById(id);
    if (accordion) {
      accordion.open = true;
    }
  }

  function buildSelectOptions(options, selected) {
    return options
      .map(function (opt) {
        var sel = opt.value === selected ? " selected" : "";
        return "<option value=\"" + escapeHtml(opt.value) + "\"" + sel + ">" + escapeHtml(opt.label) + "</option>";
      })
      .join("");
  }

  function initEstadoSelect() {
    var select = document.getElementById("estado");
    if (!select) return;
    select.innerHTML = buildSelectOptions(ESTADOS_BR, select.value || "");
  }

  function parseLocalizacao(localizacao) {
    var text = String(localizacao || "").trim();
    if (!text) {
      return { cidade: "", estado: "" };
    }

    var match = text.match(/^(.+?),\s*([A-Za-z]{2})$/);
    if (match) {
      return {
        cidade: match[1].trim(),
        estado: match[2].toUpperCase(),
      };
    }

    var parts = text.split(/[,–-]/).map(function (part) {
      return part.trim();
    }).filter(Boolean);

    if (parts.length >= 2) {
      var uf = parts[parts.length - 1].toUpperCase();
      var isUf = ESTADOS_BR.some(function (item) {
        return item.value === uf;
      });
      if (isUf) {
        return {
          cidade: parts.slice(0, -1).join(", ").trim(),
          estado: uf,
        };
      }
    }

    return { cidade: text, estado: "" };
  }

  function buildLocalizacao(cidade, estado) {
    var city = String(cidade || "").trim();
    var uf = String(estado || "").trim().toUpperCase();
    if (city && uf) {
      return city + ", " + uf;
    }
    if (city) {
      return city;
    }
    if (uf) {
      return uf;
    }
    return "";
  }

  function fillLocalizacao(localizacao) {
    if (!form) return;
    var parsed = parseLocalizacao(localizacao);
    form.cidade.value = parsed.cidade;
    form.estado.value = parsed.estado;
  }

  function matchIdiomaOption(value) {
    var normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "";
    var found = IDIOMA_OPCOES.find(function (opt) {
      return opt.value && opt.value.toLowerCase() === normalized;
    });
    if (found) return found.value;
    if (/portugu/i.test(normalized)) return "Português";
    if (/ingl|english/i.test(normalized)) return "Inglês";
    if (/espan|spanish/i.test(normalized)) return "Espanhol";
    if (/franc|french/i.test(normalized)) return "Francês";
    if (/alem|german/i.test(normalized)) return "Alemão";
    if (/ital/i.test(normalized)) return "Italiano";
    return "Outro";
  }

  function matchNivelOption(value) {
    var normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "";
    var found = NIVEL_OPCOES.find(function (opt) {
      return opt.value && opt.value.toLowerCase() === normalized;
    });
    if (found) return found.value;
    if (/nativ|biling|bilíng|bilingue/i.test(normalized)) return "Nativo";
    if (/fluen|full professional/i.test(normalized)) return "Fluente";
    if (/avan|advanced|professional working/i.test(normalized)) return "Avançado";
    if (/intermedi/i.test(normalized)) return "Intermediário";
    if (/básic|basic|elementary|limited/i.test(normalized)) return "Básico";
    return "Outro";
  }

  function fillFormImportLinkedIn(perfil, options) {
    options = options || {};
    if (!perfil || !form) return;
    form.resumo.value = perfil.resumo || "";
    resetRepeatList("lista-formacao", "formacao", perfil.formacao);
    if (perfil.experiencias && perfil.experiencias.length) {
      resetRepeatList("lista-experiencias", "experiencia", perfil.experiencias);
    }
    if (perfil.linkedinUrl) {
      form.linkedinUrl.value = perfil.linkedinUrl;
    }
    if (options.openSections) {
      openAccordion("accordion-curriculo");
    }
    scheduleAutoSave();
  }

  function fillForm(perfil) {
    if (!perfil || !form) return;
    prefillContactFromPlatform();
    fillLocalizacao(perfil.localizacao);
    form.linkedinUrl.value = perfil.linkedinUrl || "";
    form.resumo.value = perfil.resumo || "";
    resetRepeatList("lista-idiomas", "idioma", perfil.idiomas);
    resetRepeatList("lista-experiencias", "experiencia", perfil.experiencias);
    resetRepeatList("lista-formacao", "formacao", perfil.formacao);
    fotoPendente = perfil.fotoDataUrl || null;
    mostrarFoto(fotoPendente);
  }

  function createRepeatItem(type, data, index) {
    data = data || {};
    var wrap = document.createElement("div");
    wrap.className = "curriculo-repeat-item";
    wrap.setAttribute("data-repeat-type", type);

    if (type === "idioma") {
      var idiomaVal = matchIdiomaOption(data.idioma);
      var nivelVal = matchNivelOption(data.nivel);
      wrap.innerHTML =
        "<div class=\"curriculo-repeat-grid\">" +
        "<div><label>Idioma</label><select name=\"idioma-" + index + "\">" +
        buildSelectOptions(IDIOMA_OPCOES, idiomaVal) +
        "</select></div>" +
        "<div><label>Nível</label><select name=\"nivel-" + index + "\">" +
        buildSelectOptions(NIVEL_OPCOES, nivelVal) +
        "</select></div>" +
        "</div>" +
        "<button type=\"button\" class=\"btn-link-remove\">Remover</button>";
    } else if (type === "experiencia") {
      wrap.innerHTML =
        "<div><label>Empresa</label><input type=\"text\" name=\"exp-empresa-" + index + "\" value=\"" + escapeHtml(data.empresa) + "\"></div>" +
        "<div><label>Cargo</label><input type=\"text\" name=\"exp-cargo-" + index + "\" value=\"" + escapeHtml(data.cargo) + "\"></div>" +
        "<div class=\"curriculo-repeat-grid\">" +
        "<div><label>Período</label><input type=\"text\" name=\"exp-periodo-" + index + "\" value=\"" + escapeHtml(data.periodo) + "\" placeholder=\"Ex.: jan 2020 – mar 2024\"></div>" +
        "<div><label>Local</label><input type=\"text\" name=\"exp-local-" + index + "\" value=\"" + escapeHtml(data.local) + "\" placeholder=\"Cidade, Estado\"></div>" +
        "</div>" +
        "<div><label>Descrição</label><textarea name=\"exp-descricao-" + index + "\" rows=\"4\" placeholder=\"Principais responsabilidades e resultados\">" + escapeHtml(data.descricao) + "</textarea></div>" +
        "<button type=\"button\" class=\"btn-link-remove\">Remover</button>";
    } else if (type === "formacao") {
      wrap.innerHTML =
        "<div><label>Instituição</label><input type=\"text\" name=\"form-inst-" + index + "\" value=\"" + escapeHtml(data.instituicao) + "\"></div>" +
        "<div><label>Curso / formação</label><input type=\"text\" name=\"form-curso-" + index + "\" value=\"" + escapeHtml(data.curso) + "\"></div>" +
        "<div><label>Período</label><input type=\"text\" name=\"form-periodo-" + index + "\" value=\"" + escapeHtml(data.periodo) + "\" placeholder=\"Ex.: 2014 – 2016\"></div>" +
        "<button type=\"button\" class=\"btn-link-remove\">Remover</button>";
    }

    wrap.querySelector(".btn-link-remove").addEventListener("click", function () {
      wrap.remove();
      scheduleAutoSave();
    });
    return wrap;
  }

  function resetRepeatList(listId, type, items) {
    var list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = "";
    var data = items && items.length ? items : [{}];
    data.forEach(function (item, index) {
      list.appendChild(createRepeatItem(type, item, index));
    });
  }

  function collectRepeatIdiomas() {
    return Array.from(document.querySelectorAll("#lista-idiomas .curriculo-repeat-item")).map(function (item) {
      return {
        idioma: item.querySelector("select[name^='idioma-']").value.trim(),
        nivel: item.querySelector("select[name^='nivel-']").value.trim(),
      };
    }).filter(function (row) {
      return row.idioma;
    });
  }

  function collectRepeatExperiencias() {
    return Array.from(document.querySelectorAll("#lista-experiencias .curriculo-repeat-item")).map(function (item) {
      return {
        empresa: item.querySelector("input[name^='exp-empresa-']").value.trim(),
        cargo: item.querySelector("input[name^='exp-cargo-']").value.trim(),
        periodo: item.querySelector("input[name^='exp-periodo-']").value.trim(),
        local: item.querySelector("input[name^='exp-local-']").value.trim(),
        descricao: item.querySelector("textarea[name^='exp-descricao-']").value.trim(),
      };
    }).filter(function (row) {
      return row.empresa || row.cargo;
    });
  }

  function collectRepeatFormacao() {
    return Array.from(document.querySelectorAll("#lista-formacao .curriculo-repeat-item")).map(function (item) {
      return {
        instituicao: item.querySelector("input[name^='form-inst-']").value.trim(),
        curso: item.querySelector("input[name^='form-curso-']").value.trim(),
        periodo: item.querySelector("input[name^='form-periodo-']").value.trim(),
      };
    }).filter(function (row) {
      return row.instituicao || row.curso;
    });
  }

  function mostrarFoto(dataUrl) {
    if (!dataUrl) {
      fotoPreview.hidden = true;
      fotoPreview.removeAttribute("src");
      fotoPlaceholder.hidden = false;
      return;
    }
    fotoPreview.src = dataUrl;
    fotoPreview.hidden = false;
    fotoPlaceholder.hidden = true;
  }

  function collectFormData() {
    return {
      nome: form.nome.value.trim(),
      titulo: "",
      localizacao: buildLocalizacao(form.cidade.value, form.estado.value),
      email: form.email.value.trim().toLowerCase(),
      telefone: form.telefone.value.trim(),
      linkedinUrl: form.linkedinUrl.value.trim(),
      resumo: form.resumo.value.trim(),
      competencias: [],
      idiomas: collectRepeatIdiomas(),
      experiencias: collectRepeatExperiencias(),
      formacao: collectRepeatFormacao(),
      fotoDataUrl: fotoPendente,
    };
  }

  function getIniciais(nome) {
    var parts = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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
    if (!experiencias.length) return "";
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
    if (!formacao.length) return "";
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

  function renderIdiomas(idiomas) {
    if (!idiomas.length) return "";
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
      renderMetaLine("Localização", perfil.localizacao) +
      renderMetaLine("E-mail", perfil.email) +
      renderMetaLine("Telefone", perfil.telefone) +
      renderLinkedInMeta(perfil.linkedinUrl) +
      "</div></header>" +
      "<div class=\"curriculo-print-body\">" +
      resumoSection +
      renderExperiencias(perfil.experiencias) +
      renderFormacao(perfil.formacao) +
      renderIdiomas(perfil.idiomas) +
      "</div>"
    );
  }

  var previewModal = document.getElementById("curriculo-preview-modal");
  var previewContent = document.getElementById("curriculo-preview-content");

  function openPreviewModal() {
    if (!previewModal || !previewContent) return;
    var perfil = collectFormData();
    if (perfil.nome.length < 2) {
      showFeedback("Informe o seu nome na seção Contato para visualizar o currículo.", "erro");
      openAccordion("accordion-contato");
      return;
    }
    previewContent.innerHTML = renderCurriculoPreview(perfil);
    previewModal.hidden = false;
    document.body.style.overflow = "hidden";
    ME_ANALYTICS.track("meu_curriculo_50_visualizar", { page: "meu_curriculo_50" });
  }

  function closePreviewModal() {
    if (!previewModal) return;
    previewModal.hidden = true;
    document.body.style.overflow = "";
  }

  function printCurriculo() {
    document.body.classList.add("curriculo-print-mode");
    ME_ANALYTICS.track("meu_curriculo_50_imprimir", { page: "meu_curriculo_50" });
    window.print();
    window.addEventListener("afterprint", function handler() {
      document.body.classList.remove("curriculo-print-mode");
      window.removeEventListener("afterprint", handler);
    });
  }

  document.getElementById("btn-visualizar-curriculo").addEventListener("click", openPreviewModal);
  document.getElementById("btn-fechar-preview").addEventListener("click", closePreviewModal);
  document.getElementById("btn-imprimir-curriculo").addEventListener("click", printCurriculo);
  document.getElementById("curriculo-preview-backdrop").addEventListener("click", closePreviewModal);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && previewModal && !previewModal.hidden) {
      closePreviewModal();
    }
  });

  function scheduleAutoSave() {
    if (!formReady) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(autoSaveCurriculo, 1200);
  }

  function autoSaveCurriculo() {
    if (!form) return;
    var perfil = collectFormData();
    if (perfil.nome.length < 2) {
      return;
    }

    if (saveInFlight) {
      saveQueued = true;
      return;
    }

    saveInFlight = true;
    showSaveStatus("Salvando…", "saving");

    fetch(apiBase + "/api/contas/curriculo", {
      method: "PATCH",
      headers: ME_APP.authJsonHeaders(),
      body: JSON.stringify({
        perfil: perfil,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showSaveStatus(result.data.error || "Não foi possível salvar.", "erro");
          return;
        }
        ME_ANALYTICS.track("meu_curriculo_50_sucesso", { page: "meu_curriculo_50", auto: true });
        curriculoCache = {
          hasPerfil: true,
          updatedAt: result.data.curriculo.updatedAt,
          perfil: result.data.curriculo.perfil,
          conta: curriculoCache && curriculoCache.conta
            ? curriculoCache.conta
            : { nome: sessao.nome, email: sessao.email },
        };
        showSaveStatus("Currículo salvo automaticamente.", "ok");
      })
      .catch(function () {
        showSaveStatus("Erro de conexão ao salvar.", "erro");
      })
      .finally(function () {
        saveInFlight = false;
        if (saveQueued) {
          saveQueued = false;
          scheduleAutoSave();
        }
      });
  }

  function showImportFeedback(result, defaultMessage, trackEvent) {
    if (!result.ok) {
      showFeedback(result.data.error || defaultMessage, "erro");
      return;
    }

    fillFormImportLinkedIn(result.data.perfil, { openSections: true });
    prefillContactFromPlatform();

    if (trackEvent) {
      ME_ANALYTICS.track(trackEvent, {
        page: "meu_curriculo_50",
        source: result.data.source || "unknown",
      });
    }

    var imported = result.data.imported || {};
    var partes = [];
    if (imported.experiencias) partes.push(imported.experiencias + " experiência(s)");
    if (imported.formacao) partes.push(imported.formacao + " formação(ões)");
    if (result.data.perfil && result.data.perfil.resumo) partes.push("resumo profissional");

    showFeedback(
      "Importação concluída." +
        (partes.length ? " Preenchido: " + partes.join(", ") + "." : "") +
        " Valide na seção Experiências.",
      "ok"
    );
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("read_error"));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadCurriculo() {
    return fetch(apiBase + "/api/contas/curriculo", { headers: ME_APP.getAuthHeaders() })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.curriculo) {
          curriculoCache = result.data.curriculo;
        }
        return curriculoCache;
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  form.addEventListener("input", scheduleAutoSave);
  form.addEventListener("change", scheduleAutoSave);

  document.getElementById("btn-add-idioma").addEventListener("click", function () {
    document.getElementById("lista-idiomas").appendChild(
      createRepeatItem("idioma", {}, Date.now())
    );
    scheduleAutoSave();
  });

  document.getElementById("btn-add-experiencia").addEventListener("click", function () {
    document.getElementById("lista-experiencias").appendChild(
      createRepeatItem("experiencia", {}, Date.now())
    );
    scheduleAutoSave();
  });

  document.getElementById("btn-add-formacao").addEventListener("click", function () {
    document.getElementById("lista-formacao").appendChild(
      createRepeatItem("formacao", {}, Date.now())
    );
    scheduleAutoSave();
  });

  document.getElementById("btn-importar-pdf").addEventListener("click", function () {
    var input = document.getElementById("arquivo-pdf");
    var btnPdf = document.getElementById("btn-importar-pdf");
    var file = input.files && input.files[0];

    if (!file) {
      showFeedback("Seleccione um arquivo PDF antes de continuar.", "erro");
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      showFeedback("Use um arquivo PDF válido.", "erro");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showFeedback("O PDF deve ter no máximo 2 MB.", "erro");
      return;
    }

    feedback.hidden = true;
    btnPdf.disabled = true;
    btnPdf.textContent = "A importar…";

    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        return fetch(apiBase + "/api/contas/curriculo/importar-pdf", {
          method: "POST",
          headers: ME_APP.authJsonHeaders(),
          body: JSON.stringify({
            curriculoDataUrl: dataUrl,
          }),
        }).then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        });
      })
      .then(function (result) {
        showImportFeedback(
          result,
          "Não foi possível importar o PDF.",
          "meu_curriculo_50_pdf_import"
        );
      })
      .catch(function () {
        showFeedback("Erro de conexão ao importar o PDF. Tente novamente.", "erro");
      })
      .finally(function () {
        btnPdf.disabled = false;
        btnPdf.textContent = "Importar PDF salvo do LinkedIn";
      });
  });

  document.getElementById("arquivo-foto").addEventListener("change", function (event) {
    feedback.hidden = true;
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    ME_APP.prepareImageUpload(file)
      .then(function (dataUrl) {
        fotoPendente = dataUrl;
        mostrarFoto(fotoPendente);
        openAccordion("accordion-foto");
        scheduleAutoSave();
        if (file.size > 400 * 1024) {
          showFeedback("Foto reduzida automaticamente para caber no limite.", "ok");
        }
      })
      .catch(function (err) {
        showFeedback((err && err.message) || "Não foi possível ler a imagem.", "erro");
        event.target.value = "";
      });
  });

  var btnUsarFotoPerfil = document.getElementById("btn-usar-foto-perfil");
  if (btnUsarFotoPerfil) {
    btnUsarFotoPerfil.addEventListener("click", function () {
      feedback.hidden = true;
      var rotulo = btnUsarFotoPerfil.textContent;
      btnUsarFotoPerfil.disabled = true;
      btnUsarFotoPerfil.textContent = "Carregando…";
      fetch(apiBase + "/api/contas/meu-perfil", { headers: ME_APP.getAuthHeaders() })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.data.perfil) {
            showFeedback("Não foi possível obter a foto do Perfil.", "erro");
            return;
          }
          var foto = result.data.perfil.fotoPerfilDataUrl;
          if (!foto) {
            showFeedback(
              "Você ainda não tem foto no Perfil. Adicione uma foto no Perfil e tente de novo.",
              "erro"
            );
            return;
          }
          fotoPendente = foto;
          mostrarFoto(fotoPendente);
          openAccordion("accordion-foto");
          scheduleAutoSave();
          showFeedback("Foto do Perfil aplicada ao currículo.", "ok");
          ME_ANALYTICS.track("meu_curriculo_50_foto_do_perfil", {
            page: "meu_curriculo_50",
          });
        })
        .catch(function () {
          showFeedback("Erro de conexão ao obter a foto do Perfil.", "erro");
        })
        .finally(function () {
          btnUsarFotoPerfil.disabled = false;
          btnUsarFotoPerfil.textContent = rotulo;
        });
    });
  }

  loadCurriculo().then(function () {
    initEstadoSelect();
    resetRepeatList("lista-idiomas", "idioma", [{}]);
    resetRepeatList("lista-experiencias", "experiencia", [{}]);
    resetRepeatList("lista-formacao", "formacao", [{}]);
    prefillContactFromPlatform();
    if (curriculoCache && curriculoCache.hasPerfil && curriculoCache.perfil) {
      fillForm(curriculoCache.perfil);
    }
    formReady = true;
  });
})();

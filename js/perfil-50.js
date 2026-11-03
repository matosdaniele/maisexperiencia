(function () {
  var sessao = ME_APP.ensureSession50(
    ME_APP.buildAuthUrl("entrar_50.html", "perfil_50.html")
  );
  if (!sessao) return;

  var INTERESSES = [
    { id: "caminhada", label: "Caminhada" },
    { id: "danca", label: "Dança" },
    { id: "cinema", label: "Cinema" },
    { id: "viagens", label: "Viagens" },
    { id: "netos", label: "Netos" },
    { id: "cafe", label: "Café" },
    { id: "livros", label: "Livros" },
    { id: "musica", label: "Música" },
    { id: "jardinagem", label: "Jardinagem" },
    { id: "teatro", label: "Teatro" },
    { id: "yoga", label: "Yoga" },
    { id: "culinaria", label: "Culinária" },
    { id: "fotografia", label: "Fotografia" },
    { id: "trilha", label: "Trilha" },
    { id: "feiras", label: "Feiras" },
    { id: "esportes", label: "Esportes" },
  ];

  var ESTADOS_BR = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ];

  var apiBase = ME_APP.getApiBase();
  var feedback = document.getElementById("feedback");
  var formFoto = document.getElementById("form-foto");
  var formComunidade = document.getElementById("form-comunidade");
  var fotoPreview = document.getElementById("foto-preview");
  var fotoPlaceholder = document.getElementById("foto-placeholder");
  var fotoCropFrame = document.getElementById("foto-crop-frame");
  var fotoCropHint = document.getElementById("foto-crop-hint");
  var labelFoto = document.getElementById("label-foto");
  var btnSalvarFoto = document.getElementById("btn-salvar-foto");
  var btnSalvarComunidade = document.getElementById("btn-salvar-comunidade");
  var arquivoFoto = document.getElementById("arquivo-foto");
  var interessesGrid = document.getElementById("interesses-grid");
  var interessesCount = document.getElementById("interesses-count");
  var bioEl = document.getElementById("bio");
  var bioCount = document.getElementById("bio-count");
  var estadoUfSelect = document.getElementById("estado-uf");
  var interesseOutroAtivo = document.getElementById("interesse-outro-ativo");
  var interesseOutroInput = document.getElementById("interesse-outro");
  var idadeContaAtual = null;

  var MAX_SOURCE_BYTES = 8 * 1024 * 1024;
  var MAX_OUTPUT_BYTES = 400 * 1024;
  var OUTPUT_SIZE = 512;

  var fotoPendente = null;
  var temFotoPerfil = false;
  var crop = {
    naturalW: 0,
    naturalH: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    dirty: false,
  };

  ME_ANALYTICS.track("perfil_50_visita", { page: "perfil_50" });

  function showFeedback(message, type) {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "feedback feedback--" + type;
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function atualizarLabelFoto() {
    if (!labelFoto) return;
    labelFoto.textContent = temFotoPerfil || fotoPendente ? "Alterar foto" : "Adicionar foto";
  }

  function atualizarEstadoSalvar() {
    btnSalvarFoto.disabled = !(fotoPendente || crop.dirty);
  }

  function aplicarTransform() {
    fotoPreview.style.transform =
      "translate(calc(-50% + " + crop.offsetX + "px), calc(-50% + " + crop.offsetY + "px))";
  }

  function clampOffsets() {
    var fw = fotoCropFrame.clientWidth;
    var fh = fotoCropFrame.clientHeight;
    var iw = crop.naturalW * crop.scale;
    var ih = crop.naturalH * crop.scale;
    var maxX = Math.max(0, (iw - fw) / 2);
    var maxY = Math.max(0, (ih - fh) / 2);
    crop.offsetX = Math.min(maxX, Math.max(-maxX, crop.offsetX));
    crop.offsetY = Math.min(maxY, Math.max(-maxY, crop.offsetY));
  }

  function ajustarEscalaCover() {
    var fw = fotoCropFrame.clientWidth;
    var fh = fotoCropFrame.clientHeight;
    if (!fw || !fh || !crop.naturalW || !crop.naturalH) return;
    crop.scale = Math.max(fw / crop.naturalW, fh / crop.naturalH);
    fotoPreview.style.width = crop.naturalW * crop.scale + "px";
    fotoPreview.style.height = crop.naturalH * crop.scale + "px";
    clampOffsets();
    aplicarTransform();
  }

  function limparFoto() {
    fotoPreview.hidden = true;
    fotoPreview.removeAttribute("src");
    fotoPreview.style.width = "";
    fotoPreview.style.height = "";
    fotoPreview.style.transform = "translate(-50%, -50%)";
    fotoPlaceholder.hidden = false;
    fotoCropHint.hidden = true;
    fotoCropFrame.classList.remove("has-foto", "is-dragging");
    crop.naturalW = 0;
    crop.naturalH = 0;
    crop.scale = 1;
    crop.offsetX = 0;
    crop.offsetY = 0;
    crop.dirty = false;
  }

  function mostrarFoto(dataUrl, options) {
    var opts = options || {};
    if (!dataUrl) {
      limparFoto();
      return;
    }

    fotoPlaceholder.hidden = true;
    fotoCropHint.hidden = false;
    fotoCropFrame.classList.add("has-foto");
    fotoPreview.hidden = false;

    function onReady() {
      crop.naturalW = fotoPreview.naturalWidth;
      crop.naturalH = fotoPreview.naturalHeight;
      crop.offsetX = 0;
      crop.offsetY = 0;
      crop.dirty = !!opts.dirty;
      ajustarEscalaCover();
      atualizarEstadoSalvar();
    }

    if (fotoPreview.src === dataUrl && fotoPreview.complete && fotoPreview.naturalWidth) {
      onReady();
      return;
    }

    fotoPreview.onload = onReady;
    fotoPreview.src = dataUrl;
  }

  function exportarFotoRecortada() {
    return new Promise(function (resolve, reject) {
      if (!fotoPreview.src || !crop.naturalW || !crop.naturalH) {
        reject(new Error("Sem foto para exportar."));
        return;
      }

      var fw = fotoCropFrame.clientWidth;
      var fh = fotoCropFrame.clientHeight;
      var iw = crop.naturalW * crop.scale;
      var ih = crop.naturalH * crop.scale;
      var dx = fw / 2 - iw / 2 + crop.offsetX;
      var dy = fh / 2 - ih / 2 + crop.offsetY;
      var sx = (0 - dx) / crop.scale;
      var sy = (0 - dy) / crop.scale;
      var sw = fw / crop.scale;
      var sh = fh / crop.scale;

      var canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponível."));
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.drawImage(fotoPreview, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      var qualities = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45];
      var i = 0;

      function tryNext() {
        if (i >= qualities.length) {
          reject(new Error("A foto ficou acima de 400 KB após o recorte. Escolha outra imagem."));
          return;
        }
        var dataUrl = canvas.toDataURL("image/jpeg", qualities[i]);
        i += 1;
        var base64 = dataUrl.split(",")[1] || "";
        var size = Math.floor((base64.length * 3) / 4);
        if (size <= MAX_OUTPUT_BYTES) {
          resolve(dataUrl);
          return;
        }
        tryNext();
      }

      tryNext();
    });
  }

  function renderInteresses(selected) {
    var selectedSet = {};
    (selected || []).forEach(function (id) {
      selectedSet[id] = true;
    });
    interessesGrid.innerHTML = INTERESSES.map(function (item) {
      return (
        '<label class="interesses-option">' +
        '<input type="checkbox" name="interesses" value="' +
        item.id +
        '"' +
        (selectedSet[item.id] ? " checked" : "") +
        ">" +
        "<span>" +
        item.label +
        "</span>" +
        "</label>"
      );
    }).join("");
    interessesGrid.querySelectorAll('input[name="interesses"]').forEach(function (input) {
      input.addEventListener("change", function () {
        if (totalInteressesSelecionados() > 8) {
          input.checked = false;
          showFeedback("Selecione no máximo 8 interesses.", "erro");
        }
        atualizarContagemInteresses();
      });
    });
    atualizarContagemInteresses();
  }

  function interessesSelecionados() {
    return Array.prototype.slice
      .call(formComunidade.querySelectorAll('input[name="interesses"]:checked'))
      .map(function (el) {
        return el.value;
      });
  }

  function textoInteresseOutro() {
    if (!interesseOutroAtivo || !interesseOutroAtivo.checked) return "";
    return String((interesseOutroInput && interesseOutroInput.value) || "").trim();
  }

  function totalInteressesSelecionados() {
    return interessesSelecionados().length + (textoInteresseOutro() ? 1 : 0);
  }

  function sincronizarCampoOutro() {
    if (!interesseOutroAtivo || !interesseOutroInput) return;
    var ativo = interesseOutroAtivo.checked;
    interesseOutroInput.disabled = !ativo;
    if (!ativo) {
      interesseOutroInput.value = "";
    } else {
      interesseOutroInput.focus();
    }
    if (totalInteressesSelecionados() > 8) {
      interesseOutroAtivo.checked = false;
      interesseOutroInput.disabled = true;
      interesseOutroInput.value = "";
      showFeedback("Selecione no máximo 8 interesses.", "erro");
    }
    atualizarContagemInteresses();
  }

  function atualizarContagemInteresses() {
    var n = totalInteressesSelecionados();
    interessesCount.textContent =
      n === 0
        ? "Selecione de 3 a 8."
        : n + " selecionado" + (n === 1 ? "" : "s") + " · escolha entre 3 e 8.";
  }

  function preencherInteresseOutro(texto) {
    var valor = String(texto || "").trim();
    if (!interesseOutroAtivo || !interesseOutroInput) return;
    interesseOutroAtivo.checked = !!valor;
    interesseOutroInput.disabled = !valor;
    interesseOutroInput.value = valor;
    atualizarContagemInteresses();
  }

  function atualizarBioCount() {
    if (!bioEl || !bioCount) return;
    bioCount.textContent = String((bioEl.value || "").length);
  }

  function preencherEstados(selected) {
    if (!estadoUfSelect) return;
    estadoUfSelect.innerHTML =
      '<option value="">Selecione</option>' +
      ESTADOS_BR.map(function (uf) {
        return (
          '<option value="' +
          uf +
          '"' +
          (selected === uf ? " selected" : "") +
          ">" +
          uf +
          "</option>"
        );
      }).join("");
  }

  function preencherComunidade(comunidade, perfil) {
    var c = comunidade || {};
    var nomePadrao =
      c.nomeExibicao ||
      (perfil && perfil.nome ? String(perfil.nome).trim().split(/\s+/)[0] : "") ||
      (sessao.nome ? String(sessao.nome).trim().split(/\s+/)[0] : "");

    idadeContaAtual =
      perfil && perfil.idadeConta != null
        ? perfil.idadeConta
        : c.idade != null
          ? c.idade
          : null;

    formComunidade.nomeExibicao.value = nomePadrao || "";
    formComunidade.idade.value =
      idadeContaAtual != null ? String(idadeContaAtual) : "";

    var cidade = c.cidade || "";
    var bairro = c.bairro || "";
    if (!cidade && c.cidadeBairro) {
      cidade = c.cidadeBairro;
    }
    formComunidade.cidade.value = cidade;
    formComunidade.bairro.value = bairro;
    preencherEstados(c.estado || "");

    formComunidade.bio.value = c.bio || "";
    formComunidade.genero.value = c.genero || "";
    formComunidade.estadoCivil.value = c.estadoCivil || "";

    var intencao = c.intencao || "amizade";
    formComunidade.querySelectorAll('input[name="intencao"]').forEach(function (radio) {
      radio.checked = radio.value === intencao;
    });

    renderInteresses(c.interesses || []);
    preencherInteresseOutro(c.interesseOutro || "");
    atualizarBioCount();
  }

  function coletarComunidade() {
    var intencaoEl = formComunidade.querySelector('input[name="intencao"]:checked');
    return {
      nomeExibicao: formComunidade.nomeExibicao.value.trim(),
      cidade: formComunidade.cidade.value.trim(),
      bairro: formComunidade.bairro.value.trim(),
      estado: formComunidade.estado.value,
      intencao: intencaoEl ? intencaoEl.value : "",
      bio: formComunidade.bio.value.trim(),
      interesses: interessesSelecionados(),
      interesseOutro: textoInteresseOutro(),
      genero: formComunidade.genero.value,
      estadoCivil: formComunidade.estadoCivil.value,
    };
  }

  function validarComunidadeLocal(dados) {
    if (!temFotoPerfil) {
      return "Adicione uma foto com o rosto visível antes de guardar o perfil.";
    }
    if (!dados.nomeExibicao || dados.nomeExibicao.length < 2) {
      return "Informe o nome (primeiro nome ou apelido).";
    }
    if (idadeContaAtual == null || idadeContaAtual < 50) {
      return "Não foi possível confirmar a idade pelo cadastro.";
    }
    if (!dados.cidade || dados.cidade.length < 2) {
      return "Informe a cidade.";
    }
    if (dados.bairro && dados.bairro.length < 2) {
      return "Se informar o bairro, use pelo menos 2 caracteres.";
    }
    if (!dados.estado) {
      return "Selecione o estado.";
    }
    if (!dados.intencao) {
      return "Escolha a intenção: Amizade, Namoro ou Amizade e namoro.";
    }
    if (!dados.bio || dados.bio.length < 10) {
      return "Escreva uma bio curta (pelo menos 10 caracteres).";
    }
    var total =
      dados.interesses.length + (dados.interesseOutro ? 1 : 0);
    if (total < 3 || total > 8) {
      return "Selecione entre 3 e 8 interesses.";
    }
    if (interesseOutroAtivo && interesseOutroAtivo.checked && !dados.interesseOutro) {
      return "Descreva o interesse em Outros, ou desmarque a opção.";
    }
    if (!dados.genero) {
      return "Selecione o seu gênero.";
    }
    return null;
  }

  function carregarPerfil() {
    fetch(apiBase + "/api/contas/meu-perfil", { headers: ME_APP.getAuthHeaders() })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.ok || !data.perfil) return;
        temFotoPerfil = !!data.perfil.temFotoPerfil;
        fotoPendente = null;
        mostrarFoto(data.perfil.fotoExibicao || null, { dirty: false });
        atualizarLabelFoto();
        atualizarEstadoSalvar();
        preencherComunidade(data.perfil.comunidade, data.perfil);
      })
      .catch(function () {
        renderInteresses([]);
        preencherComunidade(null, { nome: sessao.nome });
      });
  }

  arquivoFoto.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > MAX_SOURCE_BYTES) {
      showFeedback("A imagem deve ter no máximo 8 MB.", "erro");
      arquivoFoto.value = "";
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      fotoPendente = reader.result;
      crop.dirty = true;
      mostrarFoto(fotoPendente, { dirty: true });
      atualizarLabelFoto();
      atualizarEstadoSalvar();
    };
    reader.readAsDataURL(file);
  });

  fotoCropFrame.addEventListener("pointerdown", function (event) {
    if (fotoPreview.hidden || !fotoPreview.src) return;
    if (event.button != null && event.button !== 0) return;
    crop.dragging = true;
    crop.pointerId = event.pointerId;
    crop.startX = event.clientX;
    crop.startY = event.clientY;
    crop.startOffsetX = crop.offsetX;
    crop.startOffsetY = crop.offsetY;
    fotoCropFrame.classList.add("is-dragging");
    try {
      fotoCropFrame.setPointerCapture(event.pointerId);
    } catch (err) {}
    event.preventDefault();
  });

  fotoCropFrame.addEventListener("pointermove", function (event) {
    if (!crop.dragging || event.pointerId !== crop.pointerId) return;
    crop.offsetX = crop.startOffsetX + (event.clientX - crop.startX);
    crop.offsetY = crop.startOffsetY + (event.clientY - crop.startY);
    clampOffsets();
    aplicarTransform();
  });

  function encerrarArraste(event) {
    if (!crop.dragging) return;
    if (event && crop.pointerId != null && event.pointerId !== crop.pointerId) return;
    var moved =
      Math.abs(crop.offsetX - crop.startOffsetX) > 1 ||
      Math.abs(crop.offsetY - crop.startOffsetY) > 1;
    crop.dragging = false;
    crop.pointerId = null;
    fotoCropFrame.classList.remove("is-dragging");
    if (moved && fotoPreview.src) {
      crop.dirty = true;
      atualizarEstadoSalvar();
    }
  }

  fotoCropFrame.addEventListener("pointerup", encerrarArraste);
  fotoCropFrame.addEventListener("pointercancel", encerrarArraste);

  window.addEventListener("resize", function () {
    if (fotoPreview.hidden || !fotoPreview.src) return;
    ajustarEscalaCover();
  });

  if (bioEl) {
    bioEl.addEventListener("input", atualizarBioCount);
  }

  formFoto.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!fotoPendente && !crop.dirty) {
      showFeedback("Selecione uma imagem para continuar.", "erro");
      return;
    }

    btnSalvarFoto.disabled = true;
    btnSalvarFoto.textContent = "Salvando…";

    exportarFotoRecortada()
      .then(function (dataUrl) {
        return fetch(apiBase + "/api/contas/meu-perfil/foto", {
          method: "PATCH",
          headers: ME_APP.authJsonHeaders(),
          body: JSON.stringify({ fotoDataUrl: dataUrl }),
        }).then(function (response) {
          return response
            .json()
            .then(function (data) {
              return { ok: response.ok, data: data };
            })
            .catch(function () {
              return {
                ok: false,
                data: {
                  error: "Não foi possível guardar a foto. Atualize a página e tente novamente.",
                },
              };
            });
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showFeedback(result.data.error || "Não foi possível guardar a foto.", "erro");
          return;
        }
        temFotoPerfil = true;
        fotoPendente = null;
        crop.dirty = false;
        arquivoFoto.value = "";
        mostrarFoto(result.data.fotoPerfilDataUrl, { dirty: false });
        atualizarLabelFoto();
        atualizarEstadoSalvar();
        showFeedback(result.data.message || "Foto salva.", "ok");
        ME_ANALYTICS.track("perfil_50_foto_salva", { page: "perfil_50" });
      })
      .catch(function (err) {
        if (err && err.message && err.message.indexOf("400 KB") !== -1) {
          showFeedback(err.message, "erro");
          return;
        }
        showFeedback("Erro de conexão. Tente novamente.", "erro");
      })
      .finally(function () {
        atualizarEstadoSalvar();
        btnSalvarFoto.textContent = "Salvar foto";
      });
  });

  formComunidade.addEventListener("submit", function (event) {
    event.preventDefault();
    var dados = coletarComunidade();
    var erro = validarComunidadeLocal(dados);
    if (erro) {
      showFeedback(erro, "erro");
      return;
    }

    btnSalvarComunidade.disabled = true;
    btnSalvarComunidade.textContent = "Salvando…";

    fetch(apiBase + "/api/contas/meu-perfil/comunidade", {
      method: "PATCH",
      headers: ME_APP.authJsonHeaders(),
      body: JSON.stringify(dados),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showFeedback(result.data.error || "Não foi possível guardar o perfil.", "erro");
          return;
        }
        if (result.data.comunidade) {
          preencherComunidade(result.data.comunidade, {
            idadeConta: idadeContaAtual,
            nome: sessao.nome,
          });
        }
        showFeedback(result.data.message || "Perfil guardado.", "ok");
        ME_ANALYTICS.track("perfil_50_comunidade_salva", {
          page: "perfil_50",
          intencao: dados.intencao,
          interesses: dados.interesses.length,
        });
      })
      .catch(function () {
        showFeedback("Erro de conexão. Tente novamente.", "erro");
      })
      .finally(function () {
        btnSalvarComunidade.disabled = false;
        btnSalvarComunidade.textContent = "Salvar perfil";
      });
  });

  preencherEstados("");
  renderInteresses([]);
  if (interesseOutroAtivo) {
    interesseOutroAtivo.addEventListener("change", sincronizarCampoOutro);
  }
  if (interesseOutroInput) {
    interesseOutroInput.addEventListener("input", atualizarContagemInteresses);
  }
  carregarPerfil();
})();

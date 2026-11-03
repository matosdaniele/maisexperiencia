(function () {
  var destinoAtual = ME_APP.getCurrentPageDestino();
  var sessao = ME_APP.ensureSession50(ME_APP.buildAuthUrl("entrar_50.html", destinoAtual));
  if (!sessao) return;

  var form = document.getElementById("tn-form");
  var feedback = document.getElementById("feedback");
  var resultadoSecao = document.getElementById("tn-resultado-secao");
  var resultadoRoot = document.getElementById("tn-resultado");
  var planosSecao = document.getElementById("tn-planos-secao");
  var painelTreino = document.getElementById("tn-painel-treino");
  var painelNutricao = document.getElementById("tn-painel-nutricao");
  var tabs = document.getElementById("tn-tabs");
  var btnImprimir = document.getElementById("tn-btn-imprimir");

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
  }

  function hideFeedback() {
    if (feedback) feedback.hidden = true;
  }

  var ILUSTRACOES = {
    pernas: "Pernas e glúteos",
    empurrar: "Peito, ombro e tríceps",
    puxar: "Costas e bíceps",
    abdomen: "Abdômen e core",
    corpo: "Corpo inteiro",
    cardio: "Exercício de cardio (caminhada)",
  };

  function ilustracao(grupo) {
    var chave = ILUSTRACOES[grupo] ? grupo : "corpo";
    return { src: "img/treino-" + chave + ".png", alt: "Ilustração: " + ILUSTRACOES[chave] };
  }

  function videoUrl(nomeExercicio) {
    var termo = "como fazer " + nomeExercicio + " exercício";
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(termo);
  }

  function faixaClasse(faixa) {
    if (faixa === "normal") return "tn-badge--ok";
    if (faixa === "baixo_peso" || faixa === "sobrepeso") return "tn-badge--atencao";
    return "tn-badge--alerta";
  }

  function renderResultado(plano) {
    var imc = plano.imc;
    var cal = plano.calorias;
    var macros = plano.macros;

    var cardsMacros =
      '<div class="tn-macro-row">' +
      macroCard("Proteína", macros.proteina) +
      macroCard("Carboidrato", macros.carboidrato) +
      macroCard("Gordura", macros.gordura) +
      "</div>";

    resultadoRoot.innerHTML =
      '<article class="tn-card">' +
      '<p class="tn-card-rotulo">IMC</p>' +
      '<p class="tn-card-numero">' + escapeHtml(String(imc.valor).replace(".", ",")) + "</p>" +
      '<span class="tn-badge ' + faixaClasse(imc.faixa) + '">' + escapeHtml(imc.classificacao) + "</span>" +
      '<p class="tn-card-nota">' + escapeHtml(imc.nota) + "</p>" +
      "</article>" +
      '<article class="tn-card">' +
      '<p class="tn-card-rotulo">Calorias por dia</p>' +
      '<p class="tn-card-numero">' + escapeHtml(String(cal.calorias)) + ' <span class="tn-card-unidade">kcal</span></p>' +
      '<span class="tn-badge tn-badge--info">' + escapeHtml(cal.estrategia) + "</span>" +
      '<p class="tn-card-nota">Metabolismo basal (BMR): ' + escapeHtml(String(plano.metabolismo.bmr)) +
      " kcal · Gasto total (TDEE): " + escapeHtml(String(plano.metabolismo.tdee)) + " kcal" +
      (cal.pisoAplicado ? " · Ajustado ao piso de segurança (" + escapeHtml(String(cal.piso)) + " kcal)" : "") +
      "</p>" +
      "</article>" +
      '<article class="tn-card tn-card--wide">' +
      '<p class="tn-card-rotulo">Macronutrientes</p>' +
      cardsMacros +
      '<p class="tn-card-nota">Objetivo: ' + escapeHtml(plano.labels.objetivo) +
      " · Nível: " + escapeHtml(plano.labels.nivelAtividade) + "</p>" +
      "</article>";
  }

  function macroCard(nome, macro) {
    return (
      '<div class="tn-macro">' +
      '<p class="tn-macro-nome">' + escapeHtml(nome) + "</p>" +
      '<p class="tn-macro-gramas">' + escapeHtml(String(macro.gramas)) + " g</p>" +
      '<p class="tn-macro-detalhe">' + escapeHtml(String(macro.kcal)) + " kcal · " + escapeHtml(String(macro.pct)) + "%</p>" +
      "</div>"
    );
  }

  function renderTreino(treino) {
    var diasHtml = treino.dias
      .map(function (dia) {
        var exercicios = dia.exercicios
          .map(function (ex) {
            var img = ilustracao(ex.grupoVisual);
            return (
              '<li class="tn-exercicio">' +
              '<img class="tn-exercicio-img" src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt) +
              '" loading="lazy" width="60" height="60">' +
              '<span class="tn-exercicio-info">' +
              '<span class="tn-exercicio-nome">' + escapeHtml(ex.nome) + "</span>" +
              '<span class="tn-exercicio-presc">' + escapeHtml(ex.series) + " x " + escapeHtml(ex.reps) +
              " · descanso " + escapeHtml(ex.descanso) + "</span>" +
              '<a class="tn-exercicio-video" href="' + escapeHtml(videoUrl(ex.nome)) +
              '" target="_blank" rel="noopener">Ver como fazer</a>' +
              "</span>" +
              "</li>"
            );
          })
          .join("");
        var cardioImg = ilustracao("cardio");
        var cardio = dia.cardio
          ? '<div class="tn-treino-cardio">' +
            '<img class="tn-exercicio-img tn-exercicio-img--cardio" src="' + escapeHtml(cardioImg.src) +
            '" alt="' + escapeHtml(cardioImg.alt) + '" loading="lazy" width="52" height="52">' +
            "<span><strong>Cardio:</strong> " + escapeHtml(dia.cardio) + "</span>" +
            "</div>"
          : "";
        return (
          '<article class="tn-treino-dia">' +
          '<div class="tn-treino-dia-cabecalho">' +
          "<h4>" + escapeHtml(dia.titulo) + "</h4>" +
          '<p class="tn-treino-dia-foco">' + escapeHtml(dia.foco) + "</p>" +
          "</div>" +
          '<ul class="tn-exercicio-lista">' + exercicios + "</ul>" +
          cardio +
          "</article>"
        );
      })
      .join("");

    painelTreino.innerHTML =
      '<div class="tn-plano-resumo">' +
      "<h3>" + escapeHtml(treino.nome) + "</h3>" +
      '<p class="tn-plano-meta">' + escapeHtml(treino.foco) + " · " + escapeHtml(treino.local) +
      " · " + escapeHtml(String(treino.frequencia)) + "x por semana</p>" +
      '<p class="tn-plano-meta">Dias sugeridos: ' + escapeHtml(treino.diasSugeridos) + "</p>" +
      '<p class="tn-plano-nota">' + escapeHtml(treino.aquecimento) + "</p>" +
      (treino.observacao ? '<p class="tn-plano-nota">' + escapeHtml(treino.observacao) + "</p>" : "") +
      "</div>" +
      '<div class="tn-treino-grid">' + diasHtml + "</div>";
  }

  function renderNutricao(nutricao) {
    var distribuicao = nutricao.distribuicao
      .map(function (item) {
        return (
          '<li class="tn-dist-item">' +
          '<span class="tn-dist-refeicao">' + escapeHtml(item.refeicao) + "</span>" +
          '<span class="tn-dist-valores">' + escapeHtml(String(item.kcal)) + " kcal · " + escapeHtml(String(item.pct)) + "%</span>" +
          "</li>"
        );
      })
      .join("");

    var dias = nutricao.dias
      .map(function (dia) {
        var refeicoes = dia.refeicoes
          .map(function (ref) {
            return (
              '<li class="tn-refeicao">' +
              '<span class="tn-refeicao-nome">' + escapeHtml(ref.refeicao) + "</span>" +
              '<span class="tn-refeicao-sugestao">' + escapeHtml(ref.sugestao) + "</span>" +
              "</li>"
            );
          })
          .join("");
        return (
          '<article class="tn-dia-alimentar">' +
          "<h4>" + escapeHtml(dia.nome) + "</h4>" +
          '<ul class="tn-refeicao-lista">' + refeicoes + "</ul>" +
          "</article>"
        );
      })
      .join("");

    painelNutricao.innerHTML =
      '<div class="tn-plano-resumo">' +
      "<h3>Distribuição do dia (" + escapeHtml(String(nutricao.caloriasAlvo)) + " kcal)</h3>" +
      '<ul class="tn-dist-lista">' + distribuicao + "</ul>" +
      '<p class="tn-plano-nota">' + escapeHtml(nutricao.observacao) + "</p>" +
      "</div>" +
      '<h3 class="tn-dias-title">Ideias de dia alimentar</h3>' +
      '<div class="tn-dias-grid">' + dias + "</div>";
  }

  function setTab(tabId) {
    var alvo = tabId === "nutricao" ? "nutricao" : "treino";
    if (painelTreino) painelTreino.hidden = alvo !== "treino";
    if (painelNutricao) painelNutricao.hidden = alvo !== "nutricao";
    if (tabs) {
      tabs.querySelectorAll("[data-tn-tab]").forEach(function (btn) {
        var active = btn.getAttribute("data-tn-tab") === alvo;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
  }

  if (tabs) {
    tabs.querySelectorAll("[data-tn-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.getAttribute("data-tn-tab"));
      });
    });
  }

  if (btnImprimir) {
    btnImprimir.addEventListener("click", function () {
      ME_ANALYTICS.track("treino_nutricao_imprimir", {});
      window.print();
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    hideFeedback();

    var dados = {
      pesoKg: form.peso.value,
      alturaCm: form.altura.value,
      idade: form.idade.value,
      sexo: form.sexo.value,
      nivelAtividade: form.nivel.value,
      objetivo: form.objetivo.value,
      local: form.local.value,
    };

    var plano = ME_TREINO.gerarPlano(dados);
    if (!plano.ok) {
      showFeedback(plano.error || "Verifique os dados informados.", "erro");
      return;
    }

    renderResultado(plano);
    renderTreino(plano.treino);
    renderNutricao(plano.nutricao);
    setTab("treino");

    resultadoSecao.hidden = false;
    planosSecao.hidden = false;

    ME_ANALYTICS.track("treino_nutricao_calcular", {
      objetivo: dados.objetivo,
      nivel: dados.nivelAtividade,
      local: dados.local,
      imcFaixa: plano.imc.faixa,
    });

    if (resultadoSecao.scrollIntoView) {
      resultadoSecao.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  ME_ANALYTICS.track("treino_nutricao_visita", { page: "treino_nutricao_50" });
})();

/**
 * Módulo puro de Treino e Nutrição (sem dependências, sem DOM).
 *
 * Funciona tanto no navegador (window.ME_TREINO) quanto em Node (module.exports),
 * para permitir testes automatizados da lógica.
 *
 * Aviso: os cálculos são estimativas educativas e não substituem orientação
 * de profissional de saúde (médico, nutricionista, educador físico).
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ME_TREINO = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NIVEIS_ATIVIDADE = {
    sedentario: { fator: 1.2, label: "Sedentário (pouco ou nenhum exercício)" },
    leve: { fator: 1.375, label: "Levemente ativo (1–3 dias/semana)" },
    moderado: { fator: 1.55, label: "Moderadamente ativo (3–5 dias/semana)" },
    ativo: { fator: 1.725, label: "Muito ativo (6–7 dias/semana)" },
    muito_ativo: { fator: 1.9, label: "Extremamente ativo (trabalho físico + treino)" },
  };

  var OBJETIVOS = {
    emagrecer: { label: "Emagrecer" },
    manter: { label: "Manter o peso" },
    ganhar: { label: "Ganhar massa" },
  };

  var LOCAIS = {
    academia: { label: "Academia" },
    casa: { label: "Em casa" },
    misto: { label: "Misto (academia + casa)" },
  };

  var PISO_CALORICO = { feminino: 1200, masculino: 1500 };

  function round(value, casas) {
    var f = Math.pow(10, casas || 0);
    return Math.round(value * f) / f;
  }

  function toNumber(value) {
    var n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
    return isFinite(n) ? n : NaN;
  }

  // ---------- IMC ----------

  function classificarIMC(imc) {
    if (imc < 18.5) {
      return { faixa: "baixo_peso", label: "Baixo peso", nota: "Abaixo do recomendado pela OMS." };
    }
    if (imc < 25) {
      return { faixa: "normal", label: "Peso normal", nota: "Faixa saudável segundo a OMS." };
    }
    if (imc < 30) {
      return { faixa: "sobrepeso", label: "Sobrepeso", nota: "Acima do recomendado pela OMS." };
    }
    if (imc < 35) {
      return { faixa: "obesidade_1", label: "Obesidade grau I", nota: "Obesidade leve (OMS)." };
    }
    if (imc < 40) {
      return { faixa: "obesidade_2", label: "Obesidade grau II", nota: "Obesidade moderada (OMS)." };
    }
    return { faixa: "obesidade_3", label: "Obesidade grau III", nota: "Obesidade grave (OMS)." };
  }

  function calcularIMC(pesoKg, alturaCm) {
    var peso = toNumber(pesoKg);
    var alturaM = toNumber(alturaCm) / 100;
    var imc = peso / (alturaM * alturaM);
    var classificacao = classificarIMC(imc);
    return {
      valor: round(imc, 1),
      faixa: classificacao.faixa,
      classificacao: classificacao.label,
      nota: classificacao.nota,
    };
  }

  // ---------- Metabolismo ----------

  // Mifflin-St Jeor
  function calcularBMR(dados) {
    var peso = toNumber(dados.pesoKg);
    var altura = toNumber(dados.alturaCm);
    var idade = toNumber(dados.idade);
    var base = 10 * peso + 6.25 * altura - 5 * idade;
    var ajuste = dados.sexo === "feminino" ? -161 : 5;
    return round(base + ajuste, 0);
  }

  function calcularTDEE(bmr, nivelAtividade) {
    var nivel = NIVEIS_ATIVIDADE[nivelAtividade] || NIVEIS_ATIVIDADE.moderado;
    return round(bmr * nivel.fator, 0);
  }

  function calcularCaloriasAlvo(tdee, objetivo, sexo) {
    var ajustePct = 0;
    var estrategia = "Manutenção";
    if (objetivo === "emagrecer") {
      ajustePct = -0.18; // déficit dentro de 15–20%
      estrategia = "Déficit calórico (18%)";
    } else if (objetivo === "ganhar") {
      ajustePct = 0.12; // superávit dentro de 10–15%
      estrategia = "Superávit calórico (12%)";
    }

    var alvoBruto = tdee * (1 + ajustePct);
    var piso = PISO_CALORICO[sexo] || PISO_CALORICO.masculino;
    var pisoAplicado = false;
    var alvo = alvoBruto;
    if (alvo < piso) {
      alvo = piso;
      pisoAplicado = true;
    }

    return {
      calorias: round(alvo, 0),
      estrategia: estrategia,
      ajustePct: Math.round(Math.abs(ajustePct) * 100),
      pisoAplicado: pisoAplicado,
      piso: piso,
    };
  }

  // ---------- Macros ----------

  var MACRO_REGRAS = {
    emagrecer: { proteinaPorKg: 2.0, gorduraPorKg: 0.8 },
    manter: { proteinaPorKg: 1.6, gorduraPorKg: 0.9 },
    ganhar: { proteinaPorKg: 1.8, gorduraPorKg: 1.0 },
  };

  function calcularMacros(pesoKg, objetivo, caloriasAlvo) {
    var peso = toNumber(pesoKg);
    var regra = MACRO_REGRAS[objetivo] || MACRO_REGRAS.manter;

    var proteinaG = peso * regra.proteinaPorKg;
    var gorduraG = peso * regra.gorduraPorKg;
    var kcalProteina = proteinaG * 4;
    var kcalGordura = gorduraG * 9;
    var kcalCarbo = Math.max(caloriasAlvo - kcalProteina - kcalGordura, 0);
    var carboG = kcalCarbo / 4;
    var totalKcal = kcalProteina + kcalGordura + kcalCarbo;

    function pct(kcal) {
      return totalKcal > 0 ? Math.round((kcal / totalKcal) * 100) : 0;
    }

    return {
      proteina: { gramas: round(proteinaG, 0), kcal: round(kcalProteina, 0), pct: pct(kcalProteina), porKg: regra.proteinaPorKg },
      carboidrato: { gramas: round(carboG, 0), kcal: round(kcalCarbo, 0), pct: pct(kcalCarbo) },
      gordura: { gramas: round(gorduraG, 0), kcal: round(kcalGordura, 0), pct: pct(kcalGordura), porKg: regra.gorduraPorKg },
    };
  }

  // ---------- Treino ----------

  var EXERCICIOS = {
    academia: {
      inferior: ["Leg press", "Cadeira extensora", "Cadeira flexora", "Panturrilha em pé"],
      superior_empurrar: ["Supino na máquina", "Desenvolvimento na máquina", "Tríceps na polia"],
      superior_puxar: ["Puxada frente", "Remada sentada", "Rosca direta"],
      corpo_todo: ["Leg press", "Puxada frente", "Supino na máquina", "Desenvolvimento na máquina", "Remada sentada", "Abdominal na máquina"],
    },
    casa: {
      inferior: ["Agachamento livre", "Afundo alternado", "Ponte de glúteo", "Elevação de panturrilha"],
      superior_empurrar: ["Flexão de braço (joelhos se preciso)", "Flexão inclinada na parede", "Tríceps no banco/cadeira"],
      superior_puxar: ["Remada com elástico", "Puxada com elástico", "Rosca com elástico ou garrafa"],
      corpo_todo: ["Agachamento livre", "Flexão de braço", "Remada com elástico", "Afundo alternado", "Ponte de glúteo", "Prancha abdominal"],
    },
  };

  var CARDIO = {
    academia: ["Esteira em caminhada inclinada", "Bicicleta ergométrica", "Elíptico"],
    casa: ["Caminhada no bairro", "Subir e descer escadas", "Vídeo aeróbico de baixo impacto"],
  };

  function poolExercicios(local, grupo) {
    if (local === "misto") {
      var acad = EXERCICIOS.academia[grupo] || [];
      var casa = EXERCICIOS.casa[grupo] || [];
      var mix = [];
      for (var i = 0; i < Math.max(acad.length, casa.length); i += 1) {
        if (acad[i]) mix.push(acad[i]);
        if (casa[i]) mix.push(casa[i]);
      }
      return mix;
    }
    return (EXERCICIOS[local] && EXERCICIOS[local][grupo]) || EXERCICIOS.casa[grupo] || [];
  }

  function cardioSugestao(local) {
    if (local === "academia") return CARDIO.academia[0];
    if (local === "casa") return CARDIO.casa[0];
    return CARDIO.academia[0] + " ou " + CARDIO.casa[0];
  }

  // Classifica um exercício em um grupo visual (para escolher a ilustração).
  // Retorna: "pernas" | "empurrar" | "puxar" | "abdomen" | "corpo".
  function classificarGrupoVisual(nome) {
    var n = String(nome || "").toLowerCase();
    if (n.indexOf("abdominal") !== -1 || n.indexOf("prancha") !== -1) return "abdomen";
    if (
      n.indexOf("panturrilha") !== -1 ||
      n.indexOf("leg press") !== -1 ||
      n.indexOf("agachamento") !== -1 ||
      n.indexOf("afundo") !== -1 ||
      n.indexOf("gl\u00fateo") !== -1 ||
      n.indexOf("cadeira") !== -1
    ) {
      return "pernas";
    }
    if (
      n.indexOf("supino") !== -1 ||
      n.indexOf("desenvolvimento") !== -1 ||
      n.indexOf("tr\u00edceps") !== -1 ||
      n.indexOf("flex\u00e3o") !== -1
    ) {
      return "empurrar";
    }
    if (n.indexOf("puxada") !== -1 || n.indexOf("remada") !== -1 || n.indexOf("rosca") !== -1) {
      return "puxar";
    }
    return "corpo";
  }

  function prescricao(objetivo) {
    if (objetivo === "ganhar") return { series: "3–4", reps: "8–12", descanso: "60–90 s" };
    if (objetivo === "emagrecer") return { series: "2–3", reps: "12–15", descanso: "30–45 s" };
    return { series: "3", reps: "10–12", descanso: "45–60 s" };
  }

  function montarExercicios(local, grupo, quantidade, presc) {
    var pool = poolExercicios(local, grupo);
    var lista = [];
    for (var i = 0; i < quantidade && i < pool.length; i += 1) {
      lista.push({
        nome: pool[i],
        series: presc.series,
        reps: presc.reps,
        descanso: presc.descanso,
        grupoVisual: classificarGrupoVisual(pool[i]),
      });
    }
    return lista;
  }

  function gerarPlanoTreino(objetivo, local, nivelAtividade) {
    var presc = prescricao(objetivo);
    var sedentario = nivelAtividade === "sedentario";
    var localLabel = (LOCAIS[local] || LOCAIS.misto).label;
    var dias = [];
    var nome = "";
    var foco = "";
    var observacao = "";

    if (objetivo === "ganhar") {
      nome = "Hipertrofia — Superior/Inferior";
      foco = "Ganho de massa muscular";
      dias = [
        { titulo: "Treino A", foco: "Inferior (pernas e glúteos)", exercicios: montarExercicios(local, "inferior", 4, presc), cardio: null },
        { titulo: "Treino B", foco: "Superior (empurrar: peito, ombro, tríceps)", exercicios: montarExercicios(local, "superior_empurrar", 3, presc), cardio: null },
        { titulo: "Treino C", foco: "Inferior (força e equilíbrio)", exercicios: montarExercicios(local, "inferior", 4, presc), cardio: null },
        { titulo: "Treino D", foco: "Superior (puxar: costas e bíceps)", exercicios: montarExercicios(local, "superior_puxar", 3, presc), cardio: null },
      ];
      observacao = "Aumente a carga aos poucos quando conseguir completar todas as repetições com boa técnica.";
    } else if (objetivo === "emagrecer") {
      nome = "Condicionamento + Corpo inteiro (circuito)";
      foco = "Queima calórica e preservação de massa";
      dias = [
        { titulo: "Treino A", foco: "Corpo inteiro + cardio", exercicios: montarExercicios(local, "corpo_todo", 5, presc), cardio: cardioSugestao(local) + " — 20 min" },
        { titulo: "Treino B", foco: "Cardio contínuo + core", exercicios: montarExercicios(local, "corpo_todo", 3, presc), cardio: cardioSugestao(local) + " — 30 min" },
        { titulo: "Treino C", foco: "Corpo inteiro (circuito)", exercicios: montarExercicios(local, "corpo_todo", 5, presc), cardio: cardioSugestao(local) + " — 15 min" },
        { titulo: "Treino D", foco: "Cardio intervalado leve", exercicios: montarExercicios(local, "corpo_todo", 3, presc), cardio: cardioSugestao(local) + " — 20 min (alternando ritmo)" },
      ];
      observacao = "Faça os exercícios em formato de circuito (2–3 voltas) com descanso curto para manter o coração ativo.";
    } else {
      nome = "Full Body 3x por semana";
      foco = "Manutenção de força e saúde geral";
      dias = [
        { titulo: "Treino A", foco: "Corpo inteiro", exercicios: montarExercicios(local, "corpo_todo", 5, presc), cardio: cardioSugestao(local) + " — 15 min" },
        { titulo: "Treino B", foco: "Corpo inteiro (variação)", exercicios: montarExercicios(local, "corpo_todo", 5, presc), cardio: cardioSugestao(local) + " — 15 min" },
        { titulo: "Treino C", foco: "Corpo inteiro + mobilidade", exercicios: montarExercicios(local, "corpo_todo", 5, presc), cardio: cardioSugestao(local) + " — 15 min" },
      ];
    }

    if (sedentario && dias.length > 3) {
      dias = dias.slice(0, 3);
      observacao =
        "Como você está começando, sugerimos 3 dias por semana. Evolua para mais dias com o tempo. " +
        observacao;
    }

    var frequencia = dias.length;
    var diasSugeridos =
      frequencia >= 4 ? "Seg · Ter · Qui · Sex (descanso nos demais dias)" : "Seg · Qua · Sex (descanso nos demais dias)";

    return {
      nome: nome,
      foco: foco,
      local: localLabel,
      frequencia: frequencia,
      diasSugeridos: diasSugeridos,
      prescricao: presc,
      observacao: observacao,
      aquecimento: "5–10 min de aquecimento leve (caminhada e mobilidade articular) antes de cada treino.",
      dias: dias,
    };
  }

  // ---------- Nutrição ----------

  var DIAS_ALIMENTARES = [
    {
      nome: "Dia clássico",
      refeicoes: [
        { refeicao: "Café da manhã", sugestao: "Ovos mexidos, pão integral, 1 fruta e café sem açúcar" },
        { refeicao: "Almoço", sugestao: "Arroz integral, feijão, frango grelhado e salada à vontade" },
        { refeicao: "Lanche", sugestao: "Iogurte natural com fruta e aveia" },
        { refeicao: "Jantar", sugestao: "Omelete de legumes com salada verde" },
      ],
    },
    {
      nome: "Dia prático",
      refeicoes: [
        { refeicao: "Café da manhã", sugestao: "Vitamina de banana com aveia e leite ou bebida vegetal" },
        { refeicao: "Almoço", sugestao: "Batata-doce, patinho moído e legumes refogados" },
        { refeicao: "Lanche", sugestao: "1 fruta + punhado de castanhas" },
        { refeicao: "Jantar", sugestao: "Sopa de legumes com frango desfiado" },
      ],
    },
    {
      nome: "Dia com peixe",
      refeicoes: [
        { refeicao: "Café da manhã", sugestao: "Tapioca com ovo e queijo branco + café" },
        { refeicao: "Almoço", sugestao: "Arroz, lentilha, filé de peixe assado e salada" },
        { refeicao: "Lanche", sugestao: "Iogurte com granola sem açúcar" },
        { refeicao: "Jantar", sugestao: "Wrap integral de atum com folhas" },
      ],
    },
    {
      nome: "Dia vegetariano",
      refeicoes: [
        { refeicao: "Café da manhã", sugestao: "Mingau de aveia com fruta e pasta de amendoim" },
        { refeicao: "Almoço", sugestao: "Arroz integral, grão-de-bico, tofu ou ovos e legumes" },
        { refeicao: "Lanche", sugestao: "Queijo branco + fruta" },
        { refeicao: "Jantar", sugestao: "Creme de abóbora com sementes + salada" },
      ],
    },
  ];

  function gerarPlanoNutricional(caloriasAlvo, objetivo) {
    var pcts = [
      { refeicao: "Café da manhã", pct: 25 },
      { refeicao: "Almoço", pct: 35 },
      { refeicao: "Lanche", pct: 15 },
      { refeicao: "Jantar", pct: 25 },
    ];
    var distribuicao = pcts.map(function (item) {
      return {
        refeicao: item.refeicao,
        pct: item.pct,
        kcal: round((caloriasAlvo * item.pct) / 100, 0),
      };
    });

    var observacao = "Mantenha o equilíbrio das porções e boa hidratação (cerca de 35 ml de água por kg de peso).";
    if (objetivo === "emagrecer") {
      observacao =
        "Priorize proteínas magras e vegetais; controle as porções de arroz, pão e massas. Beba bastante água.";
    } else if (objetivo === "ganhar") {
      observacao =
        "Acrescente uma porção extra de carboidrato nas refeições e considere um lanche adicional para atingir as calorias.";
    }

    return {
      caloriasAlvo: caloriasAlvo,
      distribuicao: distribuicao,
      observacao: observacao,
      dias: DIAS_ALIMENTARES,
    };
  }

  // ---------- Validação e orquestração ----------

  function validar(dados) {
    var peso = toNumber(dados.pesoKg);
    var altura = toNumber(dados.alturaCm);
    var idade = toNumber(dados.idade);
    var sexo = String(dados.sexo || "").toLowerCase();
    var nivel = String(dados.nivelAtividade || "").toLowerCase();
    var objetivo = String(dados.objetivo || "").toLowerCase();
    var local = String(dados.local || "misto").toLowerCase();

    if (!(peso >= 30 && peso <= 300)) {
      return { ok: false, error: "Informe um peso válido entre 30 e 300 kg." };
    }
    if (!(altura >= 100 && altura <= 250)) {
      return { ok: false, error: "Informe uma altura válida entre 100 e 250 cm." };
    }
    if (!(idade >= 18 && idade <= 120)) {
      return { ok: false, error: "Informe uma idade válida entre 18 e 120 anos." };
    }
    if (sexo !== "masculino" && sexo !== "feminino") {
      return { ok: false, error: "Selecione o sexo biológico." };
    }
    if (!NIVEIS_ATIVIDADE[nivel]) {
      return { ok: false, error: "Selecione o seu nível de atividade." };
    }
    if (!OBJETIVOS[objetivo]) {
      return { ok: false, error: "Selecione o seu objetivo." };
    }
    if (!LOCAIS[local]) {
      local = "misto";
    }

    return {
      ok: true,
      value: {
        pesoKg: peso,
        alturaCm: altura,
        idade: idade,
        sexo: sexo,
        nivelAtividade: nivel,
        objetivo: objetivo,
        local: local,
      },
    };
  }

  function gerarPlano(dados) {
    var check = validar(dados);
    if (!check.ok) {
      return check;
    }
    var v = check.value;

    var imc = calcularIMC(v.pesoKg, v.alturaCm);
    var bmr = calcularBMR(v);
    var tdee = calcularTDEE(bmr, v.nivelAtividade);
    var calorias = calcularCaloriasAlvo(tdee, v.objetivo, v.sexo);
    var macros = calcularMacros(v.pesoKg, v.objetivo, calorias.calorias);
    var treino = gerarPlanoTreino(v.objetivo, v.local, v.nivelAtividade);
    var nutricao = gerarPlanoNutricional(calorias.calorias, v.objetivo);

    return {
      ok: true,
      entrada: v,
      labels: {
        nivelAtividade: NIVEIS_ATIVIDADE[v.nivelAtividade].label,
        objetivo: OBJETIVOS[v.objetivo].label,
        local: LOCAIS[v.local].label,
        sexo: v.sexo === "feminino" ? "Feminino" : "Masculino",
      },
      imc: imc,
      metabolismo: { bmr: bmr, tdee: tdee },
      calorias: calorias,
      macros: macros,
      treino: treino,
      nutricao: nutricao,
    };
  }

  return {
    NIVEIS_ATIVIDADE: NIVEIS_ATIVIDADE,
    OBJETIVOS: OBJETIVOS,
    LOCAIS: LOCAIS,
    classificarIMC: classificarIMC,
    calcularIMC: calcularIMC,
    calcularBMR: calcularBMR,
    calcularTDEE: calcularTDEE,
    calcularCaloriasAlvo: calcularCaloriasAlvo,
    calcularMacros: calcularMacros,
    classificarGrupoVisual: classificarGrupoVisual,
    gerarPlanoTreino: gerarPlanoTreino,
    gerarPlanoNutricional: gerarPlanoNutricional,
    validar: validar,
    gerarPlano: gerarPlano,
  };
});

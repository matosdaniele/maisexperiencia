"use strict";

// Verificação simples da lógica pura de Treino e Nutrição.
const T = require("../src/lib/treino-nutricao");

let falhas = 0;
function check(descricao, condicao, extra) {
  const status = condicao ? "OK " : "FALHA";
  if (!condicao) falhas += 1;
  console.log(`[${status}] ${descricao}${extra ? " → " + extra : ""}`);
}

// Caso 1: mulher, emagrecer
const r1 = T.gerarPlano({
  pesoKg: 82,
  alturaCm: 165,
  idade: 55,
  sexo: "feminino",
  nivelAtividade: "leve",
  objetivo: "emagrecer",
  local: "misto",
});
check("Caso 1 gerado", r1.ok);
check("IMC ~30.1 (sobrepeso/obesidade)", r1.imc.valor === 30.1, "IMC=" + r1.imc.valor + " " + r1.imc.classificacao);
// BMR = 10*82 + 6.25*165 - 5*55 - 161 = 820 + 1031.25 - 275 - 161 = 1415.25 -> 1415
check("BMR Mifflin correto", r1.metabolismo.bmr === 1415, "BMR=" + r1.metabolismo.bmr);
// TDEE = 1415 * 1.375 = 1945.6 -> 1946
check("TDEE correto", r1.metabolismo.tdee === 1946, "TDEE=" + r1.metabolismo.tdee);
// alvo = 1946 * 0.82 = 1595.7 -> 1596 (acima do piso 1200)
check("Calorias alvo com déficit", r1.calorias.calorias === 1596, "alvo=" + r1.calorias.calorias);
check("Macros somam ~100%", Math.abs(r1.macros.proteina.pct + r1.macros.carboidrato.pct + r1.macros.gordura.pct - 100) <= 1);
check("Treino emagrecer tem cardio", r1.treino.dias[0].cardio !== null);

// Caso 2: homem, ganhar, sedentário (deve limitar a 3 dias)
const r2 = T.gerarPlano({
  pesoKg: 70,
  alturaCm: 175,
  idade: 60,
  sexo: "masculino",
  nivelAtividade: "sedentario",
  objetivo: "ganhar",
  local: "academia",
});
check("Caso 2 gerado", r2.ok);
// BMR = 700 + 1093.75 - 300 + 5 = 1498.75 -> 1499
check("BMR homem correto", r2.metabolismo.bmr === 1499, "BMR=" + r2.metabolismo.bmr);
// TDEE = 1499 * 1.2 = 1798.8 -> 1799 ; alvo = 1799*1.12=2014.9 -> 2015
check("Calorias com superávit", r2.calorias.calorias === 2015, "alvo=" + r2.calorias.calorias);
check("Sedentário limita a 3 treinos", r2.treino.frequencia === 3, "freq=" + r2.treino.frequencia);

// Caso 3: piso de segurança
const r3 = T.gerarPlano({
  pesoKg: 45,
  alturaCm: 150,
  idade: 80,
  sexo: "feminino",
  nivelAtividade: "sedentario",
  objetivo: "emagrecer",
  local: "casa",
});
check("Piso de segurança aplicado", r3.calorias.pisoAplicado === true && r3.calorias.calorias === 1200, "alvo=" + r3.calorias.calorias);

// Caso 4: validação
const inval = T.gerarPlano({ pesoKg: 10, alturaCm: 165, idade: 55, sexo: "feminino", nivelAtividade: "leve", objetivo: "emagrecer" });
check("Validação rejeita peso inválido", inval.ok === false, inval.error);

// Caso 5: classificações OMS
check("IMC 17 = baixo peso", T.classificarIMC(17).faixa === "baixo_peso");
check("IMC 22 = normal", T.classificarIMC(22).faixa === "normal");
check("IMC 27 = sobrepeso", T.classificarIMC(27).faixa === "sobrepeso");
check("IMC 32 = obesidade I", T.classificarIMC(32).faixa === "obesidade_1");
check("IMC 37 = obesidade II", T.classificarIMC(37).faixa === "obesidade_2");
check("IMC 41 = obesidade III", T.classificarIMC(41).faixa === "obesidade_3");

// Caso 6: classificação visual de exercícios
check("Leg press → pernas", T.classificarGrupoVisual("Leg press") === "pernas");
check("Supino → empurrar", T.classificarGrupoVisual("Supino na máquina") === "empurrar");
check("Puxada → puxar", T.classificarGrupoVisual("Puxada frente") === "puxar");
check("Rosca → puxar", T.classificarGrupoVisual("Rosca com elástico ou garrafa") === "puxar");
check("Prancha → abdomen", T.classificarGrupoVisual("Prancha abdominal") === "abdomen");
check("Cada exercício tem grupoVisual", r1.treino.dias[0].exercicios.every(function (e) { return !!e.grupoVisual; }));

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);

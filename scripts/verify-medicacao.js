"use strict";

// Verificação da lógica pura de lembretes de medicação (sem I/O).
const M = require("../src/lib/medicacao");

let falhas = 0;
function check(descricao, condicao, extra) {
  const status = condicao ? "OK " : "FALHA";
  if (!condicao) falhas += 1;
  console.log(`[${status}] ${descricao}${extra ? " → " + extra : ""}`);
}

// --- normalização de horários ---
check("Horário válido 08:00", M.normalizarHorario("08:00") === "08:00");
check("Horário válido 23:59", M.normalizarHorario("23:59") === "23:59");
check("Horário inválido 24:00", M.normalizarHorario("24:00") === null);
check("Horário inválido 7:5", M.normalizarHorario("7:5") === null);
check("Horário inválido texto", M.normalizarHorario("manhã") === null);

const horarios = M.normalizarHorarios(["20:00", "08:00", "08:00", "bad", "12:30"]);
check("Horários únicos e ordenados", JSON.stringify(horarios) === JSON.stringify(["08:00", "12:30", "20:00"]), horarios.join(","));

// --- dias da semana ---
check("Dias 'todos' string", M.normalizarDiasSemana("todos") === "todos");
check("Dias vazio => todos", M.normalizarDiasSemana([]) === "todos");
check("Dias completos => todos", M.normalizarDiasSemana([0, 1, 2, 3, 4, 5, 6]) === "todos");
check("Dias parciais ordenados", JSON.stringify(M.normalizarDiasSemana([5, 1, 1, 3])) === JSON.stringify([1, 3, 5]));
check("Dias inválidos (7) => null", M.normalizarDiasSemana([7]) === null);
check("Dias inválidos (-1) => null", M.normalizarDiasSemana([-1]) === null);

// --- validação de medicamento ---
const bom = M.validarMedicamento({
  nome: "Losartana",
  dose: "50mg",
  instrucoes: "Após o café",
  horarios: ["08:00", "20:00"],
  diasSemana: "todos",
});
check("Medicamento válido aceito", bom.ok);
check("Medicamento válido normaliza ativo=true", bom.ok && bom.value.ativo === true);

check("Nome curto rejeitado", M.validarMedicamento({ nome: "A", horarios: ["08:00"] }).ok === false);
check("Sem horários rejeitado", M.validarMedicamento({ nome: "Vitamina D", horarios: [] }).ok === false);
check(
  "Instruções longas rejeitadas",
  M.validarMedicamento({ nome: "X", horarios: ["08:00"], instrucoes: "y".repeat(201) }).ok === false
);

// --- partesLocais (fuso) ---
// 2026-01-05 é uma segunda-feira (diaSemana=1). 12:00 UTC = 09:00 em São Paulo (UTC-3).
const dataRef = new Date("2026-01-05T12:00:00Z");
const partes = M.partesLocais(dataRef, "America/Sao_Paulo");
check("partesLocais dataRef", partes.dataRef === "2026-01-05", partes.dataRef);
check("partesLocais hhmm (UTC-3)", partes.hhmm === "09:00", partes.hhmm);
check("partesLocais diaSemana (segunda=1)", partes.diaSemana === 1, "dia=" + partes.diaSemana);

// --- estaDevido ---
const med = { ativo: true, horarios: ["09:00", "21:00"], diasSemana: "todos" };
check("Devido no horário certo", M.estaDevido(med, partes) === true);
check("Não devido em horário fora", M.estaDevido(med, { hhmm: "10:00", diaSemana: 1 }) === false);
check("Inativo nunca é devido", M.estaDevido({ ativo: false, horarios: ["09:00"], diasSemana: "todos" }, partes) === false);

const medSeg = { ativo: true, horarios: ["09:00"], diasSemana: [1, 3, 5] };
check("Devido em dia listado (segunda)", M.estaDevido(medSeg, partes) === true);
check("Não devido em dia não listado", M.estaDevido(medSeg, { hhmm: "09:00", diaSemana: 2 }) === false);

console.log("");
if (falhas) {
  console.error(`${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("Todas as verificações passaram.");

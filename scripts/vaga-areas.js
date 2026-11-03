"use strict";

const AREAS_VAGA = [
  { id: "administrativo_escritorio", label: "Administrativo e escritório" },
  { id: "atendimento_vendas", label: "Atendimento e vendas" },
  { id: "operacional_logistica", label: "Operacional e logística" },
  { id: "servicos_gerais", label: "Serviços gerais" },
  { id: "educacao_mentoria", label: "Educação e mentoria" },
  { id: "saude_bem_estar", label: "Saúde e bem-estar" },
  { id: "tecnologia_digital", label: "Tecnologia e digital" },
  { id: "financeiro_contabil", label: "Financeiro e contábil" },
];

const AREAS_VAGA_IDS = AREAS_VAGA.map(function (item) {
  return item.id;
});

const AREAS_VAGA_LABELS = AREAS_VAGA.reduce(function (acc, item) {
  acc[item.id] = item.label;
  return acc;
}, {});

function isAreaVagaValida(value) {
  return AREAS_VAGA_IDS.includes(String(value || "").trim());
}

function normalizeAreasInteresse(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  values.forEach(function (item) {
    const id = String(item || "").trim();
    if (!isAreaVagaValida(id) || seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push(id);
  });
  return result;
}

function getAreaVagaLabel(id) {
  return AREAS_VAGA_LABELS[String(id || "").trim()] || null;
}

module.exports = {
  AREAS_VAGA,
  AREAS_VAGA_IDS,
  AREAS_VAGA_LABELS,
  isAreaVagaValida,
  normalizeAreasInteresse,
  getAreaVagaLabel,
};

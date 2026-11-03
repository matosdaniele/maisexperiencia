(function (global) {
  "use strict";

  var AREAS_VAGA = [
    { id: "administrativo_escritorio", label: "Administrativo e escritório" },
    { id: "atendimento_vendas", label: "Atendimento e vendas" },
    { id: "operacional_logistica", label: "Operacional e logística" },
    { id: "servicos_gerais", label: "Serviços gerais" },
    { id: "educacao_mentoria", label: "Educação e mentoria" },
    { id: "saude_bem_estar", label: "Saúde e bem-estar" },
    { id: "tecnologia_digital", label: "Tecnologia e digital" },
    { id: "financeiro_contabil", label: "Financeiro e contábil" },
  ];

  var LABELS = {};
  AREAS_VAGA.forEach(function (item) {
    LABELS[item.id] = item.label;
  });

  global.ME_VAGA_AREAS = {
    list: AREAS_VAGA,
    getLabel: function (id) {
      return LABELS[String(id || "").trim()] || "";
    },
  };
})(window);

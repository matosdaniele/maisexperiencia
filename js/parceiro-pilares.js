(function () {
  window.ME_PARCEIRO_PILARES = {
    vaga: {
      titulo: "Vagas",
      tituloCard: "Vagas Curadas",
      lead: "Publique oportunidades de emprego ou acompanhe a curadoria das suas vagas.",
      texto: "Empresas que ativamente buscam profissionais 50+.",
      icon: "img/icon-vagas.png",
      publicar: "publicar_vaga.html",
      publicacoes: "publicacoes_parceiro.html?tipo=vaga",
    },
    curso: {
      titulo: "Cursos",
      tituloCard: "Capacitação",
      lead: "Envie cursos para curadoria ou consulte as suas publicações de capacitação.",
      texto: "Cursos digitais com linguagem acessível e suporte humano.",
      icon: "img/icon-capacitacao.png",
      publicar: "publicar_oferta.html?tipo=curso",
      publicacoes: "publicacoes_parceiro.html?tipo=curso",
    },
    bem_estar: {
      titulo: "Bem-estar",
      tituloCard: "Bem-Estar",
      lead: "Publique ofertas de bem-estar ou acompanhe o status das suas publicações.",
      texto: "Conteúdo sobre saúde preventiva, longevidade e equilíbrio.",
      icon: "img/icon-bem-estar.png",
      publicar: "publicar_oferta.html?tipo=bem_estar",
      publicacoes: "publicacoes_parceiro.html?tipo=bem_estar",
    },
    evento: {
      titulo: "Comunidade",
      tituloCard: "Comunidade",
      lead: "Cadastre encontros e atividades de comunidade ou veja as suas publicações.",
      texto: "Grupos, clubes e encontros para criar novos vínculos.",
      icon: "img/icon-comunidade.png",
      publicar: "publicar_oferta.html?tipo=evento",
      publicacoes: "publicacoes_parceiro.html?tipo=evento",
    },
  };

  window.ME_PARCEIRO_PILAR_ORDER = ["vaga", "curso", "bem_estar", "evento"];

  window.ME_PARCEIRO_PILAR = {
    get: function (tipo) {
      return window.ME_PARCEIRO_PILARES[tipo] || null;
    },
  };
})();

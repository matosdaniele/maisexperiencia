(function () {
  window.ME_ADMIN_HUB = [
    {
      id: "curadoria",
      titulo: "Curadoria",
      icon: "img/icon-admin-funnel.svg",
      view: "curadoria",
    },
    {
      id: "parceiros",
      titulo: "Aprovação de parceiros",
      icon: "img/icon-admin-heart_handshake.svg",
      href: "admin_parceiros.html",
      badgeId: "badge-parceiros",
    },
    {
      id: "inscricoes",
      titulo: "Inscrições e pagamentos",
      icon: "img/icon-admin-dollar_sign.svg",
      href: "admin_inscricoes.html",
      badgeId: "badge-inscricoes",
    },
    {
      id: "candidaturas",
      titulo: "Candidaturas e contratações",
      icon: "img/icon-admin-heart_handshake.svg",
      href: "admin_candidaturas.html",
      badgeId: "badge-candidaturas",
    },
  ];

  window.ME_ADMIN_CURADORIA = [
    {
      titulo: "Vagas",
      href: "admin_vagas.html",
      icon: "img/icon-vagas.png",
      badgeId: "badge-vagas",
    },
    {
      titulo: "Cursos",
      href: "admin_ofertas.html?tipo=curso",
      icon: "img/icon-capacitacao.png",
      badgeId: "badge-ofertas",
    },
    {
      titulo: "Comunidade",
      href: "admin_ofertas.html?tipo=evento",
      icon: "img/icon-comunidade.png",
    },
    {
      titulo: "Bem-estar",
      href: "admin_ofertas.html?tipo=bem_estar",
      icon: "img/icon-bem-estar.png",
    },
  ];
})();

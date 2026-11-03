"use strict";

const nodemailer = require("nodemailer");

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let smtpProbe = { at: 0, ok: false };

async function smtpPronto() {
  if (!isSmtpConfigured()) {
    return false;
  }
  const now = Date.now();
  if (now - smtpProbe.at < 30000) {
    return smtpProbe.ok;
  }
  try {
    await getTransporter().verify();
    smtpProbe = { at: now, ok: true };
    return true;
  } catch (err) {
    console.error("SMTP:", err.message);
    smtpProbe = { at: now, ok: false };
    return false;
  }
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getFromAddress() {
  const name = process.env.MAIL_FROM_NAME || "Mais Experiência";
  const email = process.env.MAIL_FROM_EMAIL || "contato@maisexperiencia.com.br";
  return `"${name}" <${email}>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendCadastroConfirmacao({ nome, email }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const siteUrl = process.env.SITE_URL || "https://maisexperiencia.com.br";

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Cadastro confirmado — Mais Experiência",
    text: [
      `Olá, ${nome}!`,
      "",
      "Seu cadastro na Mais Experiência foi recebido com sucesso.",
      "",
      `Acesse sua área 50+: ${siteUrl}/entrar_50.html`,
      "",
      "Dúvidas: contato@maisexperiencia.com.br",
    ].join("\n"),
    html: [
      `<p>Olá, <strong>${nome}</strong>!</p>`,
      "<p>Seu cadastro na <strong>Mais Experiência</strong> foi recebido com sucesso.</p>",
      `<p><a href="${siteUrl}/entrar_50.html">Acessar área 50+</a></p>`,
      "<p>Dúvidas: contato@maisexperiencia.com.br</p>",
    ].join(""),
  });

  return { sent: true };
}

async function sendInscricaoConfirmacao({ nome, email, titulo, valorBrl, status }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const valor = valorBrl.toFixed(2).replace(".", ",");
  const assunto =
    status === "paga"
      ? `Inscrição confirmada — ${titulo}`
      : `Inscrição recebida — ${titulo}`;

  const linhaStatus =
    status === "paga"
      ? "Pagamento registrado. Sua vaga está confirmada."
      : "Recebemos sua inscrição. Em breve entraremos em contato sobre o pagamento.";

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: assunto,
    text: [`Olá, ${nome}!`, "", linhaStatus, "", `Oferta: ${titulo}`, `Valor: R$ ${valor}`, ""].join("\n"),
  });

  return { sent: true };
}

async function sendParceiroCadastroRecebido({ nome, empresa, email }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Pedido de parceria recebido — Mais Experiência",
    text: [
      `Olá, ${nome}!`,
      "",
      `Recebemos o pedido de parceria de ${empresa}.`,
      "Nossa equipe irá analisar e entraremos em contato por e-mail.",
      "",
      "Dúvidas: contato@maisexperiencia.com.br",
    ].join("\n"),
    html: [
      `<p>Olá, <strong>${nome}</strong>!</p>`,
      `<p>Recebemos o pedido de parceria de <strong>${empresa}</strong>.</p>`,
      "<p>Nossa equipe irá analisar e entraremos em contato por e-mail.</p>",
      "<p>Dúvidas: contato@maisexperiencia.com.br</p>",
    ].join(""),
  });

  return { sent: true };
}

async function sendParceiroCadastroAdmin({ nome, empresa, email, telefone }) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.MAIL_FROM_EMAIL;
  if (!adminEmail || !isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const siteUrl = process.env.SITE_URL || "https://maisexperiencia.com.br";
  const tel = telefone || "—";

  await transporter.sendMail({
    from: getFromAddress(),
    to: adminEmail,
    subject: `[Admin] Novo pedido de parceria — ${empresa}`,
    text: [
      "Novo pedido de parceria aguardando aprovação:",
      "",
      `Empresa: ${empresa}`,
      `Responsável: ${nome}`,
      `E-mail: ${email}`,
      `Telefone: ${tel}`,
      "",
      `Painel admin: ${siteUrl}/admin_parceiros.html`,
    ].join("\n"),
  });

  return { sent: true };
}

async function sendParceiroAprovacao({ nome, email, token }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const siteUrl = process.env.SITE_URL || "https://maisexperiencia.com.br";
  const link = `${siteUrl}/ativar_parceiro.html?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Parceria aprovada — finalize seu cadastro",
    text: [
      `Olá, ${nome}!`,
      "",
      "Sua parceria na Mais Experiência foi aprovada.",
      "Para concluir, crie sua senha de acesso:",
      "",
      link,
      "",
      "Este link expira em 7 dias.",
      "",
      "Dúvidas: contato@maisexperiencia.com.br",
    ].join("\n"),
    html: [
      `<p>Olá, <strong>${nome}</strong>!</p>`,
      "<p>Sua parceria na <strong>Mais Experiência</strong> foi aprovada.</p>",
      "<p>Para concluir, crie sua senha de acesso:</p>",
      `<p><a href="${link}">Finalizar cadastro de parceiro</a></p>`,
      "<p><small>Este link expira em 7 dias.</small></p>",
    ].join(""),
  });

  return { sent: true };
}

async function sendParceiroRejeicao({ nome, email, motivo }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const linhaMotivo = motivo ? `Motivo: ${motivo}` : "";

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Pedido de parceria — Mais Experiência",
    text: [
      `Olá, ${nome}!`,
      "",
      "Agradecemos o interesse em ser parceiro da Mais Experiência.",
      "Neste momento não foi possível aprovar o pedido.",
      linhaMotivo,
      "",
      "Dúvidas: contato@maisexperiencia.com.br",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return { sent: true };
}

async function sendContratacaoAdmin({ candidatoNome, candidatoEmail, vagaTitulo, empresa, parceiroEmail, taxaBrl }) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.MAIL_FROM_EMAIL;
  if (!adminEmail || !isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const siteUrl = process.env.SITE_URL || "https://maisexperiencia.com.br";
  const taxa = typeof taxaBrl === "number"
    ? "R$ " + taxaBrl.toFixed(2).replace(".", ",")
    : "—";

  await transporter.sendMail({
    from: getFromAddress(),
    to: adminEmail,
    subject: `[Admin] Contratação registrada — ${vagaTitulo}`,
    text: [
      "Um parceiro marcou um candidato 50+ como contratado:",
      "",
      `Candidato: ${candidatoNome || "—"} (${candidatoEmail})`,
      `Vaga: ${vagaTitulo}`,
      `Empresa: ${empresa || "—"}`,
      `Parceiro: ${parceiroEmail || "—"}`,
      `Taxa de contratação a cobrar: ${taxa}`,
      "",
      `Registre a cobrança no painel admin: ${siteUrl}/admin_candidaturas.html`,
    ].join("\n"),
  });

  return { sent: true };
}

async function sendLembreteMedicacao({ email, nome, medNome, dose, instrucoes, horario }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const siteUrl = process.env.SITE_URL || "https://maisexperiencia.com.br";
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  const linhaDose = dose ? `${medNome} — ${dose}` : medNome;

  const textLinhas = [
    saudacao,
    "",
    `Está na hora do seu medicamento (${horario}):`,
    `• ${linhaDose}`,
  ];
  if (instrucoes) textLinhas.push(`Instruções: ${instrucoes}`);
  textLinhas.push(
    "",
    "Este é um lembrete automático. Em caso de dúvida sobre a medicação, fale com seu médico ou farmacêutico.",
    "",
    `Para ajustar ou desativar seus lembretes, acesse: ${siteUrl}/bem_estar_50.html`
  );

  const htmlLinhas = [
    `<p>${saudacao}</p>`,
    `<p>Está na hora do seu medicamento (<strong>${horario}</strong>):</p>`,
    `<p style="font-size:1.1em"><strong>${medNome}</strong>${dose ? " — " + dose : ""}</p>`,
  ];
  if (instrucoes) htmlLinhas.push(`<p>Instruções: ${instrucoes}</p>`);
  htmlLinhas.push(
    "<p><small>Este é um lembrete automático. Em caso de dúvida sobre a medicação, fale com seu médico ou farmacêutico.</small></p>",
    `<p><small><a href="${siteUrl}/bem_estar_50.html">Ajustar ou desativar meus lembretes</a></small></p>`
  );

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: `Hora do medicamento: ${medNome} (${horario})`,
    text: textLinhas.join("\n"),
    html: htmlLinhas.join(""),
  });

  return { sent: true };
}

async function sendRecuperacaoSenha({ nome, email, link, contaLabel }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = getTransporter();
  const nomeTexto = nome || "";
  const conta = contaLabel || "sua conta";
  const nomeSeguro = escapeHtml(nomeTexto || "olá");
  const linkSeguro = escapeHtml(link);

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Redefinir senha — Mais Experiência",
    text: [
      `Olá, ${nomeTexto}!`,
      "",
      `Recebemos um pedido para redefinir a senha de ${conta} na Mais Experiência.`,
      "Se foi você, use o link abaixo. Ele expira em 1 hora.",
      "",
      link,
      "",
      "Se você não pediu esta alteração, ignore este e-mail. Sua senha continua a mesma.",
      "",
      "Dúvidas: contato@maisexperiencia.com.br",
    ].join("\n"),
    html: [
      `<p>Olá, <strong>${nomeSeguro}</strong>!</p>`,
      `<p>Recebemos um pedido para redefinir a senha de ${escapeHtml(conta)} na <strong>Mais Experiência</strong>.</p>`,
      "<p>Se foi você, use o link abaixo. Ele expira em 1 hora.</p>",
      `<p><a href="${linkSeguro}">Criar nova senha</a></p>`,
      "<p>Se você não pediu esta alteração, ignore este e-mail. Sua senha continua a mesma.</p>",
      "<p>Dúvidas: contato@maisexperiencia.com.br</p>",
    ].join(""),
  });

  return { sent: true };
}

module.exports = {
  isSmtpConfigured,
  smtpPronto,
  sendCadastroConfirmacao,
  sendInscricaoConfirmacao,
  sendParceiroCadastroRecebido,
  sendParceiroCadastroAdmin,
  sendParceiroAprovacao,
  sendParceiroRejeicao,
  sendContratacaoAdmin,
  sendLembreteMedicacao,
  sendRecuperacaoSenha,
};

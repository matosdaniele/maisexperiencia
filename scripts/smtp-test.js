"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const nodemailer = require("nodemailer");

const to = process.argv[2] || process.env.SMTP_USER;

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.verify();
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "Mais Experiência"}" <${process.env.MAIL_FROM_EMAIL || "contato@maisexperiencia.com.br"}>`,
    to,
    subject: "Teste SMTP — Mais Experiência",
    text: "SMTP configurado com sucesso na API.",
  });

  console.log("OK — e-mail de teste enviado para", to);
}

main().catch(function (err) {
  console.error("Falha SMTP:", err.message);
  process.exit(1);
});

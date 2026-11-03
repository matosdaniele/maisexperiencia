"use strict";

/**
 * Cliente mínimo da Telegram Bot API (custo zero).
 * Usa o fetch nativo do Node 18+ — sem dependências novas.
 *
 * Config por variáveis de ambiente:
 *   TELEGRAM_BOT_TOKEN     token do bot (obrigatório para habilitar)
 *   TELEGRAM_BOT_USERNAME  username do bot sem @ (para montar o deep link t.me)
 */

function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function botUsername() {
  return String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
}

async function apiCall(method, payload) {
  if (!isTelegramConfigured()) {
    return { ok: false, reason: "telegram_not_configured" };
  }
  const url = "https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/" + method;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return resp.json().catch(function () {
    return { ok: false, reason: "invalid_json" };
  });
}

async function sendMessage(chatId, text) {
  return apiCall("sendMessage", {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

async function getUpdates(offset, timeout) {
  return apiCall("getUpdates", {
    offset: offset || 0,
    timeout: timeout || 0,
    allowed_updates: ["message"],
  });
}

function deepLink(codigo) {
  const user = botUsername();
  if (!user) return null;
  return "https://t.me/" + user + "?start=" + encodeURIComponent(codigo);
}

module.exports = {
  isTelegramConfigured: isTelegramConfigured,
  botUsername: botUsername,
  sendMessage: sendMessage,
  getUpdates: getUpdates,
  deepLink: deepLink,
};

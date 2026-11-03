"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

function validatePassword(senha) {
  const value = String(senha || "");

  if (value.length < 6) {
    return {
      ok: false,
      error: "A senha deve ter no mínimo 6 caracteres.",
    };
  }

  let regras = 0;
  if (/[a-zA-Z]/.test(value)) regras += 1;
  if (/[0-9]/.test(value)) regras += 1;
  if (/[^a-zA-Z0-9]/.test(value)) regras += 1;

  if (regras < 2) {
    return {
      ok: false,
      error:
        "A senha deve cumprir pelo menos 2 regras: conter letra, número ou caractere especial.",
    };
  }

  return { ok: true };
}

async function hashPassword(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(senha, salt, 64);
  return salt + ":" + derived.toString("hex");
}

async function verifyPassword(senha, senhaHash) {
  if (!senhaHash || !String(senhaHash).includes(":")) {
    return false;
  }

  const parts = String(senhaHash).split(":");
  const salt = parts[0];
  const stored = parts[1];
  if (!salt || !stored) {
    return false;
  }

  const derived = await scrypt(senha, salt, 64);
  const storedBuf = Buffer.from(stored, "hex");
  if (storedBuf.length !== derived.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuf, derived);
}

module.exports = {
  validatePassword,
  hashPassword,
  verifyPassword,
};

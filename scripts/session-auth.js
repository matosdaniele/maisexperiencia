"use strict";

const crypto = require("crypto");

const SESSION_TTL_MS = 20 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function extractSessionToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return String(req.headers["x-session-token"] || "").trim();
}

async function createSession(db, { email, tipo }) {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.collection("sessoes").insertOne({
    token,
    email: String(email || "").trim().toLowerCase(),
    tipo,
    createdAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

async function validateSession(db, token, expectedTipo) {
  if (!token) {
    return null;
  }

  const doc = await db.collection("sessoes").findOne({ token });
  if (!doc) {
    return null;
  }

  if (expectedTipo && doc.tipo !== expectedTipo) {
    return null;
  }

  if (doc.expiresAt && new Date() > new Date(doc.expiresAt)) {
    await db.collection("sessoes").deleteOne({ token });
    return null;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.collection("sessoes").updateOne({ token }, { $set: { expiresAt } });

  return {
    email: doc.email,
    tipo: doc.tipo,
    token,
  };
}

async function revokeSession(db, token) {
  if (!token) {
    return;
  }
  await db.collection("sessoes").deleteOne({ token });
}

async function revokeSessionsForAccount(db, email, tipo) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return;
  }
  const filter = { email: normalized };
  if (tipo) {
    filter.tipo = tipo;
  }
  await db.collection("sessoes").deleteMany(filter);
}

module.exports = {
  SESSION_TTL_MS,
  extractSessionToken,
  createSession,
  validateSession,
  revokeSession,
  revokeSessionsForAccount,
};

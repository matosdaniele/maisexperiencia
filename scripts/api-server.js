"use strict";

require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const {
  isSmtpConfigured,
  sendCadastroConfirmacao,
  sendInscricaoConfirmacao,
  sendParceiroCadastroRecebido,
  sendParceiroCadastroAdmin,
  sendParceiroAprovacao,
  sendParceiroRejeicao,
  sendContratacaoAdmin,
  sendLembreteMedicacao,
  sendRecuperacaoSenha,
} = require("./mail");
const {
  isTelegramConfigured,
  sendMessage: telegramSendMessage,
  getUpdates: telegramGetUpdates,
  deepLink: telegramDeepLink,
  botUsername: telegramBotUsername,
} = require("./telegram");
const MEDICACAO = require("../src/lib/medicacao");
const {
  validatePassword,
  hashPassword,
  verifyPassword,
} = require("./auth-password");
const { importLinkedInProfile } = require("./linkedin-import");
const { importCurriculoPdfDataUrl } = require("./curriculo-pdf-import");
const {
  AREAS_VAGA,
  isAreaVagaValida,
  normalizeAreasInteresse,
  getAreaVagaLabel,
} = require("./vaga-areas");
const {
  createSession,
  extractSessionToken,
  validateSession,
  revokeSessionsForAccount,
} = require("./session-auth");
const {
  isOpenRouterConfigured,
  scoreCurriculoForVaga,
  buildCandidatoMatchInputHash,
  MAX_POOL,
} = require("./curriculo-vaga-match");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "maisexperiencia";
const COMISSAO_PCT = Number(process.env.MARKETPLACE_COMISSAO_PCT) || 20;
// Taxa de contratação cobrada ao parceiro no sucesso (1 salário mínimo — PN §4.7).
const CONTRATACAO_TAXA_BRL = Number(process.env.CONTRATACAO_TAXA_BRL) || 1518;

// Lembretes de medicação (Bem-estar) — canais gratuitos Telegram/e-mail.
const LEMBRETES_ENABLED = process.env.LEMBRETES_ENABLED !== "false";
const LEMBRETES_TZ = process.env.LEMBRETES_TZ || MEDICACAO.TZ_PADRAO;
const CANAIS_LEMBRETE = ["telegram", "email"];
const TELEGRAM_VINCULO_TTL_MS = 15 * 60 * 1000;

const REGIMES_VAGA = ["clt", "pj", "temporario", "meio_periodo", "outro"];
const MODALIDADES_VAGA = ["presencial", "hibrido", "remoto"];
const TIPOS_OFERTA = ["curso", "bem_estar", "evento"];
const CANDIDATURA_STATUS = [
  "enviada",
  "em_analise",
  "entrevista",
  "contratada",
  "nao_selecionada",
];
const FLAGS_CURADORIA = [
  "jovem talento",
  "digital native",
  "recém-formado",
  "recem-formado",
  "recém formado",
  "recem formado",
  "até 30",
  "ate 30",
  "até 35",
  "ate 35",
  "generation z",
  "millennial",
  " jovem ",
];

const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://maisexperiencia.com.br",
  "https://www.maisexperiencia.com.br",
];

const OFERTAS_SEED = [];

if (!MONGODB_URI) {
  console.error("MONGODB_URI não definida. Copie .env.example para .env");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "3mb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origem não permitida pelo CORS"));
    },
  })
);

let client;
let db;

async function connectDb() {
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection("contas").createIndex({ email: 1 }, { unique: true });
  await db.collection("inscricoes").createIndex({ email: 1, ofertaId: 1 }, { unique: true });
  await db.collection("inscricoes").createIndex({ status: 1, createdAt: -1 });
  await db.collection("inscricoes").createIndex({ ofertaId: 1 });
  await db.collection("vagas").createIndex({ status: 1, createdAt: -1 });
  await db.collection("candidaturas").createIndex({ email: 1, vagaId: 1 }, { unique: true });
  await db.collection("candidaturas").createIndex({ status: 1, createdAt: -1 });
  await db.collection("candidaturas").createIndex({ vagaId: 1 });
  await db.collection("parceiros").createIndex({ email: 1 }, { unique: true });
  await db.collection("parceiros").createIndex({ status: 1, createdAt: -1 });
  await db.collection("parceiros").createIndex({ activationToken: 1 }, { sparse: true });
  await db.collection("ofertas").createIndex({ status: 1, createdAt: -1 });
  await db.collection("ofertas").createIndex({ promovida: 1, tipo: 1, status: 1 }, { sparse: true });
  await db.collection("vagas").createIndex({ promovida: 1, status: 1 }, { sparse: true });
  await db.collection("match_candidato_cache").createIndex({ email: 1, vagaId: 1 }, { unique: true });
  await db.collection("match_ranking_cache").createIndex({ vagaId: 1, escopo: 1 }, { unique: true });
  await db.collection("sessoes").createIndex({ token: 1 }, { unique: true });
  await db.collection("sessoes").createIndex({ email: 1, tipo: 1 });
  await db.collection("sessoes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("contas").createIndex({ resetTokenHash: 1 }, { sparse: true });
  await db.collection("parceiros").createIndex({ resetTokenHash: 1 }, { sparse: true });
  await db.collection("comunidades").createIndex({ visibilidade: 1, createdAt: -1 });
  await db.collection("comunidades").createIndex({ criadorEmail: 1 });
  await db
    .collection("comunidade_membros")
    .createIndex({ comunidadeId: 1, email: 1 }, { unique: true });
  await db.collection("comunidade_membros").createIndex({ email: 1 });
  await db.collection("comunidade_convites").createIndex({ codigo: 1 }, { unique: true });
  await db
    .collection("comunidade_convites")
    .createIndex({ comunidadeId: 1, criadorEmail: 1 }, { unique: true });

  // Lembretes de medicação (Bem-estar).
  await db.collection("medicamentos").createIndex({ email: 1, ativo: 1 });
  await db.collection("medicamentos").createIndex({ ativo: 1, horarios: 1 });
  await db
    .collection("medicamento_envios")
    .createIndex({ medicamentoId: 1, dataRef: 1, horario: 1 }, { unique: true });
  await db.collection("telegram_vinculos").createIndex({ codigo: 1 }, { unique: true });
  await db
    .collection("telegram_vinculos")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const ofertasCount = await db.collection("ofertas").countDocuments();
  if (ofertasCount === 0) {
    await db.collection("ofertas").insertMany(
      OFERTAS_SEED.map(function (oferta) {
        return Object.assign({}, oferta, { createdAt: new Date() });
      })
    );
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDocId(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid);
    if (typeof value.toHexString === "function") return value.toHexString();
  }
  return String(value);
}

function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ ok: false, error: "Não autorizado." });
    return;
  }
  next();
}

async function requireContaSession(req, res, next) {
  const token = extractSessionToken(req);
  const session = await validateSession(db, token, "50");
  if (!session) {
    res.status(401).json({ ok: false, error: "Sessão inválida ou expirada. Entre novamente." });
    return;
  }
  req.sessionUser = session;
  next();
}

async function requireParceiroSession(req, res, next) {
  const token = extractSessionToken(req);
  const session = await validateSession(db, token, "parceiro");
  if (!session) {
    res.status(401).json({ ok: false, error: "Sessão inválida ou expirada. Entre novamente." });
    return;
  }
  req.sessionUser = session;
  next();
}

async function optionalContaSession(req, res, next) {
  const token = extractSessionToken(req);
  if (!token) {
    next();
    return;
  }
  const session = await validateSession(db, token, "50");
  if (!session) {
    res.status(401).json({ ok: false, error: "Sessão inválida ou expirada. Entre novamente." });
    return;
  }
  req.sessionUser = session;
  next();
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function detectFlagsCuradoria(parts) {
  const texto = parts.join(" ").toLowerCase();
  return FLAGS_CURADORIA.filter(function (termo) {
    return texto.includes(termo);
  });
}

function parseDataPublicacaoInput(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  const [year, month, day] = s.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseVigenciaInput(body) {
  return {
    dataInicio: parseDataPublicacaoInput(body.dataInicio),
    dataFim: parseDataPublicacaoInput(body.dataFim),
  };
}

function validateVigenciaPlataforma(dataInicio, dataFim) {
  if (!dataInicio) {
    return { ok: false, error: "Informe a data de início da publicação." };
  }
  if (!dataFim) {
    return { ok: false, error: "Informe a data de fim da publicação." };
  }
  if (dataInicio.getTime() > dataFim.getTime()) {
    return {
      ok: false,
      error: "A data de fim deve ser igual ou posterior à data de início.",
    };
  }
  return { ok: true };
}

function validateLogoDataUrl(value) {
  const s = String(value || "").trim();
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!match) {
    return { ok: false, error: "Formato de imagem inválido. Use PNG, JPG ou WebP." };
  }
  const size = Buffer.from(match[2], "base64").length;
  if (size > 400 * 1024) {
    return { ok: false, error: "A imagem deve ter no máximo 400 KB." };
  }
  return { ok: true, logoDataUrl: s };
}

function validateCurriculoDataUrl(value, nomeArquivo) {
  const s = String(value || "").trim();
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!match) {
    return { ok: false, error: "Formato inválido. Envie um ficheiro PDF." };
  }
  const size = Buffer.from(match[2], "base64").length;
  if (size > 2 * 1024 * 1024) {
    return { ok: false, error: "O currículo deve ter no máximo 2 MB." };
  }
  const nome = String(nomeArquivo || "").trim() || "curriculo.pdf";
  if (nome.length > 120) {
    return { ok: false, error: "Nome do ficheiro demasiado longo." };
  }
  return { ok: true, curriculoDataUrl: s, nomeArquivo: nome };
}

function sanitizeCurriculoText(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen);
}

function sanitizeCurriculoList(items, maxItems, maxItemLen) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map(function (item) {
      return sanitizeCurriculoText(item, maxItemLen);
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeCurriculoIdiomas(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map(function (item) {
      return {
        idioma: sanitizeCurriculoText(item && item.idioma, 60),
        nivel: sanitizeCurriculoText(item && item.nivel, 40),
      };
    })
    .filter(function (item) {
      return item.idioma;
    })
    .slice(0, 10);
}

function sanitizeCurriculoExperiencias(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map(function (item) {
      return {
        empresa: sanitizeCurriculoText(item && item.empresa, 120),
        cargo: sanitizeCurriculoText(item && item.cargo, 120),
        periodo: sanitizeCurriculoText(item && item.periodo, 80),
        local: sanitizeCurriculoText(item && item.local, 120),
        descricao: sanitizeCurriculoText(item && item.descricao, 4000),
      };
    })
    .filter(function (item) {
      return item.empresa || item.cargo;
    })
    .slice(0, 20);
}

function sanitizeCurriculoFormacao(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map(function (item) {
      return {
        instituicao: sanitizeCurriculoText(item && item.instituicao, 120),
        curso: sanitizeCurriculoText(item && item.curso, 160),
        periodo: sanitizeCurriculoText(item && item.periodo, 80),
      };
    })
    .filter(function (item) {
      return item.instituicao || item.curso;
    })
    .slice(0, 15);
}

function validateCurriculoPerfilInput(body) {
  const nome = sanitizeCurriculoText(body.nome, 120);
  if (nome.length < 2) {
    return { ok: false, error: "Informe seu nome completo." };
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { ok: false, error: "Informe um e-mail válido." };
  }

  const linkedinUrl = sanitizeCurriculoText(body.linkedinUrl, 300);
  if (linkedinUrl && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedinUrl)) {
    return { ok: false, error: "Informe um link válido do LinkedIn (linkedin.com/in/…)." };
  }

  let fotoDataUrl = null;
  if (body.fotoDataUrl) {
    const fotoCheck = validateLogoDataUrl(body.fotoDataUrl);
    if (!fotoCheck.ok) {
      return { ok: false, error: fotoCheck.error };
    }
    fotoDataUrl = fotoCheck.logoDataUrl;
  }

  const competenciasRaw = body.competencias;
  let competencias = [];
  if (Array.isArray(competenciasRaw)) {
    competencias = sanitizeCurriculoList(competenciasRaw, 30, 120);
  } else if (typeof competenciasRaw === "string") {
    competencias = sanitizeCurriculoList(
      competenciasRaw.split(/\n+/),
      30,
      120
    );
  }

  return {
    ok: true,
    perfil: {
      nome,
      titulo: sanitizeCurriculoText(body.titulo, 160),
      localizacao: sanitizeCurriculoText(body.localizacao, 120),
      email,
      telefone: sanitizeCurriculoText(body.telefone, 40),
      linkedinUrl: linkedinUrl || null,
      resumo: sanitizeCurriculoText(body.resumo, 4000),
      competencias,
      idiomas: sanitizeCurriculoIdiomas(body.idiomas),
      experiencias: sanitizeCurriculoExperiencias(body.experiencias),
      formacao: sanitizeCurriculoFormacao(body.formacao),
      fotoDataUrl,
    },
  };
}

function sanitizeImportedPerfil(perfil) {
  const nome = sanitizeCurriculoText(perfil.nome, 120);
  if (nome.length < 2) {
    return {
      ok: false,
      error:
        "Não foi possível identificar o nome no ficheiro importado. Revise o PDF ou preencha manualmente.",
    };
  }

  let linkedinUrl = sanitizeCurriculoText(perfil.linkedinUrl, 300);
  if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl)) {
    linkedinUrl = "https://" + linkedinUrl.replace(/^\/\//, "");
  }
  if (
    linkedinUrl &&
    !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedinUrl)
  ) {
    linkedinUrl = "";
  }

  let fotoDataUrl = null;
  if (perfil.fotoDataUrl) {
    const fotoCheck = validateLogoDataUrl(perfil.fotoDataUrl);
    if (fotoCheck.ok) {
      fotoDataUrl = fotoCheck.logoDataUrl;
    }
  }

  const emailConta = String(perfil.email || "").trim().toLowerCase();

  return {
    ok: true,
    perfil: {
      nome,
      titulo: sanitizeCurriculoText(perfil.titulo, 160),
      localizacao: sanitizeCurriculoText(perfil.localizacao, 120),
      email: isValidEmail(emailConta) ? emailConta : perfil.email,
      telefone: sanitizeCurriculoText(perfil.telefone, 40),
      linkedinUrl: linkedinUrl || null,
      resumo: sanitizeCurriculoText(perfil.resumo, 4000),
      competencias: sanitizeCurriculoList(perfil.competencias, 30, 120),
      idiomas: sanitizeCurriculoIdiomas(perfil.idiomas),
      experiencias: sanitizeCurriculoExperiencias(perfil.experiencias),
      formacao: sanitizeCurriculoFormacao(perfil.formacao),
      fotoDataUrl,
    },
  };
}

function buildCurriculoImportResponse(doc, perfil, options) {
  options = options || {};
  const merged = Object.assign({}, perfil);
  merged.email = doc.email;
  if (!merged.telefone && doc.telefone) {
    merged.telefone = sanitizeCurriculoText(doc.telefone, 40);
  }
  if (!merged.nome && doc.nome) {
    merged.nome = sanitizeCurriculoText(doc.nome, 120);
  }

  const sanitized = sanitizeImportedPerfil(merged);
  if (!sanitized.ok) {
    return sanitized;
  }
  sanitized.perfil.email = doc.email;

  return {
    ok: true,
    message:
      options.message ||
      "Dados importados. Revise os campos antes de salvar.",
    source: options.source || "import",
    imported: options.imported || {},
    perfil: sanitized.perfil,
  };
}

function parseHoraInput(value) {
  const s = String(value || "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) {
    return null;
  }
  return s;
}

function publicVagaDoc(vaga) {
  return {
    _id: vaga._id,
    titulo: vaga.tituloPublicado || vaga.titulo,
    empresa: vaga.empresa,
    areaTrabalho: vaga.areaTrabalho || null,
    areaTrabalhoLabel: getAreaVagaLabel(vaga.areaTrabalho) || null,
    descricao: vaga.descricaoPublicada || vaga.descricao,
    requisitosEssenciais: vaga.requisitosEssenciais,
    requisitosDesejaveis: vaga.requisitosDesejaveis || null,
    oQueEmpresaOferece: vaga.oQueEmpresaOferece || null,
    regime: vaga.regime,
    modalidade: vaga.modalidade,
    local: vaga.local,
    salarioTexto: vaga.salarioTexto,
    linkCandidatura: vaga.linkCandidatura || null,
    dataInicio: vaga.dataInicio || null,
    dataFim: vaga.dataFim || vaga.dataPublicacao || null,
    dataPublicacao: vaga.dataFim || vaga.dataPublicacao || null,
    approvedAt: vaga.approvedAt,
  };
}

function publicOfertaDoc(oferta, extra) {
  return Object.assign(
    {
      _id: oferta._id,
      tipo: oferta.tipo,
      titulo: oferta.titulo,
      parceiro: oferta.parceiro,
      descricao: oferta.descricao,
      valorInscricaoBrl: oferta.valorInscricaoBrl,
      modalidade: oferta.modalidade,
      local: oferta.local || null,
      referencia: oferta.referencia || null,
      dataTexto: oferta.dataTexto || null,
      dataInicio: oferta.dataInicio || null,
      dataFim: oferta.dataFim || oferta.dataPublicacao || null,
      dataPublicacao: oferta.dataPublicacao || null,
      hora: oferta.hora || null,
    },
    extra || {}
  );
}

async function findPublicacaoParceiro(emailParceiro, id, categoria) {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);

  if (categoria === "vaga") {
    return db.collection("vagas").findOne({
      _id: oid,
      emailContatoParceiro: emailParceiro,
    });
  }

  if (TIPOS_OFERTA.includes(categoria)) {
    return db.collection("ofertas").findOne({
      _id: oid,
      emailContatoParceiro: emailParceiro,
      tipo: categoria,
    });
  }

  return null;
}

async function enrichInscritosComContato(registros) {
  const emails = [...new Set(registros.map(function (item) {
    return String(item.email || "").trim().toLowerCase();
  }).filter(Boolean))];

  const contasByEmail = new Map();
  if (emails.length) {
    const contas = await db
      .collection("contas")
      .find({ email: { $in: emails } })
      .project({ nome: 1, email: 1, telefone: 1 })
      .toArray();
    contas.forEach(function (conta) {
      contasByEmail.set(conta.email, conta);
    });
  }

  return registros.map(function (registro) {
    const email = String(registro.email || "").trim().toLowerCase();
    const conta = contasByEmail.get(email);
    return {
      nome: registro.nome || (conta && conta.nome) || "—",
      email: email || "—",
      telefone: (conta && conta.telefone) || null,
      status: registro.status || null,
      inscritoEm: registro.createdAt || null,
    };
  });
}

async function loadCurriculosForMatch(escopo, vagaObjectId) {
  if (escopo === "candidatos") {
    const candidaturas = await db
      .collection("candidaturas")
      .find({ vagaId: vagaObjectId })
      .project({ email: 1 })
      .toArray();
    const emails = [
      ...new Set(
        candidaturas
          .map(function (item) {
            return String(item.email || "").trim().toLowerCase();
          })
          .filter(Boolean)
      ),
    ];
    if (!emails.length) {
      return [];
    }
    return db
      .collection("contas")
      .find({
        email: { $in: emails },
        "curriculoPerfil.nome": { $exists: true, $ne: "" },
      })
      .project({ email: 1, nome: 1, curriculoPerfil: 1 })
      .toArray();
  }

  return db
    .collection("contas")
    .find({
      "curriculoPerfil.nome": { $exists: true, $ne: "" },
    })
    .project({ email: 1, nome: 1, curriculoPerfil: 1 })
    .sort({ curriculoPerfilUpdatedAt: -1 })
    .limit(MAX_POOL)
    .toArray();
}

function buildCandidaturaStatusChange(candidatura, status) {
  const update = { status: status, statusAtualizadoEm: new Date() };
  const cobranca = candidatura.cobranca || null;

  if (status === "contratada") {
    update.contratadoEm = candidatura.contratadoEm || new Date();
    if (cobranca && cobranca.status === "paga") {
      update.cobranca = cobranca;
    } else {
      update.cobranca = {
        tipo: "taxa_contratacao",
        valorBrl: CONTRATACAO_TAXA_BRL,
        status: "pendente",
        criadoEm: (cobranca && cobranca.criadoEm) || new Date(),
      };
    }
    return { ok: true, update: update };
  }

  // Qualquer estado diferente de "contratada" remove a contratação.
  update.contratadoEm = null;
  if (cobranca && cobranca.status === "paga") {
    return {
      ok: false,
      error: "Contratação já faturada. Contacte a equipe Mais Experiência para reverter.",
    };
  }
  update.cobranca = null;
  return { ok: true, update: update };
}

async function getCandidatoScoreCached(vaga, conta) {
  const email = String(conta.email || "").trim().toLowerCase();
  const inputHash = buildCandidatoMatchInputHash(vaga, conta);
  const cached = await db.collection("match_candidato_cache").findOne({
    email: email,
    vagaId: vaga._id,
    inputHash: inputHash,
  });

  if (cached) {
    return { score: cached.score, motivo: cached.motivo, modelo: cached.modelo };
  }

  const result = await scoreCurriculoForVaga(vaga, conta);
  await db.collection("match_candidato_cache").updateOne(
    { email: email, vagaId: vaga._id },
    {
      $set: {
        inputHash: inputHash,
        score: result.score,
        motivo: result.motivo,
        modelo: result.modelo,
        calculatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return { score: result.score, motivo: result.motivo, modelo: result.modelo };
}

async function buildAlinhamentoVagaResponse(vaga, options) {
  const opts = options || {};
  const escopo = opts.escopo === "candidatos" ? "candidatos" : "plataforma";
  const limit = Math.max(1, Math.min(Number(opts.limit) || 10, 25));

  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error:
          "Alinhamento por IA indisponível. Configure OPENROUTER_API_KEY no servidor.",
      },
    };
  }

  const contas = await loadCurriculosForMatch(escopo, vaga._id);
  if (!contas.length) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        escopo: escopo,
        vaga: {
          _id: vaga._id,
          titulo: vaga.tituloPublicado || vaga.titulo,
          empresa: vaga.empresa,
        },
        totalAvaliados: 0,
        ranking: [],
        message:
          escopo === "candidatos"
            ? "Nenhum candidato com currículo preenchido para esta vaga."
            : "Nenhum currículo preenchido na plataforma.",
      },
    };
  }

  const candidaturas = await db
    .collection("candidaturas")
    .find({ vagaId: vaga._id })
    .project({ email: 1, status: 1, cobranca: 1 })
    .toArray();
  const candidaturaByEmail = new Map();
  candidaturas.forEach(function (item) {
    candidaturaByEmail.set(String(item.email || "").trim().toLowerCase(), item);
  });

  const contasMarcadas = contas.map(function (conta) {
    const email = String(conta.email || "").trim().toLowerCase();
    const cand = candidaturaByEmail.get(email);
    const candidatou = escopo === "candidatos" || !!cand;
    return Object.assign({}, conta, {
      candidatou: candidatou,
      candidaturaStatus: candidatou ? ((cand && cand.status) || "enviada") : null,
      cobrancaStatus: cand && cand.cobranca ? cand.cobranca.status : null,
    });
  });

  try {
    // Fonte única de verdade: o ranking do parceiro reutiliza exactamente o mesmo
    // score por candidato que o 50+ vê na vaga (scoreCurriculoForVaga + match_candidato_cache).
    // Assim, a % apresentada ao 50+ e a % apresentada ao parceiro são idênticas.
    const CONCURRENCY = 4;
    const ranking = [];
    let modelo = null;
    let firstError = null;
    let cursor = 0;

    async function worker() {
      while (cursor < contasMarcadas.length) {
        const current = contasMarcadas[cursor];
        cursor += 1;
        try {
          const scored = await getCandidatoScoreCached(vaga, current);
          modelo = modelo || scored.modelo;
          ranking.push({
            email: String(current.email || "").trim().toLowerCase(),
            nome:
              (current.curriculoPerfil && current.curriculoPerfil.nome) ||
              current.nome ||
              "",
            score: scored.score,
            motivo: scored.motivo,
            candidatou: !!current.candidatou,
            status: current.candidaturaStatus || null,
            cobrancaStatus: current.cobrancaStatus || null,
          });
        } catch (err) {
          if (err && err.code === "SEM_CURRICULO") {
            continue;
          }
          firstError = firstError || err;
          return;
        }
      }
    }

    const workers = [];
    const poolSize = Math.min(CONCURRENCY, contasMarcadas.length);
    for (let i = 0; i < poolSize; i += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);

    if (firstError && !ranking.length) {
      throw firstError;
    }

    ranking.sort(function (a, b) {
      return b.score - a.score;
    });

    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        escopo: escopo,
        vaga: {
          _id: vaga._id,
          titulo: vaga.tituloPublicado || vaga.titulo,
          empresa: vaga.empresa,
        },
        totalAvaliados: ranking.length,
        modelo: modelo,
        ranking: ranking.slice(0, limit),
      },
    };
  } catch (error) {
    console.error("alinhamento vaga:", error);
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error: error.message || "Não foi possível calcular o alinhamento.",
      },
    };
  }
}

async function buildMatchCandidatoResponse(vaga, email) {
  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        code: "INDISPONIVEL",
        error: "Compatibilidade por IA indisponível no momento.",
      },
    };
  }

  const conta = await db.collection("contas").findOne(
    { email: email },
    { projection: { email: 1, nome: 1, curriculoPerfil: 1 } }
  );

  if (!conta) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, error: "Conta não encontrada." },
    };
  }

  const temCurriculo = !!(conta.curriculoPerfil && conta.curriculoPerfil.nome);
  if (!temCurriculo) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        temCurriculo: false,
        message:
          "Complete seu currículo para ver sua compatibilidade com esta vaga.",
      },
    };
  }

  try {
    const scored = await getCandidatoScoreCached(vaga, conta);
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        temCurriculo: true,
        score: scored.score,
        motivo: scored.motivo,
        modelo: scored.modelo,
        vaga: {
          _id: vaga._id,
          titulo: vaga.tituloPublicado || vaga.titulo,
        },
      },
    };
  } catch (error) {
    console.error("match candidato vaga:", error);
    if (error.code === "SEM_CURRICULO") {
      return {
        ok: true,
        status: 200,
        body: {
          ok: true,
          temCurriculo: false,
          message:
            "Complete seu currículo para ver sua compatibilidade com esta vaga.",
        },
      };
    }
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error: error.message || "Não foi possível calcular a compatibilidade.",
      },
    };
  }
}

async function contarInscricoesPorIds(colecao, campoId, ids) {
  const mapa = new Map();
  if (!ids.length) return mapa;

  const rows = await db.collection(colecao).aggregate([
    { $match: { [campoId]: { $in: ids } } },
    { $group: { _id: "$" + campoId, total: { $sum: 1 } } },
  ]).toArray();

  rows.forEach(function (row) {
    mapa.set(String(row._id), row.total);
  });
  return mapa;
}

function parseDataNascimentoInput(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const parts = s.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(parts[0]) ||
    date.getMonth() !== Number(parts[1]) - 1 ||
    date.getDate() !== Number(parts[2])
  ) {
    return null;
  }
  return date;
}

function calcularIdade(dataNascimento, refDate = new Date()) {
  const born = dataNascimento instanceof Date ? dataNascimento : parseDataNascimentoInput(dataNascimento);
  if (!born) return null;
  const hoje = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const nasc = new Date(born.getFullYear(), born.getMonth(), born.getDate());
  if (nasc.getTime() > hoje.getTime()) return null;
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
    idade -= 1;
  }
  return idade;
}

function validateIdadeMinima50(dataNascimento) {
  const idade = calcularIdade(dataNascimento);
  if (idade === null) {
    return { ok: false, error: "Informe uma data de nascimento válida." };
  }
  if (idade < 50) {
    return {
      ok: false,
      error: "O cadastro é exclusivo para pessoas com 50 anos ou mais.",
    };
  }
  return { ok: true, idade };
}

const COMUNIDADE_INTENCOES = ["amizade", "namoro", "ambos"];
const COMUNIDADE_GENEROS = [
  "cisgenero",
  "transgenero",
  "nao_binario",
  "prefiro_nao_dizer",
];
const COMUNIDADE_ESTADO_CIVIL = [
  "",
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "outro",
];
const COMUNIDADE_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const COMUNIDADE_INTERESSES = [
  "caminhada",
  "danca",
  "cinema",
  "viagens",
  "netos",
  "cafe",
  "livros",
  "musica",
  "jardinagem",
  "teatro",
  "yoga",
  "culinaria",
  "fotografia",
  "trilha",
  "feiras",
  "esportes",
];

function sanitizeComunidadePerfilOutput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const interesses = Array.isArray(raw.interesses)
    ? raw.interesses.filter((item) => COMUNIDADE_INTERESSES.includes(item))
    : [];
  const cidade =
    sanitizeCurriculoText(raw.cidade, 80) ||
    sanitizeCurriculoText(raw.cidadeBairro, 80) ||
    "";
  return {
    nomeExibicao: sanitizeCurriculoText(raw.nomeExibicao, 40) || "",
    idade: Number.isFinite(Number(raw.idade)) ? Number(raw.idade) : null,
    cidade,
    bairro: sanitizeCurriculoText(raw.bairro, 80) || "",
    estado: COMUNIDADE_UFS.includes(raw.estado) ? raw.estado : "",
    intencao: COMUNIDADE_INTENCOES.includes(raw.intencao) ? raw.intencao : "",
    bio: sanitizeCurriculoText(raw.bio, 280) || "",
    interesses,
    interesseOutro: sanitizeCurriculoText(raw.interesseOutro, 60) || "",
    genero: COMUNIDADE_GENEROS.includes(raw.genero) ? raw.genero : "",
    estadoCivil: COMUNIDADE_ESTADO_CIVIL.includes(raw.estadoCivil || "")
      ? raw.estadoCivil || ""
      : "",
  };
}

function validateComunidadePerfilInput(body, idadeConta) {
  const nomeExibicao = sanitizeCurriculoText(body.nomeExibicao, 40);
  if (!nomeExibicao || nomeExibicao.length < 2) {
    return {
      ok: false,
      error:
        "Informe o nome (primeiro nome ou apelido) com pelo menos 2 caracteres.",
    };
  }

  const idade = Number(idadeConta);
  if (
    !Number.isFinite(idade) ||
    !Number.isInteger(idade) ||
    idade < 50 ||
    idade > 120
  ) {
    return {
      ok: false,
      error:
        "Não foi possível confirmar a idade pelo cadastro. Verifique a data de nascimento.",
    };
  }

  const cidade = sanitizeCurriculoText(body.cidade, 80);
  if (!cidade || cidade.length < 2) {
    return { ok: false, error: "Informe a cidade." };
  }

  const bairro = sanitizeCurriculoText(body.bairro, 80);
  if (bairro && bairro.length < 2) {
    return {
      ok: false,
      error: "Se informar o bairro, use pelo menos 2 caracteres.",
    };
  }

  const estado = String(body.estado || "")
    .trim()
    .toUpperCase();
  if (!COMUNIDADE_UFS.includes(estado)) {
    return { ok: false, error: "Selecione o estado." };
  }

  const intencao = String(body.intencao || "").trim();
  if (!COMUNIDADE_INTENCOES.includes(intencao)) {
    return {
      ok: false,
      error: "Escolha a intenção: Amizade, Namoro ou Amizade e namoro.",
    };
  }

  const bio = sanitizeCurriculoText(body.bio, 280);
  if (!bio || bio.length < 10) {
    return {
      ok: false,
      error: "Escreva uma bio curta (pelo menos 10 caracteres).",
    };
  }

  const interessesRaw = Array.isArray(body.interesses) ? body.interesses : [];
  const interesses = [];
  interessesRaw.forEach((item) => {
    const id = String(item || "").trim();
    if (COMUNIDADE_INTERESSES.includes(id) && !interesses.includes(id)) {
      interesses.push(id);
    }
  });
  const interesseOutro = sanitizeCurriculoText(body.interesseOutro, 60) || "";
  const totalInteresses = interesses.length + (interesseOutro ? 1 : 0);
  if (totalInteresses < 3 || totalInteresses > 8) {
    return { ok: false, error: "Selecione entre 3 e 8 interesses." };
  }

  const genero = String(body.genero || "").trim();
  if (!COMUNIDADE_GENEROS.includes(genero)) {
    return { ok: false, error: "Selecione o seu gênero." };
  }

  let estadoCivil = String(body.estadoCivil || "").trim();
  if (!COMUNIDADE_ESTADO_CIVIL.includes(estadoCivil)) {
    estadoCivil = "";
  }

  return {
    ok: true,
    perfil: {
      nomeExibicao,
      idade,
      cidade,
      bairro,
      estado,
      intencao,
      bio,
      interesses,
      interesseOutro,
      genero,
      estadoCivil,
    },
  };
}

function resumirTexto(texto, max) {
  const s = String(texto || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + "…";
}

async function getParceiroDestaqueInfo(email, fallbackEmpresa) {
  const empresa = String(fallbackEmpresa || "").trim();
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!isValidEmail(emailNorm)) {
    return { empresa, logoUrl: null };
  }

  const doc = await db.collection("parceiros").findOne(
    { email: emailNorm },
    { projection: { logoDataUrl: 1, empresa: 1 } }
  );

  return {
    empresa: (doc && doc.empresa) || empresa,
    logoUrl: (doc && doc.logoDataUrl) || null,
  };
}

function buildDestaqueAuthLink(destino) {
  return "entrar_50.html?destino=" + encodeURIComponent(destino);
}

function mapDestaqueVaga(vaga, parceiroInfo) {
  const id = String(vaga._id);
  const destino = "emprego_50.html?id=" + id;
  return {
    id,
    pilar: "vaga",
    titulo: vaga.tituloPublicado || vaga.titulo,
    empresa: parceiroInfo.empresa || vaga.empresa,
    logoUrl: parceiroInfo.logoUrl || null,
    destino,
    link: buildDestaqueAuthLink(destino),
    promovidaEm: vaga.promovidaEm || null,
  };
}

const OFERTA_PAGE_BY_TIPO = {
  curso: "cursos_50.html",
  evento: "comunidade_50.html",
  bem_estar: "bem_estar_50.html",
};

function mapDestaqueOferta(oferta, parceiroInfo) {
  const valorInscricaoBrl = Number(oferta.valorInscricaoBrl);
  const id = String(oferta._id);
  const pagina = OFERTA_PAGE_BY_TIPO[oferta.tipo] || "cursos_50.html";
  const destino = pagina + "?id=" + id;
  return {
    id,
    pilar: oferta.tipo,
    titulo: oferta.titulo,
    empresa: parceiroInfo.empresa || oferta.parceiro,
    logoUrl: parceiroInfo.logoUrl || null,
    destino,
    link: buildDestaqueAuthLink(destino),
    valorInscricaoBrl: Number.isFinite(valorInscricaoBrl) ? valorInscricaoBrl : null,
    promovidaEm: oferta.promovidaEm || null,
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({
      ok: true,
      database: DB_NAME,
      smtp: isSmtpConfigured(),
      openrouter: isOpenRouterConfigured(),
      marketplaceComissaoPct: COMISSAO_PCT,
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: "Banco indisponível" });
  }
});

app.get("/api/contas/perfil", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("contas").findOne(
    { email },
    { projection: { nome: 1, email: 1, createdAt: 1 } }
  );

  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  res.json({
    ok: true,
    perfil: { nome: doc.nome, email: doc.email, createdAt: doc.createdAt },
  });
});

app.get("/api/contas/interesses", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;

  const doc = await db.collection("contas").findOne(
    { email },
    { projection: { areasInteresse: 1 } }
  );

  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  res.json({
    ok: true,
    areasInteresse: normalizeAreasInteresse(doc.areasInteresse),
    opcoes: AREAS_VAGA,
  });
});

app.get("/api/contas/meu-perfil", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;

  const doc = await db.collection("contas").findOne(
    { email },
    {
      projection: {
        nome: 1,
        email: 1,
        dataNascimento: 1,
        fotoPerfilDataUrl: 1,
        curriculoPerfil: 1,
        comunidadePerfil: 1,
      },
    }
  );

  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  const fotoPerfil = doc.fotoPerfilDataUrl || null;
  const fotoCurriculo =
    (doc.curriculoPerfil && doc.curriculoPerfil.fotoDataUrl) || null;
  const idadeConta = calcularIdade(doc.dataNascimento);
  const comunidade = sanitizeComunidadePerfilOutput(doc.comunidadePerfil);

  res.json({
    ok: true,
    perfil: {
      nome: doc.nome,
      email: doc.email,
      idadeConta,
      fotoPerfilDataUrl: fotoPerfil,
      fotoExibicao: fotoPerfil || fotoCurriculo,
      temFotoPerfil: !!fotoPerfil,
      comunidade,
    },
  });
});

app.patch("/api/contas/meu-perfil/foto", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const fotoCheck = validateLogoDataUrl(req.body.fotoDataUrl);

  if (!fotoCheck.ok) {
    res.status(400).json({ ok: false, error: fotoCheck.error });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  await db.collection("contas").updateOne(
    { _id: doc._id },
    {
      $set: {
        fotoPerfilDataUrl: fotoCheck.logoDataUrl,
        fotoPerfilUpdatedAt: new Date(),
      },
    }
  );

  res.json({
    ok: true,
    message: "Foto do perfil guardada com sucesso.",
    fotoPerfilDataUrl: fotoCheck.logoDataUrl,
  });
});

app.patch("/api/contas/meu-perfil/comunidade", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  if (!doc.fotoPerfilDataUrl) {
    res.status(400).json({
      ok: false,
      error: "Adicione uma foto com o rosto visível antes de guardar o perfil.",
    });
    return;
  }

  const idadeConta = calcularIdade(doc.dataNascimento);
  const check = validateComunidadePerfilInput(req.body || {}, idadeConta);

  if (!check.ok) {
    res.status(400).json({ ok: false, error: check.error });
    return;
  }

  const updatedAt = new Date();
  await db.collection("contas").updateOne(
    { _id: doc._id },
    {
      $set: {
        comunidadePerfil: Object.assign({}, check.perfil, { updatedAt }),
        comunidadePerfilUpdatedAt: updatedAt,
      },
    }
  );

  res.json({
    ok: true,
    message: "Perfil guardado com sucesso.",
    comunidade: check.perfil,
  });
});

// ===== Comunidades criadas por usuários (Fase 1) =====

const COMUNIDADE_TIPOS = ["interesse", "encontros"];
const COMUNIDADE_VISIBILIDADES = ["aberta", "convite"];
const CODIGO_CONVITE_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function gerarCodigoConvite() {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += CODIGO_CONVITE_ALFABETO[bytes[i] % CODIGO_CONVITE_ALFABETO.length];
  }
  return out;
}

function iniciaisDeNome(nome) {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "ME";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function validateComunidadeInput(body) {
  const titulo = String((body && body.titulo) || "").trim();
  const descricao = String((body && body.descricao) || "").trim();
  const tipo = String((body && body.tipo) || "").trim().toLowerCase();
  const cidade = String((body && body.cidade) || "").trim();
  let visibilidade = String((body && body.visibilidade) || "aberta").trim().toLowerCase();

  if (titulo.length < 3 || titulo.length > 80) {
    return { ok: false, error: "O nome da comunidade deve ter entre 3 e 80 caracteres." };
  }
  if (descricao.length > 400) {
    return { ok: false, error: "A descrição deve ter no máximo 400 caracteres." };
  }
  if (!COMUNIDADE_TIPOS.includes(tipo)) {
    return { ok: false, error: "Selecione o tipo da comunidade (interesse ou encontros)." };
  }
  if (cidade.length > 80) {
    return { ok: false, error: "A cidade deve ter no máximo 80 caracteres." };
  }
  if (!COMUNIDADE_VISIBILIDADES.includes(visibilidade)) {
    visibilidade = "aberta";
  }

  return { ok: true, value: { titulo, descricao, tipo, cidade, visibilidade } };
}

function sanitizeComunidadeOutput(doc, extra) {
  const info = extra || {};
  return {
    id: normalizeDocId(doc._id),
    titulo: doc.titulo || "",
    descricao: doc.descricao || "",
    tipo: doc.tipo || "interesse",
    cidade: doc.cidade || "",
    visibilidade: doc.visibilidade || "aberta",
    membros: typeof info.membros === "number" ? info.membros : 0,
    papel: info.papel || null,
  };
}

async function contagemMembrosPorComunidade(objectIds) {
  if (!objectIds.length) return {};
  const rows = await db
    .collection("comunidade_membros")
    .aggregate([
      { $match: { comunidadeId: { $in: objectIds } } },
      { $group: { _id: "$comunidadeId", total: { $sum: 1 } } },
    ])
    .toArray();
  const map = {};
  rows.forEach(function (row) {
    map[normalizeDocId(row._id)] = row.total;
  });
  return map;
}

async function carregarMembroComunidade(comunidadeObjectId, email) {
  return db
    .collection("comunidade_membros")
    .findOne({ comunidadeId: comunidadeObjectId, email });
}

async function aplicarConviteConta(email, codigoRaw) {
  const codigo = String(codigoRaw || "").trim().toUpperCase();
  if (!codigo) return null;
  const convite = await db.collection("comunidade_convites").findOne({ codigo });
  if (!convite) return null;

  const convidadoPor = convite.criadorEmail || null;
  await db.collection("contas").updateOne(
    { email, convidadoPor: { $exists: false } },
    { $set: { convidadoPor, convidadoEm: new Date(), conviteCodigo: codigo } }
  );

  try {
    await db.collection("comunidade_membros").insertOne({
      comunidadeId: convite.comunidadeId,
      email,
      papel: "membro",
      entrouEm: new Date(),
      convidadoPor,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  return { comunidadeId: normalizeDocId(convite.comunidadeId) };
}

app.post("/api/comunidades", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const check = validateComunidadeInput(req.body);
  if (!check.ok) {
    res.status(400).json({ ok: false, error: check.error });
    return;
  }

  const now = new Date();
  const doc = Object.assign({}, check.value, { criadorEmail: email, createdAt: now });
  const result = await db.collection("comunidades").insertOne(doc);
  await db.collection("comunidade_membros").insertOne({
    comunidadeId: result.insertedId,
    email,
    papel: "admin",
    entrouEm: now,
    convidadoPor: null,
  });

  res.status(201).json({
    ok: true,
    message: "Comunidade criada com sucesso.",
    comunidade: sanitizeComunidadeOutput(Object.assign({ _id: result.insertedId }, doc), {
      membros: 1,
      papel: "admin",
    }),
  });
});

app.get("/api/comunidades/minhas", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const membros = await db.collection("comunidade_membros").find({ email }).toArray();
  const ids = membros.map(function (m) {
    return m.comunidadeId;
  });
  const papeis = {};
  membros.forEach(function (m) {
    papeis[normalizeDocId(m.comunidadeId)] = m.papel;
  });

  const comunidades = ids.length
    ? await db
        .collection("comunidades")
        .find({ _id: { $in: ids } })
        .sort({ createdAt: -1 })
        .toArray()
    : [];
  const counts = await contagemMembrosPorComunidade(ids);

  res.json({
    ok: true,
    comunidades: comunidades.map(function (c) {
      const key = normalizeDocId(c._id);
      return sanitizeComunidadeOutput(c, {
        membros: counts[key] || 0,
        papel: papeis[key] || "membro",
      });
    }),
  });
});

app.get("/api/comunidades/descobrir", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const membros = await db
    .collection("comunidade_membros")
    .find({ email })
    .project({ comunidadeId: 1 })
    .toArray();
  const meusIds = membros.map(function (m) {
    return m.comunidadeId;
  });

  const filter = { visibilidade: "aberta" };
  if (meusIds.length) {
    filter._id = { $nin: meusIds };
  }
  const comunidades = await db
    .collection("comunidades")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(60)
    .toArray();
  const counts = await contagemMembrosPorComunidade(
    comunidades.map(function (c) {
      return c._id;
    })
  );

  res.json({
    ok: true,
    comunidades: comunidades.map(function (c) {
      return sanitizeComunidadeOutput(c, {
        membros: counts[normalizeDocId(c._id)] || 0,
        papel: null,
      });
    }),
  });
});

app.get("/api/comunidades/:id", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  const oid = new ObjectId(id);
  const comunidade = await db.collection("comunidades").findOne({ _id: oid });
  if (!comunidade) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }

  const membroDoc = await carregarMembroComunidade(oid, email);
  if (!membroDoc && comunidade.visibilidade !== "aberta") {
    res.status(403).json({ ok: false, error: "Esta comunidade é por convite." });
    return;
  }

  const membrosDocs = await db
    .collection("comunidade_membros")
    .find({ comunidadeId: oid })
    .sort({ entrouEm: 1 })
    .limit(200)
    .toArray();
  const emails = membrosDocs.map(function (m) {
    return m.email;
  });
  const contas = emails.length
    ? await db
        .collection("contas")
        .find({ email: { $in: emails } })
        .project({ email: 1, nome: 1, comunidadePerfil: 1 })
        .toArray()
    : [];
  const contaByEmail = {};
  contas.forEach(function (c) {
    contaByEmail[c.email] = c;
  });

  const membros = membrosDocs.map(function (m) {
    const conta = contaByEmail[m.email] || {};
    const perfil = conta.comunidadePerfil || {};
    const nome = perfil.nome || conta.nome || "Membro";
    const local = [perfil.cidade || comunidade.cidade || "", perfil.estado || ""]
      .filter(Boolean)
      .join(" · ");
    return {
      nome,
      iniciais: iniciaisDeNome(nome),
      cidade: local,
      papel: m.papel || "membro",
    };
  });

  res.json({
    ok: true,
    comunidade: sanitizeComunidadeOutput(comunidade, {
      membros: membros.length,
      papel: membroDoc ? membroDoc.papel : null,
    }),
    membros,
  });
});

app.post("/api/comunidades/:id/entrar", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  const oid = new ObjectId(id);
  const comunidade = await db.collection("comunidades").findOne({ _id: oid });
  if (!comunidade) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }

  const codigo = String(req.body.codigo || "").trim().toUpperCase();
  let convidadoPor = null;

  if (codigo) {
    const convite = await db.collection("comunidade_convites").findOne({ codigo });
    if (convite && normalizeDocId(convite.comunidadeId) === id) {
      convidadoPor = convite.criadorEmail || null;
    } else if (comunidade.visibilidade !== "aberta") {
      res.status(403).json({ ok: false, error: "Convite inválido para esta comunidade." });
      return;
    }
  } else if (comunidade.visibilidade !== "aberta") {
    res
      .status(403)
      .json({ ok: false, error: "Esta comunidade é por convite. Use um link de convite para entrar." });
    return;
  }

  try {
    await db.collection("comunidade_membros").insertOne({
      comunidadeId: oid,
      email,
      papel: "membro",
      entrouEm: new Date(),
      convidadoPor,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  res.json({ ok: true, message: "Você entrou na comunidade." });
});

app.post("/api/comunidades/:id/sair", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  const oid = new ObjectId(id);
  const membro = await carregarMembroComunidade(oid, email);
  if (!membro) {
    res.status(400).json({ ok: false, error: "Você não participa desta comunidade." });
    return;
  }
  if (membro.papel === "admin") {
    res.status(400).json({
      ok: false,
      error: "O criador não pode sair. Exclua a comunidade se desejar encerrá-la.",
    });
    return;
  }

  await db.collection("comunidade_membros").deleteOne({ comunidadeId: oid, email });
  res.json({ ok: true, message: "Você saiu da comunidade." });
});

app.delete("/api/comunidades/:id", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  const oid = new ObjectId(id);
  const comunidade = await db.collection("comunidades").findOne({ _id: oid });
  if (!comunidade) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  if (comunidade.criadorEmail !== email) {
    res.status(403).json({ ok: false, error: "Apenas o criador pode excluir a comunidade." });
    return;
  }

  await db.collection("comunidade_membros").deleteMany({ comunidadeId: oid });
  await db.collection("comunidade_convites").deleteMany({ comunidadeId: oid });
  await db.collection("comunidades").deleteOne({ _id: oid });
  res.json({ ok: true, message: "Comunidade excluída." });
});

app.post("/api/comunidades/:id/convite", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  const oid = new ObjectId(id);
  const comunidade = await db.collection("comunidades").findOne({ _id: oid });
  if (!comunidade) {
    res.status(404).json({ ok: false, error: "Comunidade não encontrada." });
    return;
  }
  const membro = await carregarMembroComunidade(oid, email);
  if (!membro) {
    res.status(403).json({ ok: false, error: "Apenas membros podem convidar." });
    return;
  }

  let convite = await db
    .collection("comunidade_convites")
    .findOne({ comunidadeId: oid, criadorEmail: email });

  if (!convite) {
    for (let tentativa = 0; tentativa < 6 && !convite; tentativa += 1) {
      const codigo = gerarCodigoConvite();
      try {
        const doc = {
          codigo,
          comunidadeId: oid,
          criadorEmail: email,
          createdAt: new Date(),
        };
        await db.collection("comunidade_convites").insertOne(doc);
        convite = doc;
      } catch (error) {
        if (error.code !== 11000) throw error;
        const existente = await db
          .collection("comunidade_convites")
          .findOne({ comunidadeId: oid, criadorEmail: email });
        if (existente) convite = existente;
      }
    }
  }

  if (!convite) {
    res.status(500).json({ ok: false, error: "Não foi possível gerar o convite. Tente novamente." });
    return;
  }

  res.json({
    ok: true,
    codigo: convite.codigo,
    comunidadeId: id,
    titulo: comunidade.titulo,
  });
});

app.get("/api/convites/:codigo", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim().toUpperCase();
  if (!codigo) {
    res.status(404).json({ ok: false, error: "Convite não encontrado." });
    return;
  }
  const convite = await db.collection("comunidade_convites").findOne({ codigo });
  if (!convite) {
    res.status(404).json({ ok: false, error: "Convite não encontrado." });
    return;
  }
  const comunidade = await db.collection("comunidades").findOne({ _id: convite.comunidadeId });
  if (!comunidade) {
    res.status(404).json({ ok: false, error: "Convite não encontrado." });
    return;
  }
  res.json({
    ok: true,
    convite: {
      codigo,
      comunidadeId: normalizeDocId(convite.comunidadeId),
      titulo: comunidade.titulo || "",
      tipo: comunidade.tipo || "interesse",
      descricao: comunidade.descricao || "",
      visibilidade: comunidade.visibilidade || "aberta",
    },
  });
});

// ---------------------------------------------------------------------------
// Lembretes de medicação (pilar Bem-estar) — canais gratuitos Telegram/e-mail.
// Dado sensível de saúde: só enviamos com opt-in explícito e canal válido.
// ---------------------------------------------------------------------------

function sanitizeMedicamentoOutput(doc) {
  return {
    id: normalizeDocId(doc._id),
    nome: doc.nome || "",
    dose: doc.dose || "",
    instrucoes: doc.instrucoes || "",
    horarios: Array.isArray(doc.horarios) ? doc.horarios : [],
    diasSemana: doc.diasSemana == null ? "todos" : doc.diasSemana,
    ativo: doc.ativo !== false,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

app.get("/api/contas/lembretes/preferencia", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const doc = await db.collection("contas").findOne(
    { email },
    { projection: { canalLembrete: 1, telegramChatId: 1, lembretesOptIn: 1, lembretesOptInEm: 1, email: 1 } }
  );
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }
  res.json({
    ok: true,
    preferencia: {
      canal: CANAIS_LEMBRETE.includes(doc.canalLembrete) ? doc.canalLembrete : null,
      optIn: !!doc.lembretesOptIn,
      optInEm: doc.lembretesOptInEm || null,
      telegramVinculado: !!doc.telegramChatId,
      email: doc.email,
      canaisDisponiveis: {
        telegram: isTelegramConfigured(),
        email: isSmtpConfigured(),
      },
    },
  });
});

app.patch("/api/contas/lembretes/preferencia", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const optIn = req.body.optIn === true;
  let canal = req.body.canal == null ? null : String(req.body.canal).trim().toLowerCase();
  if (canal === "") canal = null;

  if (canal !== null && !CANAIS_LEMBRETE.includes(canal)) {
    res.status(400).json({ ok: false, error: "Canal inválido. Use \"telegram\" ou \"email\"." });
    return;
  }

  if (optIn) {
    if (!canal) {
      res.status(400).json({ ok: false, error: "Escolha um canal (Telegram ou e-mail) para ativar os lembretes." });
      return;
    }
    const doc = await db.collection("contas").findOne({ email }, { projection: { telegramChatId: 1, email: 1 } });
    if (canal === "telegram" && (!doc || !doc.telegramChatId)) {
      res.status(400).json({
        ok: false,
        error: "Vincule seu Telegram antes de ativar lembretes por esse canal.",
      });
      return;
    }
    if (canal === "email" && !isSmtpConfigured()) {
      res.status(503).json({ ok: false, error: "Envio por e-mail indisponível no momento." });
      return;
    }
  }

  const set = { canalLembrete: canal, lembretesOptIn: optIn };
  if (optIn) {
    set.lembretesOptInEm = new Date();
  }
  await db.collection("contas").updateOne({ email }, { $set: set });

  res.json({
    ok: true,
    message: optIn ? "Lembretes ativados." : "Lembretes desativados.",
    preferencia: { canal, optIn },
  });
});

app.post("/api/contas/lembretes/telegram/codigo", requireContaSession, async (req, res) => {
  if (!isTelegramConfigured()) {
    res.status(503).json({ ok: false, error: "Canal Telegram indisponível no momento." });
    return;
  }
  const email = req.sessionUser.email;
  await db.collection("telegram_vinculos").deleteMany({ email });

  let salvo = null;
  for (let tentativa = 0; tentativa < 6 && !salvo; tentativa += 1) {
    const codigo = gerarCodigoConvite();
    try {
      const doc = {
        codigo,
        email,
        expiresAt: new Date(Date.now() + TELEGRAM_VINCULO_TTL_MS),
        createdAt: new Date(),
      };
      await db.collection("telegram_vinculos").insertOne(doc);
      salvo = doc;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  if (!salvo) {
    res.status(500).json({ ok: false, error: "Não foi possível gerar o código. Tente novamente." });
    return;
  }

  res.json({
    ok: true,
    codigo: salvo.codigo,
    link: telegramDeepLink(salvo.codigo),
    botUsername: telegramBotUsername(),
    expiresAt: salvo.expiresAt,
    instrucao: "Abra o link, toque em Iniciar/Start e sua conta será vinculada.",
  });
});

app.delete("/api/contas/lembretes/telegram", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  await db.collection("contas").updateOne(
    { email },
    { $unset: { telegramChatId: "", telegramVinculadoEm: "" } }
  );
  await db.collection("telegram_vinculos").deleteMany({ email });
  res.json({ ok: true, message: "Telegram desvinculado." });
});

app.get("/api/contas/medicamentos", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const docs = await db
    .collection("medicamentos")
    .find({ email })
    .sort({ createdAt: 1 })
    .toArray();
  res.json({ ok: true, medicamentos: docs.map(sanitizeMedicamentoOutput) });
});

app.post("/api/contas/medicamentos", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const check = MEDICACAO.validarMedicamento(req.body);
  if (!check.ok) {
    res.status(400).json({ ok: false, error: check.error });
    return;
  }
  const now = new Date();
  const doc = Object.assign({}, check.value, { email, createdAt: now, updatedAt: now });
  const result = await db.collection("medicamentos").insertOne(doc);
  res.status(201).json({
    ok: true,
    message: "Medicamento adicionado.",
    medicamento: sanitizeMedicamentoOutput(Object.assign({ _id: result.insertedId }, doc)),
  });
});

app.patch("/api/contas/medicamentos/:id", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Medicamento não encontrado." });
    return;
  }
  const oid = new ObjectId(id);
  const atual = await db.collection("medicamentos").findOne({ _id: oid, email });
  if (!atual) {
    res.status(404).json({ ok: false, error: "Medicamento não encontrado." });
    return;
  }

  // Atalho: alternar apenas o estado ativo (sem reenviar o cadastro inteiro).
  if (typeof req.body.ativo === "boolean" && req.body.nome === undefined && req.body.horarios === undefined) {
    await db.collection("medicamentos").updateOne(
      { _id: oid, email },
      { $set: { ativo: req.body.ativo, updatedAt: new Date() } }
    );
    const doc = await db.collection("medicamentos").findOne({ _id: oid, email });
    res.json({ ok: true, message: "Medicamento atualizado.", medicamento: sanitizeMedicamentoOutput(doc) });
    return;
  }

  const check = MEDICACAO.validarMedicamento(req.body);
  if (!check.ok) {
    res.status(400).json({ ok: false, error: check.error });
    return;
  }
  await db.collection("medicamentos").updateOne(
    { _id: oid, email },
    { $set: Object.assign({}, check.value, { updatedAt: new Date() }) }
  );
  const doc = await db.collection("medicamentos").findOne({ _id: oid, email });
  res.json({ ok: true, message: "Medicamento atualizado.", medicamento: sanitizeMedicamentoOutput(doc) });
});

app.delete("/api/contas/medicamentos/:id", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ ok: false, error: "Medicamento não encontrado." });
    return;
  }
  const result = await db.collection("medicamentos").deleteOne({ _id: new ObjectId(id), email });
  if (!result.deletedCount) {
    res.status(404).json({ ok: false, error: "Medicamento não encontrado." });
    return;
  }
  await db.collection("medicamento_envios").deleteMany({ medicamentoId: new ObjectId(id) });
  res.json({ ok: true, message: "Medicamento removido." });
});

app.patch("/api/contas/meu-perfil/senha", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const senhaAtual = String(req.body.senhaAtual || "");
  const senhaNova = String(req.body.senhaNova || "");

  const senhaCheck = validatePassword(senhaNova);
  if (!senhaCheck.ok) {
    res.status(400).json({ ok: false, error: senhaCheck.error });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  if (!doc.senhaHash) {
    res.status(400).json({ ok: false, error: "Conta sem senha definida." });
    return;
  }

  const valida = await verifyPassword(senhaAtual, doc.senhaHash);
  if (!valida) {
    res.status(400).json({ ok: false, error: "Senha atual incorreta." });
    return;
  }

  const senhaHash = await hashPassword(senhaNova);
  await db.collection("contas").updateOne(
    { _id: doc._id },
    {
      $set: {
        senhaHash,
        senhaUpdatedAt: new Date(),
      },
    }
  );

  res.json({ ok: true, message: "Senha alterada com sucesso." });
});

app.delete("/api/contas/meu-perfil", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const senhaAtual = String(req.body.senhaAtual || "");
  const confirmacao = String(req.body.confirmacao || "")
    .trim()
    .toUpperCase();

  if (confirmacao !== "CANCELAR") {
    res.status(400).json({
      ok: false,
      error: 'Para confirmar, digite a palavra CANCELAR no campo indicado.',
    });
    return;
  }

  if (!senhaAtual) {
    res.status(400).json({
      ok: false,
      error: "Informe a senha atual para cancelar a conta.",
    });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  if (!doc.senhaHash) {
    res.status(400).json({ ok: false, error: "Conta sem senha definida." });
    return;
  }

  const valida = await verifyPassword(senhaAtual, doc.senhaHash);
  if (!valida) {
    res.status(400).json({ ok: false, error: "Senha atual incorreta." });
    return;
  }

  await Promise.all([
    db.collection("inscricoes").deleteMany({ email }),
    db.collection("candidaturas").deleteMany({ email }),
    db.collection("match_candidato_cache").deleteMany({ email }),
    db.collection("sessoes").deleteMany({ email, tipo: "50" }),
    db.collection("contas").deleteOne({ _id: doc._id }),
  ]);

  res.json({
    ok: true,
    message: "Conta cancelada. Todos os seus dados foram excluídos.",
  });
});

app.patch("/api/contas/interesses", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const areasInteresse = normalizeAreasInteresse(req.body.areasInteresse);

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  const updatedAt = new Date();
  await db.collection("contas").updateOne(
    { _id: doc._id },
    {
      $set: {
        areasInteresse: areasInteresse,
        areasInteresseUpdatedAt: updatedAt,
      },
    }
  );

  res.json({
    ok: true,
    message:
      areasInteresse.length
        ? "Interesses guardados. As vagas serão filtradas pelas áreas selecionadas."
        : "Interesses guardados. Selecione ao menos uma área para ver vagas.",
    areasInteresse: areasInteresse,
    updatedAt: updatedAt,
  });
});

app.get("/api/contas/curriculo", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;

  const doc = await db.collection("contas").findOne(
    { email },
    {
      projection: {
        nome: 1,
        email: 1,
        telefone: 1,
        fotoPerfilDataUrl: 1,
        curriculoPerfil: 1,
        curriculoPerfilUpdatedAt: 1,
        curriculoDataUrl: 1,
        curriculoNomeArquivo: 1,
        curriculoUpdatedAt: 1,
      },
    }
  );

  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  const hasPerfil = !!(doc.curriculoPerfil && doc.curriculoPerfil.nome);

  res.json({
    ok: true,
    fotoPerfilDataUrl: doc.fotoPerfilDataUrl || null,
    curriculo: {
      hasPerfil,
      updatedAt: doc.curriculoPerfilUpdatedAt || doc.curriculoUpdatedAt || null,
      perfil: hasPerfil ? doc.curriculoPerfil : null,
      conta: {
        nome: doc.nome,
        email: doc.email,
        telefone: doc.telefone || null,
      },
      nomeArquivo: doc.curriculoNomeArquivo || null,
      dataUrl: doc.curriculoDataUrl || null,
    },
  });
});

app.patch("/api/contas/curriculo", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  if (req.body.perfil && typeof req.body.perfil === "object") {
    const perfilCheck = validateCurriculoPerfilInput(req.body.perfil);
    if (!perfilCheck.ok) {
      res.status(400).json({ ok: false, error: perfilCheck.error });
      return;
    }

    if (!perfilCheck.perfil.fotoDataUrl && doc.curriculoPerfil && doc.curriculoPerfil.fotoDataUrl) {
      perfilCheck.perfil.fotoDataUrl = doc.curriculoPerfil.fotoDataUrl;
    }
    perfilCheck.perfil.email = doc.email;

    const updatedAt = new Date();
    await db.collection("contas").updateOne(
      { _id: doc._id },
      {
        $set: {
          curriculoPerfil: perfilCheck.perfil,
          curriculoPerfilUpdatedAt: updatedAt,
        },
      }
    );

    res.json({
      ok: true,
      message: "Currículo guardado com sucesso.",
      curriculo: {
        hasPerfil: true,
        updatedAt,
        perfil: perfilCheck.perfil,
      },
    });
    return;
  }

  const curriculoCheck = validateCurriculoDataUrl(
    req.body.curriculoDataUrl,
    req.body.nomeArquivo
  );
  if (!curriculoCheck.ok) {
    res.status(400).json({ ok: false, error: curriculoCheck.error });
    return;
  }

  await db.collection("contas").updateOne(
    { _id: doc._id },
    {
      $set: {
        curriculoDataUrl: curriculoCheck.curriculoDataUrl,
        curriculoNomeArquivo: curriculoCheck.nomeArquivo,
        curriculoUpdatedAt: new Date(),
      },
    }
  );

  res.json({
    ok: true,
    message: "Currículo guardado com sucesso.",
    curriculo: {
      nomeArquivo: curriculoCheck.nomeArquivo,
      dataUrl: curriculoCheck.curriculoDataUrl,
    },
  });
});

app.post("/api/contas/curriculo/importar-linkedin", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const linkedinUrl = String(req.body.linkedinUrl || "").trim();

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  const imported = await importLinkedInProfile(linkedinUrl, {
    proxycurlApiKey: process.env.PROXYCURL_API_KEY || "",
  });

  if (!imported.ok) {
    res.status(400).json(imported);
    return;
  }

  const response = buildCurriculoImportResponse(doc, imported.perfil, {
    message: "Dados importados do LinkedIn. Revise os campos antes de salvar.",
    source: imported.source,
    imported: imported.imported,
  });

  if (!response.ok) {
    res.status(400).json(response);
    return;
  }

  res.json(response);
});

app.post("/api/contas/curriculo/importar-pdf", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const curriculoDataUrl = String(req.body.curriculoDataUrl || "").trim();

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Cadastro não encontrado." });
    return;
  }

  const imported = await importCurriculoPdfDataUrl(curriculoDataUrl);
  if (!imported.ok) {
    res.status(400).json(imported);
    return;
  }

  const response = buildCurriculoImportResponse(doc, imported.perfil, {
    message: "Dados importados do PDF. Revise os campos antes de salvar.",
    source: "pdf",
    imported: imported.imported,
  });

  if (!response.ok) {
    res.status(400).json(response);
    return;
  }

  res.json(response);
});

app.post("/api/contas/entrar", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("contas").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "E-mail ou senha incorretos." });
    return;
  }

  if (doc.senhaHash) {
    if (!senha) {
      res.status(400).json({ ok: false, error: "Informe sua senha." });
      return;
    }
    const valida = await verifyPassword(senha, doc.senhaHash);
    if (!valida) {
      res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." });
      return;
    }
  }

  try {
    await aplicarConviteConta(doc.email, req.body.codigoConvite);
  } catch (conviteError) {
    console.error("Convite login:", conviteError.message);
  }

  const session = await createSession(db, { email: doc.email, tipo: "50" });
  res.json({
    ok: true,
    token: session.token,
    perfil: { nome: doc.nome, email: doc.email, createdAt: doc.createdAt },
  });
});

app.post("/api/contas", async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const telefone = String(req.body.telefone || "").trim();
  const senha = String(req.body.senha || "");
  const dataNascimento = parseDataNascimentoInput(req.body.dataNascimento);

  if (nome.length < 2) {
    res.status(400).json({ ok: false, error: "Informe seu nome completo." });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const idadeCheck = validateIdadeMinima50(dataNascimento);
  if (!idadeCheck.ok) {
    res.status(400).json({ ok: false, error: idadeCheck.error });
    return;
  }

  const senhaCheck = validatePassword(senha);
  if (!senhaCheck.ok) {
    res.status(400).json({ ok: false, error: senhaCheck.error });
    return;
  }

  const consentimentoDados =
    req.body.consentimentoDados === true || req.body.consentimentoDados === "true";
  if (!consentimentoDados) {
    res.status(400).json({
      ok: false,
      error: "É necessário aceitar o uso dos seus dados para concluir o cadastro.",
    });
    return;
  }

  let senhaHash;
  try {
    senhaHash = await hashPassword(senha);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível processar a senha." });
    return;
  }

  const documento = {
    nome,
    email,
    telefone: telefone || null,
    dataNascimento,
    senhaHash,
    consentimentoDados: true,
    consentimentoDadosEm: new Date(),
    origem: "cadastro-piloto",
    createdAt: new Date(),
  };

  try {
    const result = await db.collection("contas").insertOne(documento);
    sendCadastroConfirmacao({ nome, email }).catch(function (err) {
      console.error("E-mail cadastro:", err.message);
    });
    try {
      await aplicarConviteConta(documento.email, req.body.codigoConvite);
    } catch (conviteError) {
      console.error("Convite cadastro:", conviteError.message);
    }
    const session = await createSession(db, { email: documento.email, tipo: "50" });
    res.status(201).json({
      ok: true,
      id: result.insertedId,
      token: session.token,
      perfil: { nome: documento.nome, email: documento.email, createdAt: documento.createdAt },
      message: "Cadastro realizado com sucesso.",
      emailEnviado: isSmtpConfigured(),
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ ok: false, error: "Este e-mail já está cadastrado." });
      return;
    }
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível concluir o cadastro." });
  }
});

app.get("/api/marketplace/ofertas", optionalContaSession, async (req, res) => {
  const tipo = String(req.query.tipo || "").trim().toLowerCase();
  const email = req.sessionUser ? req.sessionUser.email : "";
  const filter = { ativo: true };

  if (tipo) {
    if (!TIPOS_OFERTA.includes(tipo)) {
      res.status(400).json({ ok: false, error: "Tipo de oferta inválido." });
      return;
    }
    filter.tipo = tipo;
  }

  let inscritosIds = new Set();
  if (isValidEmail(email)) {
    const inscricoes = await db
      .collection("inscricoes")
      .find({ email })
      .project({ ofertaId: 1 })
      .toArray();
    inscritosIds = new Set(inscricoes.map(function (item) {
      return normalizeDocId(item.ofertaId);
    }).filter(Boolean));
  }

  const ofertas = await db
    .collection("ofertas")
    .find(filter)
    .sort({ valorInscricaoBrl: 1 })
    .toArray();

  res.json({
    ok: true,
    ofertas: ofertas.map(function (oferta) {
      return publicOfertaDoc(oferta, {
        inscrito: inscritosIds.has(normalizeDocId(oferta._id)),
      });
    }),
  });
});

app.post("/api/ofertas", requireParceiroSession, async (req, res) => {
  const tipo = String(req.body.tipo || "").trim().toLowerCase();
  const parceiro = String(req.body.parceiro || "").trim();
  const titulo = String(req.body.titulo || "").trim();
  const descricao = String(req.body.descricao || "").trim();
  const modalidade = String(req.body.modalidade || "").trim().toLowerCase();
  const local = String(req.body.local || "").trim();
  const referencia = String(req.body.referencia || "").trim();
  const dataTexto = String(req.body.dataTexto || "").trim();
  const hora = parseHoraInput(req.body.hora);
  const emailContatoParceiro = req.sessionUser.email;
  const nomeContatoParceiro = String(req.body.nomeContatoParceiro || "").trim();
  const valorInscricaoBrl = Number(req.body.valorInscricaoBrl);
  const vigencia = parseVigenciaInput(req.body);
  const dataInicio = vigencia.dataInicio;
  const dataFim = vigencia.dataFim;
  const dataPublicacaoCurso = parseDataPublicacaoInput(req.body.dataPublicacao);

  if (!TIPOS_OFERTA.includes(tipo)) {
    res.status(400).json({ ok: false, error: "Tipo de oferta inválido." });
    return;
  }
  if (parceiro.length < 2) {
    res.status(400).json({ ok: false, error: "Informe o nome da empresa ou organização." });
    return;
  }
  if (titulo.length < 3) {
    res.status(400).json({ ok: false, error: "Informe o título da oferta." });
    return;
  }
  if (descricao.length < 40) {
    res.status(400).json({ ok: false, error: "Descreva a oferta com pelo menos 40 caracteres." });
    return;
  }
  if (!Number.isFinite(valorInscricaoBrl) || valorInscricaoBrl < 0) {
    res.status(400).json({ ok: false, error: "Informe um valor de inscrição válido (0 para gratuito)." });
    return;
  }
  if (!MODALIDADES_VAGA.includes(modalidade)) {
    res.status(400).json({ ok: false, error: "Modalidade inválida." });
    return;
  }
  if (!isValidEmail(emailContatoParceiro)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail de contato válido." });
    return;
  }
  const vigenciaCheck = validateVigenciaPlataforma(dataInicio, dataFim);
  if (!vigenciaCheck.ok) {
    res.status(400).json(vigenciaCheck);
    return;
  }
  if (tipo === "curso") {
    if (!dataPublicacaoCurso) {
      res.status(400).json({ ok: false, error: "Informe a data de início do curso." });
      return;
    }
    if (!hora) {
      res.status(400).json({ ok: false, error: "Informe a hora de início do curso." });
      return;
    }
  }

  const documento = {
    tipo,
    titulo,
    parceiro,
    descricao,
    valorInscricaoBrl,
    modalidade,
    local: local || null,
    referencia: referencia || null,
    dataTexto: dataTexto || null,
    dataInicio,
    dataFim,
    dataPublicacao: tipo === "curso" ? dataPublicacaoCurso : dataFim,
    hora: tipo === "curso" ? hora : null,
    emailContatoParceiro,
    nomeContatoParceiro: nomeContatoParceiro || null,
    status: "pendente",
    ativo: false,
    createdAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    motivoRejeicao: null,
  };

  const result = await db.collection("ofertas").insertOne(documento);
  res.status(201).json({
    ok: true,
    id: result.insertedId,
    message: "Oferta recebida. Nossa equipe fará a curadoria em até 2 dias úteis.",
  });
});

app.get("/api/inscricoes", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const tipo = String(req.query.tipo || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }
  if (tipo && !TIPOS_OFERTA.includes(tipo)) {
    res.status(400).json({ ok: false, error: "Tipo de oferta inválido." });
    return;
  }

  const inscricoes = await db
    .collection("inscricoes")
    .find({ email })
    .sort({ createdAt: -1 })
    .project({
      ofertaId: 1,
      titulo: 1,
      parceiro: 1,
      valorInscricaoBrl: 1,
      status: 1,
      createdAt: 1,
      paidAt: 1,
    })
    .toArray();

  let resultado = inscricoes;
  if (tipo) {
    const porCampo = inscricoes.filter(function (item) {
      return item.tipo === tipo;
    });
    const legado = inscricoes.filter(function (item) {
      return !item.tipo;
    });
    let porOferta = [];
    if (legado.length) {
      const ofertaIds = legado
        .map(function (item) { return normalizeDocId(item.ofertaId); })
        .filter(function (id) { return id && ObjectId.isValid(id); });
      const objectIds = ofertaIds.map(function (id) { return new ObjectId(id); });
      if (objectIds.length) {
        const ofertasTipo = await db
          .collection("ofertas")
          .find({ _id: { $in: objectIds }, tipo })
          .project({ _id: 1 })
          .toArray();
        const idsTipo = new Set(ofertasTipo.map(function (oferta) {
          return normalizeDocId(oferta._id);
        }));
        porOferta = legado.filter(function (item) {
          return idsTipo.has(normalizeDocId(item.ofertaId));
        });
      }
    }
    const vistos = new Set();
    resultado = [];
    porCampo.concat(porOferta).forEach(function (item) {
      const chave = normalizeDocId(item._id);
      if (vistos.has(chave)) return;
      vistos.add(chave);
      resultado.push(item);
    });
  }

  const ofertaIdsEnriquecer = resultado
    .map(function (item) { return item.ofertaId; })
    .filter(Boolean);
  const ofertasMap = new Map();
  if (ofertaIdsEnriquecer.length) {
    const ofertas = await db
      .collection("ofertas")
      .find({ _id: { $in: ofertaIdsEnriquecer } })
      .toArray();
    ofertas.forEach(function (oferta) {
      ofertasMap.set(String(oferta._id), oferta);
    });
  }

  res.json({
    ok: true,
    inscricoes: resultado.map(function (inscricao) {
      const oferta = ofertasMap.get(String(inscricao.ofertaId));
      const base = oferta
        ? publicOfertaDoc(oferta)
        : {
            titulo: inscricao.titulo,
            parceiro: inscricao.parceiro,
            valorInscricaoBrl: inscricao.valorInscricaoBrl,
          };
      return Object.assign({}, base, {
        ofertaId: inscricao.ofertaId,
        tipo: inscricao.tipo || (oferta && oferta.tipo) || null,
        inscricaoStatus: inscricao.status,
        inscritoEm: inscricao.createdAt,
        paidAt: inscricao.paidAt,
      });
    }),
  });
});

app.post("/api/inscricoes", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const ofertaId = String(req.body.ofertaId || "").trim();

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  if (!ObjectId.isValid(ofertaId)) {
    res.status(400).json({ ok: false, error: "Oferta inválida." });
    return;
  }

  const conta = await db.collection("contas").findOne({ email });
  if (!conta) {
    res.status(404).json({ ok: false, error: "Faça seu cadastro antes de se inscrever." });
    return;
  }

  const oferta = await db.collection("ofertas").findOne({
    _id: new ObjectId(ofertaId),
    ativo: true,
  });

  if (!oferta) {
    res.status(404).json({ ok: false, error: "Oferta não encontrada." });
    return;
  }

  const documento = {
    ofertaId: oferta._id,
    tipo: oferta.tipo,
    titulo: oferta.titulo,
    parceiro: oferta.parceiro,
    email,
    nome: conta.nome,
    valorInscricaoBrl: oferta.valorInscricaoBrl,
    comissaoPct: COMISSAO_PCT,
    comissaoBrl: null,
    status: "pendente",
    createdAt: new Date(),
    paidAt: null,
  };

  try {
    const result = await db.collection("inscricoes").insertOne(documento);
    sendInscricaoConfirmacao({
      nome: conta.nome,
      email,
      titulo: oferta.titulo,
      valorBrl: oferta.valorInscricaoBrl,
      status: "pendente",
    }).catch(function (err) {
      console.error("E-mail inscrição:", err.message);
    });
    res.status(201).json({
      ok: true,
      id: result.insertedId,
      message: "Inscrição registrada. Aguarde instruções de pagamento.",
      valorInscricaoBrl: oferta.valorInscricaoBrl,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ ok: false, error: "Você já está inscrito nesta oferta." });
      return;
    }
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível registrar a inscrição." });
  }
});

app.get("/api/admin/inscricoes", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "pendente").trim();
  const filter = status === "todas" ? {} : { status };

  const inscricoes = await db
    .collection("inscricoes")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const totais = inscricoes.reduce(
    function (acc, item) {
      if (item.status === "paga") {
        acc.receitaParceiro += item.valorInscricaoBrl || 0;
        acc.comissaoPlataforma += item.comissaoBrl || 0;
      }
      return acc;
    },
    { receitaParceiro: 0, comissaoPlataforma: 0 }
  );

  res.json({
    ok: true,
    inscricoes,
    totais: {
      receitaParceiro: roundMoney(totais.receitaParceiro),
      comissaoPlataforma: roundMoney(totais.comissaoPlataforma),
    },
  });
});

app.patch("/api/admin/inscricoes/:id/pagar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Inscrição inválida." });
    return;
  }

  const inscricao = await db.collection("inscricoes").findOne({ _id: new ObjectId(id) });
  if (!inscricao) {
    res.status(404).json({ ok: false, error: "Inscrição não encontrada." });
    return;
  }

  if (inscricao.status === "paga") {
    res.status(409).json({ ok: false, error: "Inscrição já está paga." });
    return;
  }

  const comissaoBrl = roundMoney(inscricao.valorInscricaoBrl * (COMISSAO_PCT / 100));
  const paidAt = new Date();

  await db.collection("inscricoes").updateOne(
    { _id: inscricao._id },
    { $set: { status: "paga", comissaoBrl, paidAt } }
  );

  sendInscricaoConfirmacao({
    nome: inscricao.nome,
    email: inscricao.email,
    titulo: inscricao.titulo,
    valorBrl: inscricao.valorInscricaoBrl,
    status: "paga",
  }).catch(function (err) {
    console.error("E-mail pagamento:", err.message);
  });

  res.json({
    ok: true,
    message: "Pagamento registrado.",
    comissaoBrl,
    comissaoPct: COMISSAO_PCT,
  });
});

app.get("/api/admin/candidaturas", requireAdmin, async (req, res) => {
  const statusFiltro = String(req.query.status || "todas").trim().toLowerCase();
  const filter =
    statusFiltro !== "todas" && CANDIDATURA_STATUS.includes(statusFiltro)
      ? { status: statusFiltro }
      : {};

  const candidaturas = await db
    .collection("candidaturas")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const emails = [
    ...new Set(
      candidaturas
        .map(function (c) {
          return String(c.email || "").trim().toLowerCase();
        })
        .filter(Boolean)
    ),
  ];
  const telefonesByEmail = new Map();
  if (emails.length) {
    const contas = await db
      .collection("contas")
      .find({ email: { $in: emails } })
      .project({ email: 1, telefone: 1 })
      .toArray();
    contas.forEach(function (conta) {
      telefonesByEmail.set(conta.email, conta.telefone || null);
    });
  }

  const lista = candidaturas.map(function (c) {
    const email = String(c.email || "").trim().toLowerCase();
    // Para contratadas, garante sempre o valor da taxa (1 SM), mesmo em
    // registos anteriores à cobrança (cobranca "virtual" pendente).
    let cobranca = c.cobranca || null;
    if (c.status === "contratada" && !cobranca) {
      cobranca = { tipo: "taxa_contratacao", valorBrl: CONTRATACAO_TAXA_BRL, status: "pendente" };
    }
    return {
      _id: c._id,
      nome: c.nome || "—",
      email: email || "—",
      telefone: telefonesByEmail.get(email) || null,
      titulo: c.titulo || "—",
      empresa: c.empresa || "—",
      status: c.status || "enviada",
      candidatouEm: c.createdAt || null,
      contratadoEm: c.contratadoEm || null,
      cobranca: cobranca,
    };
  });

  const contratadas = await db
    .collection("candidaturas")
    .find({ status: "contratada" })
    .project({ cobranca: 1 })
    .toArray();
  const receita = contratadas.reduce(
    function (acc, c) {
      const cob = c.cobranca || {};
      const valor = Number.isFinite(Number(cob.valorBrl)) && cob.valorBrl != null
        ? Number(cob.valorBrl)
        : CONTRATACAO_TAXA_BRL;
      if (cob.status === "paga") acc.recebida += valor;
      else acc.pendente += valor;
      return acc;
    },
    { recebida: 0, pendente: 0 }
  );

  res.json({
    ok: true,
    candidaturas: lista,
    totais: {
      contratacoes: contratadas.length,
      listadas: lista.length,
      receitaRecebidaBrl: roundMoney(receita.recebida),
      receitaPendenteBrl: roundMoney(receita.pendente),
    },
  });
});

app.patch("/api/admin/candidaturas/:id/status", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  const status = String(req.body.status || "").trim().toLowerCase();

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Candidatura inválida." });
    return;
  }
  if (!CANDIDATURA_STATUS.includes(status)) {
    res.status(400).json({ ok: false, error: "Estado de candidatura inválido." });
    return;
  }

  const candidatura = await db.collection("candidaturas").findOne({ _id: new ObjectId(id) });
  if (!candidatura) {
    res.status(404).json({ ok: false, error: "Candidatura não encontrada." });
    return;
  }

  const change = buildCandidaturaStatusChange(candidatura, status);
  if (!change.ok) {
    res.status(409).json({ ok: false, error: change.error });
    return;
  }

  await db.collection("candidaturas").updateOne(
    { _id: candidatura._id },
    { $set: change.update }
  );

  res.json({
    ok: true,
    status,
    cobranca: change.update.cobranca || null,
    message: "Estado da candidatura atualizado.",
  });
});

app.patch("/api/admin/candidaturas/:id/cobranca/pagar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Candidatura inválida." });
    return;
  }

  const candidatura = await db.collection("candidaturas").findOne({ _id: new ObjectId(id) });
  if (!candidatura) {
    res.status(404).json({ ok: false, error: "Candidatura não encontrada." });
    return;
  }
  if (candidatura.status !== "contratada") {
    res.status(409).json({ ok: false, error: "Só há cobrança para candidaturas contratadas." });
    return;
  }
  if (candidatura.cobranca && candidatura.cobranca.status === "paga") {
    res.status(409).json({ ok: false, error: "Cobrança já está paga." });
    return;
  }

  // Cria a cobrança caso a contratação seja anterior à introdução da taxa.
  const base = candidatura.cobranca || {
    tipo: "taxa_contratacao",
    valorBrl: CONTRATACAO_TAXA_BRL,
    criadoEm: new Date(),
  };
  const cobranca = Object.assign({}, base, { status: "paga", paidAt: new Date() });

  await db.collection("candidaturas").updateOne(
    { _id: candidatura._id },
    { $set: { cobranca } }
  );

  res.json({ ok: true, message: "Pagamento da contratação registrado.", cobranca });
});

app.post("/api/vagas", requireParceiroSession, async (req, res) => {
  const empresa = String(req.body.empresa || "").trim();
  const titulo = String(req.body.titulo || "").trim();
  const descricao = String(req.body.descricao || "").trim();
  const requisitosEssenciais = String(req.body.requisitosEssenciais || "").trim();
  const requisitosDesejaveis = String(req.body.requisitosDesejaveis || "").trim();
  const oQueEmpresaOferece = String(req.body.oQueEmpresaOferece || "").trim();
  const regime = String(req.body.regime || "").trim().toLowerCase();
  const modalidade = String(req.body.modalidade || "").trim().toLowerCase();
  const local = String(req.body.local || "").trim();
  const salarioTexto = String(req.body.salarioTexto || "").trim();
  const linkCandidatura = String(req.body.linkCandidatura || "").trim();
  const emailContatoParceiro = req.sessionUser.email;
  const nomeContatoParceiro = String(req.body.nomeContatoParceiro || "").trim();
  const areaTrabalho = String(req.body.areaTrabalho || "").trim();
  const vigencia = parseVigenciaInput(req.body);
  const dataInicio = vigencia.dataInicio;
  const dataFim = vigencia.dataFim;

  if (empresa.length < 2) {
    res.status(400).json({ ok: false, error: "Informe o nome da empresa." });
    return;
  }
  if (titulo.length < 3) {
    res.status(400).json({ ok: false, error: "Informe o título da vaga." });
    return;
  }
  if (descricao.length < 80) {
    res.status(400).json({ ok: false, error: "Descreva a vaga com pelo menos 80 caracteres." });
    return;
  }
  if (requisitosEssenciais.length < 10) {
    res.status(400).json({ ok: false, error: "Informe os requisitos essenciais." });
    return;
  }
  if (!REGIMES_VAGA.includes(regime)) {
    res.status(400).json({ ok: false, error: "Regime de contratação inválido." });
    return;
  }
  if (!MODALIDADES_VAGA.includes(modalidade)) {
    res.status(400).json({ ok: false, error: "Modalidade inválida." });
    return;
  }
  if (local.length < 2) {
    res.status(400).json({ ok: false, error: "Informe a localização." });
    return;
  }
  if (salarioTexto.length < 2) {
    res.status(400).json({ ok: false, error: "Informe a faixa salarial ou 'A combinar'." });
    return;
  }
  if (!isValidEmail(emailContatoParceiro)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail de contato válido." });
    return;
  }
  if (!isAreaVagaValida(areaTrabalho)) {
    res.status(400).json({ ok: false, error: "Selecione a área de trabalho da vaga." });
    return;
  }
  const vigenciaCheck = validateVigenciaPlataforma(dataInicio, dataFim);
  if (!vigenciaCheck.ok) {
    res.status(400).json(vigenciaCheck);
    return;
  }

  const flagsCuradoria = detectFlagsCuradoria([
    titulo,
    descricao,
    requisitosEssenciais,
    requisitosDesejaveis,
    oQueEmpresaOferece,
  ]);

  const documento = {
    empresa,
    titulo,
    descricao,
    areaTrabalho,
    requisitosEssenciais,
    requisitosDesejaveis: requisitosDesejaveis || null,
    oQueEmpresaOferece: oQueEmpresaOferece || null,
    regime,
    modalidade,
    local,
    salarioTexto,
    linkCandidatura: linkCandidatura || null,
    emailContatoParceiro,
    nomeContatoParceiro: nomeContatoParceiro || null,
    dataInicio,
    dataFim,
    dataPublicacao: dataFim,
    status: "pendente",
    flagsCuradoria,
    tituloPublicado: null,
    descricaoPublicada: null,
    notaCuradoria: null,
    motivoRejeicao: null,
    createdAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
  };

  const result = await db.collection("vagas").insertOne(documento);
  res.status(201).json({
    ok: true,
    id: result.insertedId,
    message: "Vaga recebida. Nossa equipe fará a curadoria em até 2 dias úteis.",
    flagsCuradoria,
  });
});

app.get("/api/vagas", optionalContaSession, async (req, res) => {
  const email = req.sessionUser ? req.sessionUser.email : "";
  let candidatouIds = new Set();
  let areasInteresse = [];
  let semAreasInteresse = false;

  if (isValidEmail(email)) {
    const [candidaturas, conta] = await Promise.all([
      db
        .collection("candidaturas")
        .find({ email })
        .project({ vagaId: 1 })
        .toArray(),
      db.collection("contas").findOne(
        { email },
        { projection: { areasInteresse: 1 } }
      ),
    ]);
    candidatouIds = new Set(
      candidaturas
        .map(function (item) {
          return normalizeDocId(item.vagaId);
        })
        .filter(Boolean)
    );
    areasInteresse = normalizeAreasInteresse(conta && conta.areasInteresse);
    semAreasInteresse = areasInteresse.length === 0;
  }

  const vagas = await db
    .collection("vagas")
    .find({ status: "activa" })
    .sort({ approvedAt: -1, createdAt: -1 })
    .limit(50)
    .toArray();

  let vagasVisiveis = vagas;
  if (isValidEmail(email)) {
    if (semAreasInteresse) {
      vagasVisiveis = [];
    } else {
      vagasVisiveis = vagas.filter(function (vaga) {
        return vaga.areaTrabalho && areasInteresse.includes(vaga.areaTrabalho);
      });
    }
  }

  res.json({
    ok: true,
    areasInteresse: areasInteresse,
    semAreasInteresse: semAreasInteresse,
    opcoes: AREAS_VAGA,
    vagas: vagasVisiveis.map(function (vaga) {
      return Object.assign(publicVagaDoc(vaga), {
        candidatou: candidatouIds.has(normalizeDocId(vaga._id)),
      });
    }),
  });
});

app.get("/api/vagas/:id/match", requireContaSession, async (req, res) => {
  const id = String(req.params.id || "");
  const email = req.sessionUser.email;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const vaga = await db.collection("vagas").findOne({
    _id: new ObjectId(id),
    status: "activa",
  });

  if (!vaga) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." });
    return;
  }

  const result = await buildMatchCandidatoResponse(vaga, email);
  res.status(result.status).json(result.body);
});

app.get("/api/admin/resumo", requireAdmin, async (req, res) => {
  const [vagas, ofertas, parceiros, inscricoes, contratacoes] = await Promise.all([
    db.collection("vagas").countDocuments({ status: "pendente" }),
    db.collection("ofertas").countDocuments({ status: "pendente" }),
    db.collection("parceiros").countDocuments({ status: "pendente" }),
    db.collection("inscricoes").countDocuments({ status: "pendente" }),
    db.collection("candidaturas").countDocuments({ status: "contratada" }),
  ]);
  res.json({
    ok: true,
    resumo: { vagas, ofertas, parceiros, inscricoes, contratacoes },
  });
});

app.get("/api/admin/vagas", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "pendente").trim();
  const filter = status === "todas" ? {} : { status };

  const vagas = await db
    .collection("vagas")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  res.json({ ok: true, vagas });
});

app.patch("/api/admin/vagas/:id/aprovar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }

  const vaga = await db.collection("vagas").findOne({ _id: new ObjectId(id) });
  if (!vaga) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." });
    return;
  }
  if (vaga.status === "activa") {
    res.status(409).json({ ok: false, error: "Vaga já está activa." });
    return;
  }

  const tituloPublicado = String(req.body.tituloPublicado || vaga.titulo).trim();
  const descricaoPublicada = String(req.body.descricaoPublicada || vaga.descricao).trim();
  const notaCuradoria = String(req.body.notaCuradoria || "").trim() || null;

  await db.collection("vagas").updateOne(
    { _id: vaga._id },
    {
      $set: {
        status: "activa",
        tituloPublicado,
        descricaoPublicada,
        notaCuradoria,
        approvedAt: new Date(),
      },
    }
  );

  res.json({ ok: true, message: "Vaga aprovada e publicada." });
});

app.patch("/api/admin/vagas/:id/rejeitar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }

  const vaga = await db.collection("vagas").findOne({ _id: new ObjectId(id) });
  if (!vaga) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." });
    return;
  }

  const motivoRejeicao = String(req.body.motivoRejeicao || "").trim() || null;
  const notaCuradoria = String(req.body.notaCuradoria || "").trim() || null;

  await db.collection("vagas").updateOne(
    { _id: vaga._id },
    {
      $set: {
        status: "rejeitada",
        motivoRejeicao,
        notaCuradoria,
        rejectedAt: new Date(),
      },
    }
  );

  res.json({ ok: true, message: "Vaga rejeitada." });
});

app.patch("/api/admin/vagas/:id/arquivar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }

  const result = await db.collection("vagas").updateOne(
    { _id: new ObjectId(id), status: "activa" },
    { $set: { status: "arquivada", promovida: false, promovidaEm: null } }
  );

  if (result.matchedCount === 0) {
    res.status(404).json({ ok: false, error: "Vaga activa não encontrada." });
    return;
  }

  res.json({ ok: true, message: "Vaga arquivada." });
});

app.patch("/api/admin/vagas/:id/promover", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  const promover = req.body.promover !== false;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }

  const vaga = await db.collection("vagas").findOne({ _id: new ObjectId(id) });
  if (!vaga) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." });
    return;
  }
  if (vaga.status !== "activa") {
    res.status(400).json({ ok: false, error: "Só é possível promover vagas já aprovadas." });
    return;
  }

  if (!promover) {
    await db.collection("vagas").updateOne(
      { _id: vaga._id },
      { $set: { promovida: false, promovidaEm: null } }
    );
    res.json({ ok: true, message: "Destaque removido da página inicial." });
    return;
  }

  await db.collection("vagas").updateMany(
    { status: "activa", promovida: true },
    { $set: { promovida: false, promovidaEm: null } }
  );
  await db.collection("vagas").updateOne(
    { _id: vaga._id },
    { $set: { promovida: true, promovidaEm: new Date() } }
  );

  res.json({
    ok: true,
    message: "Vaga promovida na página inicial (substitui o destaque anterior de vagas).",
  });
});

app.get("/api/admin/vagas/:id/alinhamento", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  const escopoRaw = String(req.query.escopo || "plataforma").trim().toLowerCase();
  const escopo = escopoRaw === "candidatos" ? "candidatos" : "plataforma";
  const limit = Number(req.query.limit) || 10;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }

  const vaga = await db.collection("vagas").findOne({ _id: new ObjectId(id) });
  if (!vaga) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." });
    return;
  }

  const result = await buildAlinhamentoVagaResponse(vaga, { escopo: escopo, limit: limit });
  res.status(result.status).json(result.body);
});

app.get("/api/admin/ofertas", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "pendente").trim();
  const tipo = String(req.query.tipo || "").trim().toLowerCase();
  const filter = status === "todas" ? {} : { status };

  if (tipo) {
    if (!TIPOS_OFERTA.includes(tipo)) {
      res.status(400).json({ ok: false, error: "Tipo de oferta inválido." });
      return;
    }
    filter.tipo = tipo;
  }

  const ofertas = await db
    .collection("ofertas")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  res.json({ ok: true, ofertas });
});

async function listDestaquesHome(_req, res) {
  const [vaga, curso, evento, bemEstar] = await Promise.all([
    db.collection("vagas").findOne({ status: "activa", promovida: true }),
    db.collection("ofertas").findOne({ status: "activa", ativo: true, tipo: "curso", promovida: true }),
    db.collection("ofertas").findOne({ status: "activa", ativo: true, tipo: "evento", promovida: true }),
    db.collection("ofertas").findOne({ status: "activa", ativo: true, tipo: "bem_estar", promovida: true }),
  ]);

  const slots = [
    vaga ? { doc: vaga, kind: "vaga" } : null,
    curso ? { doc: curso, kind: "oferta" } : null,
    evento ? { doc: evento, kind: "oferta" } : null,
    bemEstar ? { doc: bemEstar, kind: "oferta" } : null,
  ].filter(Boolean);

  const destaques = await Promise.all(
    slots.map(async function (slot) {
      const fallback = slot.kind === "vaga" ? slot.doc.empresa : slot.doc.parceiro;
      const parceiroInfo = await getParceiroDestaqueInfo(slot.doc.emailContatoParceiro, fallback);
      return slot.kind === "vaga"
        ? mapDestaqueVaga(slot.doc, parceiroInfo)
        : mapDestaqueOferta(slot.doc, parceiroInfo);
    })
  );

  res.json({ ok: true, destaques });
}

app.get("/api/promocoes", listDestaquesHome);
app.get("/api/destaques", listDestaquesHome);

app.patch("/api/admin/ofertas/:id/aprovar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Publicação inválida." });
    return;
  }

  const oferta = await db.collection("ofertas").findOne({ _id: new ObjectId(id) });
  if (!oferta) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }
  if (oferta.status === "activa" && oferta.ativo) {
    res.status(409).json({ ok: false, error: "Publicação já está activa." });
    return;
  }

  const titulo = String(req.body.titulo || oferta.titulo).trim();
  const descricao = String(req.body.descricao || oferta.descricao).trim();
  const notaCuradoria = String(req.body.notaCuradoria || "").trim() || null;

  if (titulo.length < 3) {
    res.status(400).json({ ok: false, error: "Informe um título válido." });
    return;
  }
  if (descricao.length < 40) {
    res.status(400).json({ ok: false, error: "Informe uma descrição com pelo menos 40 caracteres." });
    return;
  }

  await db.collection("ofertas").updateOne(
    { _id: oferta._id },
    {
      $set: {
        titulo,
        descricao,
        status: "activa",
        ativo: true,
        notaCuradoria,
        approvedAt: new Date(),
        rejectedAt: null,
        motivoRejeicao: null,
      },
    }
  );

  res.json({ ok: true, message: "Publicação aprovada e activa no marketplace." });
});

app.patch("/api/admin/ofertas/:id/rejeitar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Publicação inválida." });
    return;
  }

  const oferta = await db.collection("ofertas").findOne({ _id: new ObjectId(id) });
  if (!oferta) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }

  const motivoRejeicao = String(req.body.motivoRejeicao || "").trim() || null;
  const notaCuradoria = String(req.body.notaCuradoria || "").trim() || null;

  await db.collection("ofertas").updateOne(
    { _id: oferta._id },
    {
      $set: {
        status: "rejeitada",
        ativo: false,
        motivoRejeicao,
        notaCuradoria,
        rejectedAt: new Date(),
      },
    }
  );

  res.json({ ok: true, message: "Publicação rejeitada." });
});

app.patch("/api/admin/ofertas/:id/arquivar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Publicação inválida." });
    return;
  }

  const result = await db.collection("ofertas").updateOne(
    { _id: new ObjectId(id), status: "activa" },
    { $set: { status: "arquivada", ativo: false, promovida: false, promovidaEm: null } }
  );

  if (result.matchedCount === 0) {
    res.status(404).json({ ok: false, error: "Publicação activa não encontrada." });
    return;
  }

  res.json({ ok: true, message: "Publicação arquivada." });
});

app.patch("/api/admin/ofertas/:id/promover", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  const promover = req.body.promover !== false;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Publicação inválida." });
    return;
  }

  const oferta = await db.collection("ofertas").findOne({ _id: new ObjectId(id) });
  if (!oferta) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }
  if (oferta.status !== "activa" || !oferta.ativo) {
    res.status(400).json({ ok: false, error: "Só é possível promover publicações já aprovadas." });
    return;
  }
  if (!TIPOS_OFERTA.includes(oferta.tipo)) {
    res.status(400).json({ ok: false, error: "Tipo de publicação inválido." });
    return;
  }

  if (!promover) {
    await db.collection("ofertas").updateOne(
      { _id: oferta._id },
      { $set: { promovida: false, promovidaEm: null } }
    );
    res.json({ ok: true, message: "Destaque removido da página inicial." });
    return;
  }

  await db.collection("ofertas").updateMany(
    { status: "activa", tipo: oferta.tipo, promovida: true },
    { $set: { promovida: false, promovidaEm: null } }
  );
  await db.collection("ofertas").updateOne(
    { _id: oferta._id },
    { $set: { promovida: true, promovidaEm: new Date() } }
  );

  const pilarLabels = { curso: "cursos", evento: "comunidade", bem_estar: "bem-estar" };
  res.json({
    ok: true,
    message:
      "Publicação promovida na página inicial (substitui o destaque anterior de " +
      (pilarLabels[oferta.tipo] || oferta.tipo) +
      ").",
  });
});

app.post("/api/candidaturas", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  const vagaId = String(req.body.vagaId || "").trim();

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }
  if (!ObjectId.isValid(vagaId)) {
    res.status(400).json({ ok: false, error: "Vaga inválida." });
    return;
  }

  const conta = await db.collection("contas").findOne({ email });
  if (!conta) {
    res.status(404).json({ ok: false, error: "Faça seu cadastro antes de se candidatar." });
    return;
  }

  const vaga = await db.collection("vagas").findOne({
    _id: new ObjectId(vagaId),
    status: "activa",
  });

  if (!vaga) {
    res.status(404).json({ ok: false, error: "Vaga não encontrada." });
    return;
  }

  const areasInteresse = normalizeAreasInteresse(conta.areasInteresse);
  if (!areasInteresse.length) {
    res.status(400).json({
      ok: false,
      error: "Selecione suas áreas de interesse em «Publicações» antes de se candidatar.",
    });
    return;
  }
  if (!vaga.areaTrabalho || !areasInteresse.includes(vaga.areaTrabalho)) {
    res.status(403).json({
      ok: false,
      error: "Esta vaga não corresponde às suas áreas de interesse.",
    });
    return;
  }

  const documento = {
    vagaId: vaga._id,
    titulo: vaga.tituloPublicado || vaga.titulo,
    empresa: vaga.empresa,
    email,
    nome: conta.nome,
    status: "enviada",
    createdAt: new Date(),
  };

  try {
    const result = await db.collection("candidaturas").insertOne(documento);
    res.status(201).json({
      ok: true,
      id: result.insertedId,
      message: "Candidatura registrada. A empresa entrará em contato se houver fit.",
      linkCandidatura: vaga.linkCandidatura || null,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ ok: false, error: "Você já se candidatou a esta vaga." });
      return;
    }
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível registrar a candidatura." });
  }
});

app.get("/api/candidaturas", requireContaSession, async (req, res) => {
  const email = req.sessionUser.email;
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const candidaturas = await db
    .collection("candidaturas")
    .find({ email })
    .sort({ createdAt: -1 })
    .project({ titulo: 1, empresa: 1, status: 1, createdAt: 1, vagaId: 1 })
    .toArray();

  const vagaIds = candidaturas
    .map(function (item) { return item.vagaId; })
    .filter(Boolean);
  const vagasMap = new Map();
  if (vagaIds.length) {
    const vagas = await db
      .collection("vagas")
      .find({ _id: { $in: vagaIds } })
      .toArray();
    vagas.forEach(function (vaga) {
      vagasMap.set(String(vaga._id), vaga);
    });
  }

  res.json({
    ok: true,
    candidaturas: candidaturas.map(function (candidatura) {
      const vaga = vagasMap.get(String(candidatura.vagaId));
      const base = vaga
        ? publicVagaDoc(vaga)
        : { titulo: candidatura.titulo, empresa: candidatura.empresa };
      return Object.assign({}, base, {
        vagaId: candidatura.vagaId,
        candidaturaStatus: candidatura.status,
        candidatouEm: candidatura.createdAt,
      });
    }),
  });
});

const ACTIVATION_DAYS = 7;

function createActivationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function activationExpiryDate() {
  const expires = new Date();
  expires.setDate(expires.getDate() + ACTIVATION_DAYS);
  return expires;
}

app.post("/api/parceiros", async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const empresa = String(req.body.empresa || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const telefone = String(req.body.telefone || "").trim();

  if (nome.length < 2) {
    res.status(400).json({ ok: false, error: "Informe o nome do responsável." });
    return;
  }

  if (empresa.length < 2) {
    res.status(400).json({ ok: false, error: "Informe o nome da empresa." });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const consentimentoDados =
    req.body.consentimentoDados === true || req.body.consentimentoDados === "true";
  if (!consentimentoDados) {
    res.status(400).json({
      ok: false,
      error: "É necessário aceitar o uso dos dados conforme a política de privacidade.",
    });
    return;
  }

  const documento = {
    nome,
    empresa,
    email,
    telefone: telefone || null,
    consentimentoDados: true,
    consentimentoDadosEm: new Date(),
    status: "pendente",
    createdAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    motivoRejeicao: null,
    activationToken: null,
    activationTokenExpires: null,
    senhaHash: null,
    activatedAt: null,
  };

  try {
    const result = await db.collection("parceiros").insertOne(documento);
    sendParceiroCadastroRecebido({ nome, empresa, email }).catch(function (err) {
      console.error("E-mail parceiro recebido:", err.message);
    });
    sendParceiroCadastroAdmin({ nome, empresa, email, telefone }).catch(function (err) {
      console.error("E-mail admin parceiro:", err.message);
    });
    res.status(201).json({
      ok: true,
      id: result.insertedId,
      message: "Pedido enviado. Analisaremos e responderemos por e-mail.",
      emailEnviado: isSmtpConfigured(),
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({
        ok: false,
        error: "Já existe um pedido com este e-mail. Aguarde nossa resposta ou contacte-nos.",
      });
      return;
    }
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível enviar o pedido." });
  }
});

app.get("/api/parceiros/ativacao", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    res.status(400).json({ ok: false, error: "Link inválido." });
    return;
  }

  const doc = await db.collection("parceiros").findOne({
    activationToken: token,
    status: "aprovado",
  });

  if (!doc) {
    res.status(404).json({ ok: false, error: "Link inválido ou já utilizado." });
    return;
  }

  if (doc.activationTokenExpires && doc.activationTokenExpires < new Date()) {
    res.status(410).json({ ok: false, error: "Este link expirou. Contacte contato@maisexperiencia.com.br." });
    return;
  }

  res.json({
    ok: true,
    perfil: { nome: doc.nome, empresa: doc.empresa, email: doc.email },
  });
});

app.post("/api/parceiros/ativacao", async (req, res) => {
  const token = String(req.body.token || "").trim();
  const senha = String(req.body.senha || "");

  if (!token) {
    res.status(400).json({ ok: false, error: "Link inválido." });
    return;
  }

  const senhaCheck = validatePassword(senha);
  if (!senhaCheck.ok) {
    res.status(400).json({ ok: false, error: senhaCheck.error });
    return;
  }

  const consentimentoLgpd =
    req.body.consentimentoLgpd === true || req.body.consentimentoLgpd === "true";
  if (!consentimentoLgpd) {
    res.status(400).json({
      ok: false,
      error: "É necessário aceitar o Termo de Consentimento LGPD para concluir o cadastro.",
    });
    return;
  }

  const doc = await db.collection("parceiros").findOne({
    activationToken: token,
    status: "aprovado",
  });

  if (!doc) {
    res.status(404).json({ ok: false, error: "Link inválido ou já utilizado." });
    return;
  }

  if (doc.activationTokenExpires && doc.activationTokenExpires < new Date()) {
    res.status(410).json({ ok: false, error: "Este link expirou. Contacte contato@maisexperiencia.com.br." });
    return;
  }

  let senhaHash;
  try {
    senhaHash = await hashPassword(senha);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível processar a senha." });
    return;
  }

  await db.collection("parceiros").updateOne(
    { _id: doc._id },
    {
      $set: {
        status: "activo",
        senhaHash,
        consentimentoLgpd: true,
        consentimentoLgpdEm: new Date(),
        activatedAt: new Date(),
        activationToken: null,
        activationTokenExpires: null,
      },
    }
  );

  res.json({
    ok: true,
    message: "Cadastro concluído com sucesso.",
    perfil: { nome: doc.nome, empresa: doc.empresa, email: doc.email },
  });
});

const RESET_TTL_MS = 60 * 60 * 1000;
const RESET_MESSAGE =
  "Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Verifique também a caixa de spam.";
const RESET_LINK_INVALIDO =
  "Link inválido ou expirado. Solicite um novo e-mail de recuperação.";
const resetRequestLog = new Map();

function pruneResetLog(now) {
  if (resetRequestLog.size < 500) {
    return;
  }
  resetRequestLog.forEach(function (times, key) {
    const recent = times.filter(function (t) {
      return now - t < RESET_TTL_MS;
    });
    if (!recent.length) {
      resetRequestLog.delete(key);
    } else {
      resetRequestLog.set(key, recent);
    }
  });
}

function noteResetRequest(key, limit) {
  const now = Date.now();
  pruneResetLog(now);
  const recent = (resetRequestLog.get(key) || []).filter(function (t) {
    return now - t < RESET_TTL_MS;
  });
  if (recent.length >= limit) {
    resetRequestLog.set(key, recent);
    return false;
  }
  recent.push(now);
  resetRequestLog.set(key, recent);
  return true;
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || "unknown";
}

function createResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function isResetTokenFormat(token) {
  return /^[a-f0-9]{64}$/.test(token);
}

function sanitizeDestino(value) {
  const destino = String(value || "").trim();
  if (
    /^(emprego_50|cursos_50|eventos_50|comunidade_50|bem_estar_50|vagas_50)\.html\?id=[a-f0-9]{24}$/i.test(
      destino
    )
  ) {
    return destino;
  }
  return "";
}

function contaPodeRedefinirSenha(doc) {
  return Boolean(doc && doc.senhaHash);
}

function parceiroPodeRedefinirSenha(doc) {
  return Boolean(doc && doc.status === "activo" && doc.senhaHash);
}

async function findAccountByResetToken(collection, token) {
  if (!isResetTokenFormat(token)) {
    return null;
  }
  const doc = await db.collection(collection).findOne({
    resetTokenHash: hashResetToken(token),
  });
  if (!doc || !doc.resetTokenExpires || doc.resetTokenExpires < new Date()) {
    return null;
  }
  return doc;
}

function buildResetLink(perfil, token, destino) {
  const siteUrl = process.env.SITE_URL || "https://maisexperiencia.com.br";
  let link =
    siteUrl +
    "/redefinir_senha.html?perfil=" +
    encodeURIComponent(perfil) +
    "&token=" +
    encodeURIComponent(token);
  if (destino) {
    link += "&destino=" + encodeURIComponent(destino);
  }
  return link;
}

async function solicitarRecuperacaoSenha(req, res, options) {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const permitido =
    noteResetRequest("ip:" + clientIp(req), 20) &&
    noteResetRequest("email:" + options.perfil + ":" + email, 5);
  if (!permitido) {
    res.json({ ok: true, message: RESET_MESSAGE });
    return;
  }

  const doc = await db.collection(options.collection).findOne({ email });
  if (doc && options.podeRedefinir(doc)) {
    const token = createResetToken();
    const destino = options.perfil === "50" ? sanitizeDestino(req.body.destino) : "";
    await db.collection(options.collection).updateOne(
      { _id: doc._id },
      {
        $set: {
          resetTokenHash: hashResetToken(token),
          resetTokenExpires: new Date(Date.now() + RESET_TTL_MS),
        },
      }
    );

    try {
      const result = await sendRecuperacaoSenha({
        nome: doc.nome,
        email: doc.email,
        link: buildResetLink(options.perfil, token, destino),
        contaLabel: options.contaLabel,
      });
      if (!result.sent) {
        console.error("Recuperação de senha não enviada (" + options.perfil + "):", result.reason);
      }
    } catch (err) {
      console.error("Recuperação de senha:", err.message);
    }
  }

  res.json({ ok: true, message: RESET_MESSAGE });
}

async function consultarRedefinicaoSenha(req, res, options) {
  const token = String(req.query.token || "").trim();
  const doc = await findAccountByResetToken(options.collection, token);
  if (!doc || !options.podeRedefinir(doc)) {
    res.status(404).json({ ok: false, error: RESET_LINK_INVALIDO });
    return;
  }
  res.json({ ok: true, perfil: options.perfilPublico(doc) });
}

async function confirmarRedefinicaoSenha(req, res, options) {
  const token = String(req.body.token || "").trim();
  const senha = String(req.body.senha || "");
  const doc = await findAccountByResetToken(options.collection, token);
  if (!doc || !options.podeRedefinir(doc)) {
    res.status(404).json({ ok: false, error: RESET_LINK_INVALIDO });
    return;
  }

  const senhaCheck = validatePassword(senha);
  if (!senhaCheck.ok) {
    res.status(400).json({ ok: false, error: senhaCheck.error });
    return;
  }

  let senhaHash;
  try {
    senhaHash = await hashPassword(senha);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Não foi possível processar a senha." });
    return;
  }

  const updated = await db.collection(options.collection).updateOne(
    { _id: doc._id, resetTokenHash: hashResetToken(token) },
    {
      $set: { senhaHash, senhaUpdatedAt: new Date() },
      $unset: { resetTokenHash: "", resetTokenExpires: "" },
    }
  );
  if (!updated.matchedCount) {
    res.status(404).json({ ok: false, error: RESET_LINK_INVALIDO });
    return;
  }

  await revokeSessionsForAccount(db, doc.email, options.tipoSessao);
  res.json({
    ok: true,
    message: "Senha redefinida. Entre novamente com a nova senha.",
    perfil: options.perfilPublico(doc),
  });
}

const RECUPERACAO_50 = {
  collection: "contas",
  perfil: "50",
  tipoSessao: "50",
  contaLabel: "sua conta 50+",
  podeRedefinir: contaPodeRedefinirSenha,
  perfilPublico: function (doc) {
    return { nome: doc.nome, email: doc.email };
  },
};

const RECUPERACAO_PARCEIRO = {
  collection: "parceiros",
  perfil: "parceiro",
  tipoSessao: "parceiro",
  contaLabel: "sua conta de parceiro",
  podeRedefinir: parceiroPodeRedefinirSenha,
  perfilPublico: function (doc) {
    return { nome: doc.nome, empresa: doc.empresa, email: doc.email };
  },
};

function guardRecuperacao(handler) {
  return function (req, res) {
    Promise.resolve(handler(req, res)).catch(function (error) {
      console.error(error);
      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error: "Não foi possível concluir o pedido. Tente novamente.",
        });
      }
    });
  };
}

app.post("/api/contas/recuperar-senha", guardRecuperacao(function (req, res) {
  return solicitarRecuperacaoSenha(req, res, RECUPERACAO_50);
}));

app.get("/api/contas/redefinir-senha", guardRecuperacao(function (req, res) {
  return consultarRedefinicaoSenha(req, res, RECUPERACAO_50);
}));

app.post("/api/contas/redefinir-senha", guardRecuperacao(function (req, res) {
  return confirmarRedefinicaoSenha(req, res, RECUPERACAO_50);
}));

app.post("/api/parceiros/recuperar-senha", guardRecuperacao(function (req, res) {
  return solicitarRecuperacaoSenha(req, res, RECUPERACAO_PARCEIRO);
}));

app.get("/api/parceiros/redefinir-senha", guardRecuperacao(function (req, res) {
  return consultarRedefinicaoSenha(req, res, RECUPERACAO_PARCEIRO);
}));

app.post("/api/parceiros/redefinir-senha", guardRecuperacao(function (req, res) {
  return confirmarRedefinicaoSenha(req, res, RECUPERACAO_PARCEIRO);
}));

app.get("/api/parceiros/publicacoes", requireParceiroSession, async (req, res) => {
  const email = req.sessionUser.email;
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const [vagas, ofertas] = await Promise.all([
    db
      .collection("vagas")
      .find({ emailContatoParceiro: email })
      .sort({ createdAt: -1 })
      .project({
        titulo: 1,
        tituloPublicado: 1,
        empresa: 1,
        areaTrabalho: 1,
        descricao: 1,
        descricaoPublicada: 1,
        requisitosEssenciais: 1,
        requisitosDesejaveis: 1,
        oQueEmpresaOferece: 1,
        salarioTexto: 1,
        linkCandidatura: 1,
        nomeContatoParceiro: 1,
        emailContatoParceiro: 1,
        status: 1,
        dataInicio: 1,
        dataFim: 1,
        dataPublicacao: 1,
        local: 1,
        modalidade: 1,
        regime: 1,
        notaCuradoria: 1,
        motivoRejeicao: 1,
        flagsCuradoria: 1,
        approvedAt: 1,
        createdAt: 1,
      })
      .toArray(),
    db
      .collection("ofertas")
      .find({ emailContatoParceiro: email })
      .sort({ createdAt: -1 })
      .project({
        titulo: 1,
        parceiro: 1,
        descricao: 1,
        valorInscricaoBrl: 1,
        tipo: 1,
        status: 1,
        ativo: 1,
        modalidade: 1,
        local: 1,
        dataInicio: 1,
        dataFim: 1,
        dataPublicacao: 1,
        dataTexto: 1,
        referencia: 1,
        hora: 1,
        notaCuradoria: 1,
        motivoRejeicao: 1,
        approvedAt: 1,
        createdAt: 1,
      })
      .toArray(),
  ]);

  const [contagemVagas, contagemOfertas] = await Promise.all([
    contarInscricoesPorIds("candidaturas", "vagaId", vagas.map(function (vaga) { return vaga._id; })),
    contarInscricoesPorIds("inscricoes", "ofertaId", ofertas.map(function (oferta) { return oferta._id; })),
  ]);

  const publicacoes = []
    .concat(
      vagas.map(function (vaga) {
        return {
          _id: vaga._id,
          categoria: "vaga",
          tipoLabel: "Vaga",
          titulo: vaga.tituloPublicado || vaga.titulo,
          tituloOriginal: vaga.titulo,
          parceiro: vaga.empresa,
          areaTrabalho: vaga.areaTrabalho || null,
          areaTrabalhoLabel: getAreaVagaLabel(vaga.areaTrabalho) || null,
          descricao: vaga.descricaoPublicada || vaga.descricao,
          descricaoOriginal: vaga.descricao,
          requisitosEssenciais: vaga.requisitosEssenciais || null,
          requisitosDesejaveis: vaga.requisitosDesejaveis || null,
          oQueEmpresaOferece: vaga.oQueEmpresaOferece || null,
          salarioTexto: vaga.salarioTexto || null,
          linkCandidatura: vaga.linkCandidatura || null,
          nomeContatoParceiro: vaga.nomeContatoParceiro || null,
          emailContatoParceiro: vaga.emailContatoParceiro || null,
          status: vaga.status,
          modalidade: vaga.modalidade || null,
          local: vaga.local || null,
          regime: vaga.regime || null,
          dataInicio: vaga.dataInicio || null,
          dataFim: vaga.dataFim || (!vaga.dataInicio ? vaga.dataPublicacao : null) || null,
          dataPublicacao: vaga.dataFim || vaga.dataPublicacao || null,
          notaCuradoria: vaga.notaCuradoria || null,
          motivoRejeicao: vaga.motivoRejeicao || null,
          flagsCuradoria: vaga.flagsCuradoria || [],
          approvedAt: vaga.approvedAt || null,
          createdAt: vaga.createdAt,
          totalInscricoes: contagemVagas.get(String(vaga._id)) || 0,
        };
      })
    )
    .concat(
      ofertas.map(function (oferta) {
        const tipoLabels = {
          curso: "Curso",
          bem_estar: "Bem-estar",
          evento: "Comunidade",
        };
        return {
          _id: oferta._id,
          categoria: oferta.tipo || "oferta",
          tipoLabel: tipoLabels[oferta.tipo] || "Oferta",
          titulo: oferta.titulo,
          parceiro: oferta.parceiro,
          descricao: oferta.descricao || null,
          valorInscricaoBrl: oferta.valorInscricaoBrl,
          status: oferta.status || (oferta.ativo ? "activa" : "pendente"),
          modalidade: oferta.modalidade || null,
          local: oferta.local || null,
          dataInicio: oferta.dataInicio || null,
          dataFim: oferta.dataFim || (!oferta.dataInicio && oferta.tipo !== "curso" ? oferta.dataPublicacao : null) || null,
          dataPublicacao: oferta.dataPublicacao || null,
          dataTexto: oferta.dataTexto || null,
          referencia: oferta.referencia || null,
          hora: oferta.hora || null,
          notaCuradoria: oferta.notaCuradoria || null,
          motivoRejeicao: oferta.motivoRejeicao || null,
          approvedAt: oferta.approvedAt || null,
          createdAt: oferta.createdAt,
          totalInscricoes: contagemOfertas.get(String(oferta._id)) || 0,
        };
      })
    )
    .sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  res.json({ ok: true, publicacoes });
});

// Permite ao parceiro encerrar a própria publicação antes da data de fim.
app.patch("/api/parceiros/publicacoes/:id/encerrar", requireParceiroSession, async (req, res) => {
  const emailParceiro = req.sessionUser.email;
  const id = String(req.params.id || "");
  const categoria = String(req.query.categoria || req.body.categoria || "").trim().toLowerCase();

  if (!isValidEmail(emailParceiro)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const publicacao = await findPublicacaoParceiro(emailParceiro, id, categoria);
  if (!publicacao) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }

  if (publicacao.status === "encerrada") {
    res.json({ ok: true, message: "Publicação já estava encerrada.", status: "encerrada" });
    return;
  }
  if (!["activa", "pendente"].includes(publicacao.status)) {
    res.status(400).json({
      ok: false,
      error: "Só é possível encerrar publicações ativas ou em curadoria.",
    });
    return;
  }

  const colecao = categoria === "vaga" ? "vagas" : "ofertas";
  const update =
    categoria === "vaga"
      ? { status: "encerrada", promovida: false, promovidaEm: null, encerradaEm: new Date() }
      : { status: "encerrada", ativo: false, encerradaEm: new Date() };

  await db.collection(colecao).updateOne({ _id: publicacao._id }, { $set: update });
  res.json({ ok: true, message: "Publicação encerrada.", status: "encerrada" });
});

app.get("/api/parceiros/publicacoes/:id/relatorio", requireParceiroSession, async (req, res) => {
  const email = req.sessionUser.email;
  const categoria = String(req.query.categoria || "").trim().toLowerCase();
  const id = String(req.params.id || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const publicacao = await findPublicacaoParceiro(email, id, categoria);
  if (!publicacao) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }

  const tipoLabels = {
    vaga: "Vaga",
    curso: "Curso",
    bem_estar: "Bem-estar",
    evento: "Comunidade",
  };

  let registros = [];
  if (categoria === "vaga") {
    registros = await db
      .collection("candidaturas")
      .find({ vagaId: publicacao._id })
      .sort({ createdAt: 1 })
      .toArray();
  } else {
    registros = await db
      .collection("inscricoes")
      .find({ ofertaId: publicacao._id })
      .sort({ createdAt: 1 })
      .toArray();
  }

  const inscritos = await enrichInscritosComContato(registros);

  res.json({
    ok: true,
    publicacao: {
      titulo: publicacao.tituloPublicado || publicacao.titulo,
      tipoLabel: tipoLabels[categoria] || categoria,
      parceiro: publicacao.empresa || publicacao.parceiro,
      categoria,
    },
    total: inscritos.length,
    inscritos,
  });
});

app.get("/api/parceiros/publicacoes/:id/alinhamento", requireParceiroSession, async (req, res) => {
  const email = req.sessionUser.email;
  const categoria = String(req.query.categoria || "").trim().toLowerCase();
  const id = String(req.params.id || "");
  const escopoRaw = String(req.query.escopo || "plataforma").trim().toLowerCase();
  const escopo = escopoRaw === "candidatos" ? "candidatos" : "plataforma";
  const limit = Number(req.query.limit) || 10;

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }
  if (categoria !== "vaga") {
    res.status(400).json({
      ok: false,
      error: "Alinhamento por IA disponível apenas para vagas.",
    });
    return;
  }

  const publicacao = await findPublicacaoParceiro(email, id, categoria);
  if (!publicacao) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }

  const result = await buildAlinhamentoVagaResponse(publicacao, {
    escopo: escopo,
    limit: limit,
  });
  res.status(result.status).json(result.body);
});

app.get("/api/parceiros/publicacoes/:id/candidato-curriculo", requireParceiroSession, async (req, res) => {
  const emailParceiro = req.sessionUser.email;
  const categoria = String(req.query.categoria || "").trim().toLowerCase();
  const id = String(req.params.id || "");
  const emailCandidato = String(req.query.email || "").trim().toLowerCase();

  if (!isValidEmail(emailParceiro)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }
  if (categoria !== "vaga") {
    res.status(400).json({ ok: false, error: "Currículo disponível apenas para vagas." });
    return;
  }
  if (!isValidEmail(emailCandidato)) {
    res.status(400).json({ ok: false, error: "Candidato inválido." });
    return;
  }

  const publicacao = await findPublicacaoParceiro(emailParceiro, id, categoria);
  if (!publicacao) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }

  // O parceiro só pode ver o currículo de quem efectivamente se candidatou a esta vaga.
  const candidatura = await db.collection("candidaturas").findOne({
    vagaId: publicacao._id,
    email: emailCandidato,
  });
  if (!candidatura) {
    res.status(404).json({ ok: false, error: "Candidato não encontrado nesta vaga." });
    return;
  }

  const conta = await db.collection("contas").findOne(
    { email: emailCandidato },
    {
      projection: {
        email: 1,
        nome: 1,
        telefone: 1,
        curriculoPerfil: 1,
        curriculoPerfilUpdatedAt: 1,
      },
    }
  );

  const hasPerfil = !!(conta && conta.curriculoPerfil && conta.curriculoPerfil.nome);
  if (!hasPerfil) {
    res.status(200).json({
      ok: true,
      hasPerfil: false,
      message: "Este candidato ainda não preencheu o currículo na plataforma.",
    });
    return;
  }

  res.json({
    ok: true,
    hasPerfil: true,
    updatedAt: conta.curriculoPerfilUpdatedAt || null,
    perfil: conta.curriculoPerfil,
  });
});

app.patch("/api/parceiros/publicacoes/:id/candidato-status", requireParceiroSession, async (req, res) => {
  const emailParceiro = req.sessionUser.email;
  const categoria = String(req.body.categoria || "").trim().toLowerCase();
  const id = String(req.params.id || "");
  const emailCandidato = String(req.body.email || "").trim().toLowerCase();
  const status = String(req.body.status || "").trim().toLowerCase();

  if (!isValidEmail(emailParceiro)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }
  if (categoria !== "vaga") {
    res.status(400).json({ ok: false, error: "Estado disponível apenas para vagas." });
    return;
  }
  if (!isValidEmail(emailCandidato)) {
    res.status(400).json({ ok: false, error: "Candidato inválido." });
    return;
  }
  if (!CANDIDATURA_STATUS.includes(status)) {
    res.status(400).json({ ok: false, error: "Estado de candidatura inválido." });
    return;
  }

  const publicacao = await findPublicacaoParceiro(emailParceiro, id, categoria);
  if (!publicacao) {
    res.status(404).json({ ok: false, error: "Publicação não encontrada." });
    return;
  }

  const candidatura = await db.collection("candidaturas").findOne({
    vagaId: publicacao._id,
    email: emailCandidato,
  });
  if (!candidatura) {
    res.status(404).json({ ok: false, error: "Candidato não encontrado nesta vaga." });
    return;
  }

  const eraContratada = candidatura.status === "contratada";
  const change = buildCandidaturaStatusChange(candidatura, status);
  if (!change.ok) {
    res.status(409).json({ ok: false, error: change.error });
    return;
  }

  await db.collection("candidaturas").updateOne(
    { _id: candidatura._id },
    { $set: change.update }
  );

  // Notifica o admin apenas na transição para "contratada" (KPI de colocação 50+).
  if (status === "contratada" && !eraContratada) {
    sendContratacaoAdmin({
      candidatoNome: candidatura.nome,
      candidatoEmail: emailCandidato,
      vagaTitulo: publicacao.tituloPublicado || publicacao.titulo,
      empresa: publicacao.empresa,
      parceiroEmail: emailParceiro,
      taxaBrl: CONTRATACAO_TAXA_BRL,
    }).catch(function (err) {
      console.error("E-mail contratação admin:", err.message);
    });
  }

  res.json({
    ok: true,
    status,
    cobranca: change.update.cobranca || null,
    message:
      status === "contratada"
        ? "Contratação registrada. A taxa de contratação será cobrada pela plataforma."
        : "Estado da candidatura atualizado.",
  });
});

app.get("/api/parceiros/perfil", requireParceiroSession, async (req, res) => {
  const email = req.sessionUser.email;
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("parceiros").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Parceiro não encontrado." });
    return;
  }

  res.json({
    ok: true,
    perfil: {
      nome: doc.nome,
      empresa: doc.empresa,
      email: doc.email,
      logoUrl: doc.logoDataUrl || null,
    },
  });
});

app.patch("/api/parceiros/logo", requireParceiroSession, async (req, res) => {
  const email = req.sessionUser.email;
  const logoCheck = validateLogoDataUrl(req.body.logoDataUrl);

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }
  if (!logoCheck.ok) {
    res.status(400).json({ ok: false, error: logoCheck.error });
    return;
  }

  const doc = await db.collection("parceiros").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Parceiro não encontrado." });
    return;
  }
  if (doc.status !== "activo") {
    res.status(403).json({ ok: false, error: "Conta de parceiro não activa." });
    return;
  }

  await db.collection("parceiros").updateOne(
    { _id: doc._id },
    { $set: { logoDataUrl: logoCheck.logoDataUrl, logoUpdatedAt: new Date() } }
  );

  res.json({ ok: true, message: "Logo guardado com sucesso.", logoUrl: logoCheck.logoDataUrl });
});

app.post("/api/parceiros/entrar", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
    return;
  }

  const doc = await db.collection("parceiros").findOne({ email });
  if (!doc) {
    res.status(404).json({ ok: false, error: "E-mail ou senha incorretos." });
    return;
  }

  if (doc.status === "pendente") {
    res.status(403).json({ ok: false, error: "Seu pedido ainda está em análise." });
    return;
  }

  if (doc.status === "aprovado") {
    res.status(403).json({
      ok: false,
      error: "Finalize seu cadastro pelo link enviado por e-mail.",
    });
    return;
  }

  if (doc.status === "rejeitado") {
    res.status(403).json({ ok: false, error: "Pedido de parceria não aprovado." });
    return;
  }

  if (!doc.senhaHash) {
    res.status(403).json({
      ok: false,
      error: "Finalize seu cadastro pelo link enviado por e-mail.",
    });
    return;
  }

  if (!senha) {
    res.status(400).json({ ok: false, error: "Informe sua senha." });
    return;
  }

  const valida = await verifyPassword(senha, doc.senhaHash);
  if (!valida) {
    res.status(401).json({ ok: false, error: "E-mail ou senha incorretos." });
    return;
  }

  const session = await createSession(db, { email: doc.email, tipo: "parceiro" });
  res.json({
    ok: true,
    token: session.token,
    perfil: {
      nome: doc.nome,
      empresa: doc.empresa,
      email: doc.email,
      logoUrl: doc.logoDataUrl || null,
    },
  });
});

app.get("/api/admin/parceiros", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "pendente").trim();
  const filter = status === "todas" ? {} : { status };

  const parceiros = await db
    .collection("parceiros")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  res.json({ ok: true, parceiros });
});

app.patch("/api/admin/parceiros/:id/aprovar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Pedido inválido." });
    return;
  }

  const doc = await db.collection("parceiros").findOne({ _id: new ObjectId(id) });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Pedido não encontrado." });
    return;
  }

  if (doc.status === "activo") {
    res.status(409).json({ ok: false, error: "Parceiro já está activo." });
    return;
  }

  if (doc.status === "aprovado") {
    res.status(409).json({ ok: false, error: "Pedido já aprovado. Aguardando finalização da senha." });
    return;
  }

  const token = createActivationToken();
  const activationTokenExpires = activationExpiryDate();

  await db.collection("parceiros").updateOne(
    { _id: doc._id },
    {
      $set: {
        status: "aprovado",
        approvedAt: new Date(),
        activationToken: token,
        activationTokenExpires,
        motivoRejeicao: null,
        rejectedAt: null,
      },
    }
  );

  let emailResult = { sent: false, reason: "smtp_not_configured" };
  try {
    emailResult = await sendParceiroAprovacao({ nome: doc.nome, email: doc.email, token });
  } catch (err) {
    console.error("E-mail parceiro aprovado:", err.message);
    emailResult = { sent: false, reason: err.message };
  }

  res.json({
    ok: true,
    message: emailResult.sent
      ? "Parceiro aprovado. E-mail de finalização enviado."
      : "Parceiro aprovado, mas o e-mail não foi enviado. Use «Reenviar e-mail» ou verifique o SMTP.",
    emailEnviado: emailResult.sent,
    emailErro: emailResult.sent ? null : emailResult.reason || "unknown",
  });
});

app.patch("/api/admin/parceiros/:id/reenviar-ativacao", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Pedido inválido." });
    return;
  }

  const doc = await db.collection("parceiros").findOne({ _id: new ObjectId(id) });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Pedido não encontrado." });
    return;
  }

  if (doc.status !== "aprovado") {
    res.status(409).json({
      ok: false,
      error: "Só é possível reenviar e-mail para parceiros aguardando criação de senha.",
    });
    return;
  }

  const token = createActivationToken();
  const activationTokenExpires = activationExpiryDate();

  await db.collection("parceiros").updateOne(
    { _id: doc._id },
    { $set: { activationToken: token, activationTokenExpires } }
  );

  let emailResult = { sent: false, reason: "smtp_not_configured" };
  try {
    emailResult = await sendParceiroAprovacao({ nome: doc.nome, email: doc.email, token });
  } catch (err) {
    console.error("E-mail parceiro reenvio:", err.message);
    emailResult = { sent: false, reason: err.message };
  }

  res.json({
    ok: emailResult.sent,
    message: emailResult.sent
      ? "E-mail de ativação reenviado."
      : "Não foi possível reenviar o e-mail. Verifique o SMTP.",
    emailEnviado: emailResult.sent,
    emailErro: emailResult.sent ? null : emailResult.reason || "unknown",
  });
});

app.patch("/api/admin/parceiros/:id/rejeitar", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, error: "Pedido inválido." });
    return;
  }

  const doc = await db.collection("parceiros").findOne({ _id: new ObjectId(id) });
  if (!doc) {
    res.status(404).json({ ok: false, error: "Pedido não encontrado." });
    return;
  }

  if (doc.status === "activo") {
    res.status(409).json({ ok: false, error: "Parceiro já está activo." });
    return;
  }

  const motivoRejeicao = String(req.body.motivoRejeicao || "").trim() || null;

  await db.collection("parceiros").updateOne(
    { _id: doc._id },
    {
      $set: {
        status: "rejeitado",
        motivoRejeicao,
        rejectedAt: new Date(),
        activationToken: null,
        activationTokenExpires: null,
      },
    }
  );

  sendParceiroRejeicao({ nome: doc.nome, email: doc.email, motivo: motivoRejeicao }).catch(function (err) {
    console.error("E-mail parceiro rejeitado:", err.message);
  });

  res.json({ ok: true, message: "Pedido rejeitado." });
});

// ---------------------------------------------------------------------------
// Agendador de lembretes de medicação + captura de vínculos do Telegram.
// ---------------------------------------------------------------------------

function montarTextoTelegram(med, horario) {
  const linhas = [
    "💊 <b>Hora do medicamento (" + horario + ")</b>",
    med.dose ? med.nome + " — " + med.dose : med.nome,
  ];
  if (med.instrucoes) linhas.push("📋 " + med.instrucoes);
  linhas.push("");
  linhas.push("<i>Lembrete automático. Em caso de dúvida, fale com seu médico.</i>");
  return linhas.join("\n");
}

let lembretesTickEmAndamento = false;

async function tickLembretes() {
  if (!LEMBRETES_ENABLED || lembretesTickEmAndamento) return;
  lembretesTickEmAndamento = true;
  try {
    const partes = MEDICACAO.partesLocais(new Date(), LEMBRETES_TZ);
    const meds = await db
      .collection("medicamentos")
      .find({ ativo: true, horarios: partes.hhmm })
      .toArray();
    if (!meds.length) return;

    const emails = Array.from(new Set(meds.map((m) => m.email)));
    const contas = await db
      .collection("contas")
      .find({ email: { $in: emails }, lembretesOptIn: true })
      .project({ email: 1, nome: 1, canalLembrete: 1, telegramChatId: 1 })
      .toArray();
    const contaPorEmail = {};
    contas.forEach((c) => {
      contaPorEmail[c.email] = c;
    });

    for (const med of meds) {
      if (!MEDICACAO.estaDevido(med, partes)) continue;
      const conta = contaPorEmail[med.email];
      if (!conta) continue;
      const canal = conta.canalLembrete;
      if (!CANAIS_LEMBRETE.includes(canal)) continue;
      if (canal === "telegram" && !conta.telegramChatId) continue;

      // Reserva idempotente: o índice único evita envio duplicado no mesmo minuto.
      let envioId;
      try {
        const reserva = await db.collection("medicamento_envios").insertOne({
          email: med.email,
          medicamentoId: med._id,
          dataRef: partes.dataRef,
          horario: partes.hhmm,
          canal,
          status: "enviando",
          refId: null,
          sentAt: null,
          createdAt: new Date(),
        });
        envioId = reserva.insertedId;
      } catch (error) {
        if (error.code === 11000) continue; // já enviado/em envio
        throw error;
      }

      try {
        let refId = null;
        if (canal === "telegram") {
          const resp = await telegramSendMessage(conta.telegramChatId, montarTextoTelegram(med, partes.hhmm));
          if (!resp || resp.ok === false) {
            throw new Error("telegram: " + ((resp && resp.description) || resp.reason || "falha"));
          }
          refId = resp.result && resp.result.message_id ? String(resp.result.message_id) : null;
        } else {
          const resp = await sendLembreteMedicacao({
            email: conta.email,
            nome: conta.nome,
            medNome: med.nome,
            dose: med.dose,
            instrucoes: med.instrucoes,
            horario: partes.hhmm,
          });
          if (!resp.sent) throw new Error("email: " + (resp.reason || "falha"));
        }
        await db.collection("medicamento_envios").updateOne(
          { _id: envioId },
          { $set: { status: "enviado", refId, sentAt: new Date() } }
        );
      } catch (err) {
        await db.collection("medicamento_envios").updateOne(
          { _id: envioId },
          { $set: { status: "erro", erro: String(err.message || err), sentAt: new Date() } }
        );
        console.error("Lembrete falhou (" + med.email + "):", err.message);
      }
    }
  } catch (error) {
    console.error("tickLembretes erro:", error.message);
  } finally {
    lembretesTickEmAndamento = false;
  }
}

let telegramOffset = 0;
let telegramTickEmAndamento = false;

async function tickTelegram() {
  if (!isTelegramConfigured() || telegramTickEmAndamento) return;
  telegramTickEmAndamento = true;
  try {
    const updates = await telegramGetUpdates(telegramOffset, 0);
    if (!updates || !updates.ok || !Array.isArray(updates.result)) return;
    for (const upd of updates.result) {
      telegramOffset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg || !msg.text || !msg.chat) continue;
      const chatId = msg.chat.id;
      const texto = String(msg.text).trim();
      const m = texto.match(/^\/start\s+([A-Za-z0-9]{6,16})$/);
      if (!m) {
        if (/^\/start\b/.test(texto)) {
          await telegramSendMessage(
            chatId,
            "Olá! Para receber seus lembretes, use o link de vínculo gerado na sua área 50+ do Mais Experiência."
          );
        }
        continue;
      }
      const codigo = m[1].toUpperCase();
      const vinculo = await db.collection("telegram_vinculos").findOne({ codigo });
      if (!vinculo || (vinculo.expiresAt && vinculo.expiresAt.getTime() < Date.now())) {
        await telegramSendMessage(chatId, "Código inválido ou expirado. Gere um novo link no site.");
        continue;
      }
      await db.collection("contas").updateOne(
        { email: vinculo.email },
        { $set: { telegramChatId: String(chatId), telegramVinculadoEm: new Date() } }
      );
      await db.collection("telegram_vinculos").deleteMany({ email: vinculo.email });
      await telegramSendMessage(
        chatId,
        "✅ Pronto! Sua conta foi vinculada. Você receberá aqui os lembretes de medicação. Ative o canal no site."
      );
    }
  } catch (error) {
    console.error("tickTelegram erro:", error.message);
  } finally {
    telegramTickEmAndamento = false;
  }
}

function iniciarAgendadores() {
  if (LEMBRETES_ENABLED) {
    setInterval(tickLembretes, 60 * 1000);
    setTimeout(tickLembretes, 5 * 1000);
    console.log("Lembretes de medicação: ativos (tz " + LEMBRETES_TZ + ")");
  } else {
    console.log("Lembretes de medicação: desativados (LEMBRETES_ENABLED=false)");
  }
  if (isTelegramConfigured()) {
    setInterval(tickTelegram, 15 * 1000);
    setTimeout(tickTelegram, 3 * 1000);
    console.log("Telegram: configurado (@" + telegramBotUsername() + ")");
  } else {
    console.log("Telegram: não configurado");
  }
}

connectDb()
  .then(function () {
    app.listen(PORT, HOST, function () {
      console.log("API em http://" + HOST + ":" + PORT);
      console.log("SMTP:", isSmtpConfigured() ? "configurado" : "desactivado");
      iniciarAgendadores();
    });
  })
  .catch(function (error) {
    console.error("Falha ao ligar ao MongoDB:", error.message);
    process.exit(1);
  });

process.on("SIGINT", async function () {
  if (client) await client.close();
  process.exit(0);
});

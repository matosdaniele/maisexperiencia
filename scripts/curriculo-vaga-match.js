"use strict";

const crypto = require("crypto");

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const MAX_POOL = 30;

function isOpenRouterConfigured() {
  return !!String(process.env.OPENROUTER_API_KEY || "").trim();
}

function buildVagaMatchPayload(vaga) {
  return {
    titulo: vaga.tituloPublicado || vaga.titulo || "",
    empresa: vaga.empresa || "",
    areaTrabalho: vaga.areaTrabalho || "",
    descricao: vaga.descricaoPublicada || vaga.descricao || "",
    requisitosEssenciais: vaga.requisitosEssenciais || "",
    requisitosDesejaveis: vaga.requisitosDesejaveis || "",
    oQueEmpresaOferece: vaga.oQueEmpresaOferece || "",
    regime: vaga.regime || "",
    modalidade: vaga.modalidade || "",
    local: vaga.local || "",
    salarioTexto: vaga.salarioTexto || "",
  };
}

function buildCurriculoMatchPayload(conta) {
  const perfil = conta.curriculoPerfil || {};
  return {
    id: String(conta.email || "").trim().toLowerCase(),
    email: String(conta.email || "").trim().toLowerCase(),
    nome: perfil.nome || conta.nome || "",
    titulo: perfil.titulo || "",
    localizacao: perfil.localizacao || "",
    resumo: perfil.resumo || "",
    competencias: Array.isArray(perfil.competencias) ? perfil.competencias : [],
    idiomas: Array.isArray(perfil.idiomas) ? perfil.idiomas : [],
    experiencias: Array.isArray(perfil.experiencias) ? perfil.experiencias : [],
    formacao: Array.isArray(perfil.formacao) ? perfil.formacao : [],
    candidatou: !!conta.candidatou,
  };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  const attempts = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    attempts.unshift(fenced[1].trim());
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    attempts.push(raw.slice(start, end + 1));
  }

  for (let i = 0; i < attempts.length; i += 1) {
    try {
      return JSON.parse(attempts[i]);
    } catch (_error) {
      // tenta próximo formato
    }
  }

  return null;
}

function clampScore(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(100, n));
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map(function (key) {
        return JSON.stringify(key) + ":" + stableStringify(value[key]);
      })
      .join(",") +
    "}"
  );
}

function hashMatchInput(payload) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function buildCandidatoMatchInputHash(vaga, conta) {
  const curriculo = buildCurriculoMatchPayload(conta);
  delete curriculo.candidatou;
  return hashMatchInput({
    vaga: buildVagaMatchPayload(vaga),
    curriculo: curriculo,
    modelo: OPENROUTER_MODEL,
  });
}

function buildRankingMatchInputHash(vaga, contas, escopo) {
  const curriculos = (contas || [])
    .map(function (conta) {
      const item = buildCurriculoMatchPayload(conta);
      delete item.candidatou;
      return item;
    })
    .filter(function (item) {
      return item.email;
    })
    .sort(function (a, b) {
      return a.email.localeCompare(b.email);
    });

  return hashMatchInput({
    vaga: buildVagaMatchPayload(vaga),
    curriculos: curriculos,
    escopo: escopo,
    modelo: OPENROUTER_MODEL,
  });
}

function normalizeRankingEntries(entries, curriculosById) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const seen = new Set();
  const ranking = [];

  entries.forEach(function (entry) {
    const id = String((entry && (entry.id || entry.email)) || "")
      .trim()
      .toLowerCase();
    if (!id || seen.has(id)) {
      return;
    }

    const curriculo = curriculosById.get(id);
    if (!curriculo) {
      return;
    }

    seen.add(id);
    ranking.push({
      email: curriculo.email,
      nome: curriculo.nome,
      score: clampScore(entry.score),
      motivo: String(entry.motivo || entry.justificativa || "").trim().slice(0, 500),
      candidatou: !!curriculo.candidatou,
    });
  });

  ranking.sort(function (a, b) {
    return b.score - a.score;
  });

  return ranking;
}

async function rankCurriculosForVaga(vaga, contas, options) {
  const opts = options || {};
  const limit = Math.max(1, Math.min(Number(opts.limit) || 10, 25));

  if (!isOpenRouterConfigured()) {
    const error = new Error("OPENROUTER_API_KEY não configurada.");
    error.code = "OPENROUTER_NOT_CONFIGURED";
    throw error;
  }

  const curriculos = (contas || [])
    .map(buildCurriculoMatchPayload)
    .filter(function (item) {
      return item.email && item.nome;
    })
    .slice(0, MAX_POOL);

  if (!curriculos.length) {
    return {
      ranking: [],
      totalAvaliados: 0,
      modelo: OPENROUTER_MODEL,
    };
  }

  const curriculosById = new Map(
    curriculos.map(function (item) {
      return [item.id, item];
    })
  );

  const systemPrompt =
    "Você é especialista em recrutamento de profissionais 50+ no Brasil. " +
    "Avalie o alinhamento entre cada currículo e a vaga. " +
    "Responda APENAS com JSON válido no formato " +
    '{"ranking":[{"id":"email","score":85,"motivo":"explicação curta em pt-BR"}]}. ' +
    "Use score inteiro de 0 a 100. Ordene do maior para o menor. " +
    "Considere experiência, competências, localização, modalidade e requisitos.";

  const userPrompt = JSON.stringify(
    {
      vaga: buildVagaMatchPayload(vaga),
      curriculos: curriculos,
      instrucoes: {
        limiteTop: limit,
        idDeveSer: "email de cada currículo",
      },
    },
    null,
    2
  );

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + String(process.env.OPENROUTER_API_KEY).trim(),
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SITE_URL || "https://maisexperiencia.com.br",
      "X-Title": "Mais Experiência",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(
      "OpenRouter respondeu com erro " + response.status + ": " + detail.slice(0, 300)
    );
    error.code = "OPENROUTER_HTTP_ERROR";
    throw error;
  }

  const data = await response.json();
  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  const parsed = extractJsonObject(content);
  if (!parsed || !parsed.ranking) {
    const error = new Error("Resposta da IA em formato inválido.");
    error.code = "OPENROUTER_PARSE_ERROR";
    throw error;
  }

  const ranking = normalizeRankingEntries(parsed.ranking, curriculosById).slice(
    0,
    limit
  );

  return {
    ranking: ranking,
    totalAvaliados: curriculos.length,
    modelo: OPENROUTER_MODEL,
  };
}

function normalizeScorePayload(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (parsed.score != null) {
    return {
      score: clampScore(parsed.score),
      motivo: String(parsed.motivo || parsed.justificativa || "")
        .trim()
        .slice(0, 500),
    };
  }

  if (Array.isArray(parsed.ranking) && parsed.ranking.length) {
    const entry = parsed.ranking[0];
    return {
      score: clampScore(entry.score),
      motivo: String(entry.motivo || entry.justificativa || "")
        .trim()
        .slice(0, 500),
    };
  }

  return null;
}

async function scoreCurriculoForVaga(vaga, conta) {
  if (!isOpenRouterConfigured()) {
    const error = new Error("OPENROUTER_API_KEY não configurada.");
    error.code = "OPENROUTER_NOT_CONFIGURED";
    throw error;
  }

  const curriculo = buildCurriculoMatchPayload(conta);
  if (!curriculo.email || !curriculo.nome) {
    const error = new Error("Currículo não preenchido.");
    error.code = "SEM_CURRICULO";
    throw error;
  }

  const systemPrompt =
    "Você é especialista em recrutamento de profissionais 50+ no Brasil. " +
    "Avalie o alinhamento entre UM currículo e UMA vaga. " +
    "Responda APENAS com JSON válido no formato " +
    '{"score":85,"motivo":"explicação curta em pt-BR"}. ' +
    "Use score inteiro de 0 a 100 (quanto maior, melhor o fit). " +
    "Considere experiência, competências, localização, modalidade e requisitos.";

  const userPrompt = JSON.stringify(
    {
      vaga: buildVagaMatchPayload(vaga),
      curriculo: curriculo,
    },
    null,
    2
  );

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + String(process.env.OPENROUTER_API_KEY).trim(),
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SITE_URL || "https://maisexperiencia.com.br",
      "X-Title": "Mais Experiência",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(
      "OpenRouter respondeu com erro " + response.status + ": " + detail.slice(0, 300)
    );
    error.code = "OPENROUTER_HTTP_ERROR";
    throw error;
  }

  const data = await response.json();
  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  const parsed = normalizeScorePayload(extractJsonObject(content));
  if (!parsed) {
    const error = new Error("Resposta da IA em formato inválido.");
    error.code = "OPENROUTER_PARSE_ERROR";
    throw error;
  }

  return {
    score: parsed.score,
    motivo: parsed.motivo,
    modelo: OPENROUTER_MODEL,
  };
}

module.exports = {
  OPENROUTER_MODEL,
  MAX_POOL,
  isOpenRouterConfigured,
  buildVagaMatchPayload,
  buildCurriculoMatchPayload,
  buildCandidatoMatchInputHash,
  buildRankingMatchInputHash,
  rankCurriculosForVaga,
  scoreCurriculoForVaga,
};

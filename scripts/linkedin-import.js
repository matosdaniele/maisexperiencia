"use strict";

const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const FETCH_HEADERS = {
  "User-Agent": "facebookexternalhit/1.1",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml",
};

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, function (_match, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (_match, num) {
      return String.fromCharCode(Number(num));
    });
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLinkedInUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Cole o link do seu perfil LinkedIn antes de continuar." };
  }
  if (!/^https?:\/\/(www\.)?linkedin\.com\//i.test(trimmed)) {
    return { ok: false, error: "Informe um link válido do LinkedIn (linkedin.com/in/…)." };
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch (_err) {
    return { ok: false, error: "Informe um link válido do LinkedIn (linkedin.com/in/…)." };
  }
  if (!/^\/in\//i.test(url.pathname)) {
    return {
      ok: false,
      error: "Use o link público do perfil (linkedin.com/in/seu-nome).",
    };
  }
  url.hash = "";
  url.search = "";
  url.protocol = "https:";
  url.hostname = "www.linkedin.com";
  return { ok: true, url: url.toString() };
}

function readMetaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    'property="' + escaped + '" content="([^"]*)"',
    "i"
  ).exec(html);
  if (match) {
    return decodeHtmlEntities(match[1]);
  }
  const nameMatch = new RegExp(
    'name="' + escaped + '" content="([^"]*)"',
    "i"
  ).exec(html);
  return nameMatch ? decodeHtmlEntities(nameMatch[1]) : "";
}

function parseOgTitle(ogTitle) {
  const cleaned = String(ogTitle || "").replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const dashIndex = cleaned.indexOf(" - ");
  if (dashIndex === -1) {
    return { nome: cleaned, titulo: "" };
  }
  return {
    nome: cleaned.slice(0, dashIndex).trim(),
    titulo: cleaned.slice(dashIndex + 3).trim(),
  };
}

function splitDescriptionParts(description) {
  return String(description || "")
    .split(/\s*·\s*/)
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);
}

function extractLabelValue(part, labels) {
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const prefix = label + ":";
    if (part.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
      return part.slice(prefix.length).trim();
    }
  }
  return "";
}

function parseOgDescription(description) {
  const parts = splitDescriptionParts(description);
  const result = {
    resumo: "",
    localizacao: "",
    experiencias: [],
    formacao: [],
  };

  const summaryParts = [];
  parts.forEach(function (part) {
    const lower = part.toLowerCase();
    if (
      lower.indexOf("conex") !== -1 &&
      (lower.indexOf("linkedin") !== -1 || lower.indexOf("linkedIn") !== -1)
    ) {
      return;
    }
    if (
      lower.indexOf("veja o perfil") === 0 ||
      lower.indexOf("view ") === 0 ||
      lower.indexOf("see ") === 0
    ) {
      return;
    }

    const experiencia = extractLabelValue(part, [
      "Experiência",
      "Experience",
    ]);
    if (experiencia) {
      result.experiencias.push({ empresa: experiencia, cargo: "" });
      return;
    }

    const formacao = extractLabelValue(part, [
      "Formação acadêmica",
      "Formação académica",
      "Education",
    ]);
    if (formacao) {
      result.formacao.push({ instituicao: formacao, curso: "" });
      return;
    }

    const local = extractLabelValue(part, ["Localidade", "Location"]);
    if (local) {
      result.localizacao = local;
      return;
    }

    summaryParts.push(part);
  });

  if (summaryParts.length > 1) {
    result.resumo = summaryParts.slice(1).join(" · ");
  } else if (summaryParts.length === 1) {
    result.resumo = summaryParts[0];
  }

  return result;
}

function parseExperienceFromHtml(html) {
  const start = html.indexOf('data-section="experience"');
  if (start === -1) {
    return [];
  }
  const end = html.indexOf('data-section="education"', start);
  const chunk = html.slice(start, end > start ? end : start + 80000);
  const items = chunk.match(/<li[^>]*class="[^"]*experience-item[^"]*"[^>]*>[\s\S]*?<\/li>/gi);
  if (!items) {
    return [];
  }

  return items
    .map(function (block) {
      const title = stripHtml(
        (block.match(/experience-item__title[^>]*>([\s\S]*?)<\//) || [])[1]
      );
      const subtitle = stripHtml(
        (block.match(/experience-item__subtitle[^>]*>([\s\S]*?)<\//) || [])[1]
      );
      const caption = stripHtml(
        (block.match(/experience-item__caption[^>]*>([\s\S]*?)<\//) || [])[1]
      );
      const descricao = stripHtml(
        (block.match(/experience-item__description[^>]*>([\s\S]*?)<\//) || [])[1]
      );
      const localParts = caption.split("·").map(function (part) {
        return part.trim();
      });
      return {
        empresa: subtitle,
        cargo: title,
        periodo: localParts[0] || "",
        local: localParts[1] || "",
        descricao: descricao,
      };
    })
    .filter(function (item) {
      return item.empresa || item.cargo;
    })
    .slice(0, 20);
}

function parseEducationFromHtml(html) {
  const markers = ['data-section="education"', 'id="education"'];
  let start = -1;
  markers.forEach(function (marker) {
    if (start === -1) {
      start = html.indexOf(marker);
    }
  });
  if (start === -1) {
    return [];
  }
  const end = html.indexOf('data-section="', start + 20);
  const chunk = html.slice(start, end > start ? end : start + 50000);
  const items = chunk.match(/<li[^>]*>[\s\S]*?<\/li>/gi);
  if (!items) {
    return [];
  }

  return items
    .map(function (block) {
      if (block.indexOf("education") === -1 && block.indexOf("school") === -1) {
        return null;
      }
      const instituicao = stripHtml((block.match(/<h3[^>]*>([\s\S]*?)<\//) || [])[1]);
      const curso = stripHtml((block.match(/<h4[^>]*>([\s\S]*?)<\//) || [])[1]);
      const periodo = stripHtml(
        (block.match(/education-item__caption[^>]*>([\s\S]*?)<\//) ||
          block.match(/education__item[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\//) ||
          [])[1]
      );
      if (!instituicao && !curso) {
        return null;
      }
      return {
        instituicao: instituicao || curso,
        curso: instituicao && curso && instituicao !== curso ? curso : "",
        periodo: periodo,
      };
    })
    .filter(Boolean)
    .slice(0, 15);
}

function parseSkillsFromHtml(html) {
  const start = html.indexOf('data-section="skills"');
  if (start === -1) {
    return [];
  }
  const end = html.indexOf('data-section="', start + 20);
  const chunk = html.slice(start, end > start ? end : start + 50000);
  const matches = chunk.match(/>([^<]{2,80})<\//g);
  if (!matches) {
    return [];
  }
  const skip = {
    skills: true,
    "all skills": true,
    "see all": true,
    "ver todos": true,
  };
  const skills = [];
  matches.forEach(function (raw) {
    const value = stripHtml(raw.replace(/^>/, "").replace(/<$/, ""));
    const key = value.toLowerCase();
    if (!value || skip[key] || skills.indexOf(value) !== -1) {
      return;
    }
    if (/^\d/.test(value) || value.length < 2) {
      return;
    }
    skills.push(value);
  });
  return skills.slice(0, 30);
}

function mergeExperiencias(primary, fallback) {
  if (primary.length) {
    return primary;
  }
  return fallback;
}

function mergeFormacao(primary, fallback) {
  if (primary.length) {
    return primary;
  }
  return fallback;
}

async function fetchLinkedInHtml(url) {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
  });
  const html = await response.text();
  return { status: response.status, html: html };
}

async function fetchProxycurlProfile(url, apiKey) {
  const endpoint = new URL("https://nubela.co/proxycurl/api/v2/linkedin");
  endpoint.searchParams.set("url", url);
  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: "Bearer " + apiKey,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error("Proxycurl respondeu " + response.status + ": " + body.slice(0, 120));
  }
  return response.json();
}

function formatProxycurlDate(value) {
  if (!value || !value.year) {
    return "";
  }
  const month = value.month ? String(value.month).padStart(2, "0") : "";
  if (value.day && month) {
    return value.day + "/" + month + "/" + value.year;
  }
  if (month) {
    return month + "/" + value.year;
  }
  return String(value.year);
}

function formatProxycurlRange(start, end) {
  const startLabel = formatProxycurlDate(start);
  const endLabel = end ? formatProxycurlDate(end) : "actual";
  if (!startLabel) {
    return endLabel === "actual" ? "" : endLabel;
  }
  return startLabel + " – " + endLabel;
}

function mapProxycurlToPerfil(data, linkedinUrl) {
  const localizacao = [data.city, data.state, data.country_full_name || data.country]
    .filter(Boolean)
    .join(", ");

  return {
    nome: data.full_name || "",
    titulo: data.headline || "",
    localizacao: localizacao,
    resumo: data.summary || "",
    linkedinUrl: linkedinUrl,
    competencias: Array.isArray(data.skills)
      ? data.skills
          .map(function (item) {
            return typeof item === "string" ? item : item && item.name;
          })
          .filter(Boolean)
          .slice(0, 30)
      : [],
    idiomas: Array.isArray(data.languages)
      ? data.languages
          .map(function (item) {
            return {
              idioma: item.name || item.language || "",
              nivel: item.proficiency || "",
            };
          })
          .filter(function (item) {
            return item.idioma;
          })
      : [],
    experiencias: Array.isArray(data.experiences)
      ? data.experiences
          .map(function (item) {
            return {
              empresa: item.company || "",
              cargo: item.title || "",
              periodo: formatProxycurlRange(item.starts_at, item.ends_at),
              local: item.location || "",
              descricao: item.description || "",
            };
          })
          .filter(function (item) {
            return item.empresa || item.cargo;
          })
          .slice(0, 20)
      : [],
    formacao: Array.isArray(data.education)
      ? data.education
          .map(function (item) {
            return {
              instituicao: item.school || "",
              curso: item.degree_name || item.field_of_study || "",
              periodo: formatProxycurlRange(item.starts_at, item.ends_at),
            };
          })
          .filter(function (item) {
            return item.instituicao || item.curso;
          })
          .slice(0, 15)
      : [],
    fotoDataUrl: null,
  };
}

async function fetchPhotoDataUrl(imageUrl) {
  if (!imageUrl) {
    return null;
  }
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent": FETCH_HEADERS["User-Agent"],
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    return null;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 400 * 1024) {
    return null;
  }
  const contentType = String(response.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (allowed.indexOf(contentType) === -1) {
    return null;
  }
  const normalizedType = contentType === "image/jpg" ? "image/jpeg" : contentType;
  return "data:" + normalizedType + ";base64," + buffer.toString("base64");
}

function buildPerfilFromHtml(html, linkedinUrl) {
  const ogTitle = readMetaContent(html, "og:title");
  const ogDescription = readMetaContent(html, "og:description");
  const ogImage = readMetaContent(html, "og:image");

  if (!ogTitle) {
    return null;
  }

  const titleParts = parseOgTitle(ogTitle);
  const descriptionParts = parseOgDescription(ogDescription);
  const experiencias = mergeExperiencias(
    parseExperienceFromHtml(html),
    descriptionParts.experiencias
  );
  const formacao = mergeFormacao(
    parseEducationFromHtml(html),
    descriptionParts.formacao
  );
  const competencias = parseSkillsFromHtml(html);

  return {
    nome: titleParts.nome,
    titulo: titleParts.titulo,
    localizacao: descriptionParts.localizacao,
    resumo: descriptionParts.resumo,
    linkedinUrl: linkedinUrl,
    competencias: competencias,
    idiomas: [],
    experiencias: experiencias,
    formacao: formacao,
    fotoDataUrl: null,
    _photoUrl: ogImage || null,
  };
}

async function importLinkedInProfile(rawUrl, options) {
  options = options || {};
  const normalized = normalizeLinkedInUrl(rawUrl);
  if (!normalized.ok) {
    return normalized;
  }

  let perfil = null;
  let source = "";

  try {
    const page = await fetchLinkedInHtml(normalized.url);
    if (page.status >= 200 && page.status < 400) {
      perfil = buildPerfilFromHtml(page.html, normalized.url);
      if (perfil && perfil.nome) {
        source = "public";
      }
    }
  } catch (_err) {
    perfil = null;
  }

  if (!perfil && options.proxycurlApiKey) {
    try {
      const proxycurlData = await fetchProxycurlProfile(
        normalized.url,
        options.proxycurlApiKey
      );
      perfil = mapProxycurlToPerfil(proxycurlData, normalized.url);
      source = "proxycurl";
    } catch (err) {
      return {
        ok: false,
        error:
          "Não foi possível importar o perfil LinkedIn. Verifique se o link está correcto e se o perfil é público.",
        detail: String(err.message || err),
      };
    }
  }

  if (!perfil || !perfil.nome) {
    return {
      ok: false,
      error:
        "Não foi possível ler os dados desse perfil. Confirme que o link está correcto (linkedin.com/in/…) e que o perfil está público, ou preencha os campos manualmente.",
    };
  }

  if (perfil._photoUrl) {
    try {
      perfil.fotoDataUrl = await fetchPhotoDataUrl(perfil._photoUrl);
    } catch (_err) {
      perfil.fotoDataUrl = null;
    }
  }
  delete perfil._photoUrl;

  return {
    ok: true,
    source: source,
    perfil: perfil,
    imported: {
      experiencias: perfil.experiencias.length,
      formacao: perfil.formacao.length,
      competencias: perfil.competencias.length,
      idiomas: perfil.idiomas.length,
      foto: !!perfil.fotoDataUrl,
    },
  };
}

module.exports = {
  normalizeLinkedInUrl,
  importLinkedInProfile,
};

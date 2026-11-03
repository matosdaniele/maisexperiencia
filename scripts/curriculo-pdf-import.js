"use strict";

const pdf = require("pdf-parse");

const SECTION_HEADERS = {
  contact: ["contact", "contato"],
  skills: [
    "top skills",
    "principais competências",
    "principais competencias",
    "skills",
    "competências",
    "competencias",
  ],
  languages: ["languages", "idiomas"],
  certifications: ["certifications", "certificações", "certificacoes"],
  summary: ["summary", "resumo", "about", "sobre"],
  experience: ["experience", "experiência", "experiencia"],
  education: [
    "education",
    "formação acadêmica",
    "formação académica",
    "formacao academica",
    "formacao academica",
  ],
  honors: ["honors-awards", "honors & awards", "honors and awards", "prêmios e honrarias"],
  volunteer: ["volunteer experience", "experiência de voluntariado", "experiencia de voluntariado"],
};

const MONTH_NAMES =
  "jan(?:eiro)?|fev(?:ereiro)?|feb(?:ruary|eiro)?|mar(?:ch|ço|co)?|abr(?:il)?|apr(?:il)?|may|maio|jun(?:e|ho)?|jul(?:y|ho)?|ago(?:sto)?|aug(?:ust|o)?|set(?:embro)?|sep(?:t(?:ember|embro)?)?|out(?:ubro)?|oct(?:ober|ubro)?|nov(?:ember|embro)?|dez(?:embro)?|dec(?:ember|embro)?";

const DATE_END =
  "(?:present|presente|actual|atual|pres(?:ent)?|o momento|atualmente|" +
  MONTH_NAMES +
  "\\.?(?:\\s+de)?\\s+\\d{4}|\\d{4})";

const DATE_LINE = new RegExp(
  "\\b(?:" +
    MONTH_NAMES +
    "\\.?(?:\\s+de)?\\s+\\d{4}|\\d{4})\\s*[-–—]\\s*" +
    DATE_END,
  "i"
);

const PERIOD_IN_PARENS = /\((\d{4}\s*[-–—]\s*(?:\d{4}|present|actual|atual))\)/i;

function normalizeLines(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u2022/g, "-")
    .replace(/[\uF0B7\u2023\u25E6\u2043\u2219]/g, "-")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(function (line) {
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(function (line) {
      return line && !/^page \d+ of \d+$/i.test(line);
    });
}

function headerKey(line) {
  return String(line || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findSection(lines, keys) {
  for (let i = 0; i < lines.length; i += 1) {
    const normalized = headerKey(lines[i]);
    for (let j = 0; j < keys.length; j += 1) {
      const key = keys[j]
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalized === key) {
        return i;
      }
    }
  }
  return -1;
}

function sliceSection(lines, startIndex, endIndex) {
  if (startIndex === -1) {
    return [];
  }
  const end = endIndex === -1 ? lines.length : endIndex;
  return lines.slice(startIndex + 1, end);
}

function allSectionStarts(lines) {
  const starts = [];
  Object.keys(SECTION_HEADERS).forEach(function (name) {
    const index = findSection(lines, SECTION_HEADERS[name]);
    if (index !== -1) {
      starts.push({ name: name, index: index });
    }
  });
  starts.sort(function (a, b) {
    return a.index - b.index;
  });
  return starts;
}

function getSectionLines(lines, name) {
  const starts = allSectionStarts(lines);
  const current = starts.find(function (item) {
    return item.name === name;
  });
  if (!current) {
    return [];
  }
  const next = starts.find(function (item) {
    return item.index > current.index;
  });
  return sliceSection(lines, current.index, next ? next.index : -1);
}

function parseContact(lines) {
  const section = getSectionLines(lines, "contact");
  const blob = section.join(" ").replace(/\s+/g, " ");
  let compactBlob = section.join("").replace(/\s+/g, "");
  compactBlob = compactBlob.replace(/((?:www\.)?linkedin\.com)/i, " $1");
  const emailMatch = compactBlob.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const linkedinMatch = blob.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s)]+/i);
  const phoneMatch = blob.match(/\+?\d[\d\s().-]{7,}\d/);

  let linkedinUrl = "";
  if (linkedinMatch) {
    linkedinUrl = linkedinMatch[0];
    if (!/^https?:\/\//i.test(linkedinUrl)) {
      linkedinUrl = "https://" + linkedinUrl.replace(/^\/\//, "");
    }
    if (!/^https:\/\/www\./i.test(linkedinUrl)) {
      linkedinUrl = linkedinUrl.replace(/^https:\/\//i, "https://www.");
    }
  }

  return {
    email: emailMatch ? emailMatch[0] : "",
    linkedinUrl: linkedinUrl,
    telefone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : "",
  };
}

function parseHeaderBlock(lines) {
  const summaryIndex = findSection(lines, SECTION_HEADERS.summary);
  if (summaryIndex <= 0) {
    return { nome: "", titulo: "", localizacao: "" };
  }

  const candidates = [];
  for (let i = summaryIndex - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (isSectionHeader(line)) {
      break;
    }
    candidates.unshift(line);
    if (candidates.length >= 4) {
      break;
    }
  }

  if (!candidates.length) {
    return { nome: "", titulo: "", localizacao: "" };
  }

  const nome = candidates[0] || "";
  let titulo = "";
  let localizacao = "";

  if (candidates.length === 2) {
    titulo = candidates[1];
  } else if (candidates.length >= 3) {
    titulo = candidates[1];
    localizacao = candidates.slice(2).join(", ");
  }

  return { nome: nome, titulo: titulo, localizacao: localizacao };
}

function isSectionHeader(line) {
  const normalized = headerKey(line);
  return Object.keys(SECTION_HEADERS).some(function (name) {
    return SECTION_HEADERS[name].some(function (key) {
      return (
        normalized ===
        key
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );
    });
  });
}

function parseSkills(lines) {
  return getSectionLines(lines, "skills")
    .filter(function (line) {
      return !isSectionHeader(line) && line.length <= 120;
    })
    .slice(0, 30);
}

function parseLanguages(lines) {
  return getSectionLines(lines, "languages")
    .map(function (line) {
      const match = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(line);
      if (match) {
        return { idioma: match[1].trim(), nivel: match[2].trim() };
      }
      if (line && !isSectionHeader(line)) {
        return { idioma: line, nivel: "" };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 10);
}

function parseSummary(lines) {
  return getSectionLines(lines, "summary")
    .filter(function (line) {
      return !isSectionHeader(line);
    })
    .join(" ")
    .trim();
}

function stripDateDurationSuffix(line) {
  return String(line || "")
    .replace(/\s*[·•|]\s*\d+\s*(?:anos?|months?|meses?|years?).*$/i, "")
    .replace(/\s*\|\s*.*$/, "")
    .trim();
}

function isDateLine(line) {
  return DATE_LINE.test(stripDateDurationSuffix(line));
}

function cleanPeriodo(line) {
  return stripDateDurationSuffix(String(line || ""))
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCargoEmpresa(line) {
  const parts = String(line || "")
    .split(/\s*[·•|]\s*/)
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);
  if (parts.length >= 2) {
    return { empresa: parts[0], cargo: parts[1] };
  }
  return null;
}

function parseExperience(lines) {
  const section = getSectionLines(lines, "experience");
  const dateIndices = [];

  section.forEach(function (line, index) {
    if (isDateLine(line)) {
      dateIndices.push(index);
    }
  });

  if (!dateIndices.length && section.length) {
    return parseExperienceFallback(section);
  }

  return dateIndices
    .map(function (dateIndex, itemIndex) {
      const lineBeforeDate = section[dateIndex - 1] || "";
      const lineBeforeThat = section[dateIndex - 2] || "";
      const combined = splitCargoEmpresa(lineBeforeDate) || splitCargoEmpresa(lineBeforeThat);
      let empresa = "";
      let cargo = "";

      if (combined) {
        empresa = combined.empresa;
        cargo = combined.cargo;
      } else {
        cargo = lineBeforeDate;
        empresa = lineBeforeThat;
      }

      const nextDateIndex =
        itemIndex + 1 < dateIndices.length ? dateIndices[itemIndex + 1] : section.length;
      const tail = section.slice(dateIndex + 1, nextDateIndex).filter(function (line) {
        return line && !isSectionHeader(line);
      });

      let local = "";
      const descricaoParts = [];
      for (let tailIndex = 0; tailIndex < tail.length; tailIndex += 1) {
        const line = tail[tailIndex];
        const absoluteIndex = dateIndex + 1 + tailIndex;
        const nextLine = section[absoluteIndex + 1];
        if (nextLine && isDateLine(nextLine)) {
          break;
        }
        if (
          tailIndex === 0 &&
          line.length <= 120 &&
          !/^https?:\/\//i.test(line) &&
          !/^[-•]/.test(line) &&
          !isDateLine(line)
        ) {
          local = line;
          continue;
        }
        descricaoParts.push(line);
      }

      return {
        empresa: empresa,
        cargo: cargo,
        periodo: cleanPeriodo(section[dateIndex]),
        local: local,
        descricao: descricaoParts.join(" ").trim(),
      };
    })
    .filter(function (item) {
      return item.empresa || item.cargo;
    })
    .slice(0, 20);
}

function parseExperienceFallback(section) {
  const blocks = [];
  let current = [];

  section.forEach(function (line) {
    if (!line || isSectionHeader(line)) {
      return;
    }
    if (isDateLine(line) && current.length) {
      blocks.push(current);
      current = [line];
      return;
    }
    if (isDateLine(line)) {
      current = [line];
      return;
    }
    current.push(line);
  });

  if (current.length) {
    blocks.push(current);
  }

  return blocks
    .map(function (block) {
      const dateIndex = block.findIndex(function (line) {
        return isDateLine(line);
      });
      if (dateIndex === -1) {
        return null;
      }

      const beforeDate = block.slice(0, dateIndex);
      const afterDate = block.slice(dateIndex + 1);
      let empresa = "";
      let cargo = "";

      if (beforeDate.length === 1) {
        const split = splitCargoEmpresa(beforeDate[0]);
        if (split) {
          empresa = split.empresa;
          cargo = split.cargo;
        } else {
          cargo = beforeDate[0];
        }
      } else if (beforeDate.length >= 2) {
        empresa = beforeDate[beforeDate.length - 2];
        cargo = beforeDate[beforeDate.length - 1];
        const combined = splitCargoEmpresa(cargo);
        if (combined) {
          empresa = combined.empresa;
          cargo = combined.cargo;
        }
      }

      let local = "";
      const descricaoParts = [];
      afterDate.forEach(function (line, tailIndex) {
        if (
          tailIndex === 0 &&
          line.length <= 120 &&
          !/^https?:\/\//i.test(line) &&
          !/^[-•]/.test(line) &&
          !isDateLine(line)
        ) {
          local = line;
          return;
        }
        descricaoParts.push(line);
      });

      return {
        empresa: empresa,
        cargo: cargo,
        periodo: cleanPeriodo(block[dateIndex]),
        local: local,
        descricao: descricaoParts.join(" ").trim(),
      };
    })
    .filter(function (item) {
      return item && (item.empresa || item.cargo);
    })
    .slice(0, 20);
}

function parseEducation(lines) {
  const section = getSectionLines(lines, "education");
  const items = [];
  let current = null;

  section.forEach(function (line) {
    if (isSectionHeader(line)) {
      return;
    }

    const periodMatch =
      PERIOD_IN_PARENS.exec(line) || /\((\d{4})\)\s*$/.exec(line);
    if (current && periodMatch) {
      current.periodo = periodMatch[1].replace(/\s+/g, " ");
      let curso = line.replace(PERIOD_IN_PARENS, "").replace(/\(\d{4}\)\s*$/, "").trim();
      curso = curso.replace(/^[^:]+:\s*/, "").replace(/\s*·\s*/g, ", ").replace(/,\s*$/, "").trim();
      if (curso) {
        current.curso = curso;
      }
      items.push(current);
      current = null;
      return;
    }

    if (/^\(\d{4}\)$/.test(line) && current) {
      current.periodo = line.replace(/[()]/g, "");
      items.push(current);
      current = null;
      return;
    }

    if (!current) {
      current = { instituicao: line, curso: "", periodo: "" };
      return;
    }

    if (!current.curso) {
      current.curso = line.replace(/\s*·\s*/g, ", ").trim();
      return;
    }

    items.push(current);
    current = { instituicao: line, curso: "", periodo: "" };
  });

  if (current && (current.instituicao || current.curso)) {
    items.push(current);
  }

  return items.slice(0, 15);
}

function normalizeLinkedInUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (/^linkedin\.com\//i.test(value)) {
    return "https://www." + value;
  }
  if (/^www\.linkedin\.com\//i.test(value)) {
    return "https://" + value;
  }
  return value;
}

function parseLinkedInPdfText(text) {
  const lines = normalizeLines(text);
  if (!lines.length) {
    return { ok: false, error: "O PDF não contém texto legível." };
  }

  const contact = parseContact(lines);
  const header = parseHeaderBlock(lines);
  const resumo = parseSummary(lines);
  const competencias = parseSkills(lines);
  const idiomas = parseLanguages(lines);
  const experiencias = parseExperience(lines);
  const formacao = parseEducation(lines);

  const nome = header.nome || lines[0] || "";
  if (nome.length < 2) {
    return {
      ok: false,
      error:
        "Não foi possível identificar os dados no PDF. Use o export «Guardar como PDF» do LinkedIn ou preencha manualmente.",
    };
  }

  return {
    ok: true,
    perfil: {
      nome: nome,
      titulo: header.titulo,
      localizacao: header.localizacao,
      email: contact.email,
      telefone: contact.telefone,
      linkedinUrl: normalizeLinkedInUrl(contact.linkedinUrl),
      resumo: resumo,
      competencias: competencias,
      idiomas: idiomas,
      experiencias: experiencias,
      formacao: formacao,
      fotoDataUrl: null,
    },
    imported: {
      experiencias: experiencias.length,
      formacao: formacao.length,
      competencias: competencias.length,
      idiomas: idiomas.length,
      foto: false,
    },
  };
}

async function importCurriculoPdfBuffer(buffer) {
  if (!buffer || !buffer.length) {
    return { ok: false, error: "Envie um ficheiro PDF." };
  }
  if (buffer.length > 2 * 1024 * 1024) {
    return { ok: false, error: "O PDF deve ter no máximo 2 MB." };
  }

  let parsed;
  try {
    parsed = await pdf(buffer);
  } catch (_err) {
    return { ok: false, error: "Não foi possível ler o PDF. Verifique se o ficheiro não está corrompido." };
  }

  const text = String(parsed.text || "").trim();
  if (text.length < 40) {
    return {
      ok: false,
      error: "O PDF parece ser uma imagem digitalizada. Exporte o perfil em PDF com texto selecionável (LinkedIn → Mais → Salvar como PDF).",
    };
  }

  return parseLinkedInPdfText(text);
}

async function importCurriculoPdfDataUrl(dataUrl) {
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || "").trim());
  if (!match) {
    return { ok: false, error: "Formato inválido. Envie um ficheiro PDF." };
  }
  const buffer = Buffer.from(match[1], "base64");
  return importCurriculoPdfBuffer(buffer);
}

module.exports = {
  parseLinkedInPdfText,
  importCurriculoPdfBuffer,
  importCurriculoPdfDataUrl,
};

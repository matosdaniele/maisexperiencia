"use strict";

/**
 * Lógica pura de lembretes de medicação (sem dependências, sem I/O).
 * Usada pelo backend (scripts/api-server.js) e pelo script de verificação.
 * Também exposta no browser como window.ME_MEDICACAO caso venha a ter UI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ME_MEDICACAO = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var HORARIO_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  var MAX_HORARIOS = 12;
  var TZ_PADRAO = "America/Sao_Paulo";
  var DIAS_ABREV = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function normalizarHorario(valor) {
    var texto = String(valor == null ? "" : valor).trim();
    if (!HORARIO_RE.test(texto)) return null;
    return texto;
  }

  function normalizarHorarios(lista) {
    if (!Array.isArray(lista)) return [];
    var vistos = {};
    var out = [];
    for (var i = 0; i < lista.length; i += 1) {
      var h = normalizarHorario(lista[i]);
      if (h && !vistos[h]) {
        vistos[h] = true;
        out.push(h);
      }
    }
    out.sort();
    return out;
  }

  /**
   * Normaliza os dias da semana.
   * Aceita: "todos" | [] (=> "todos") | array de 0-6 (0=domingo).
   * Retorna "todos" ou array ordenado sem repetições, ou null se inválido.
   */
  function normalizarDiasSemana(valor) {
    if (valor === "todos" || valor == null || valor === "") return "todos";
    if (!Array.isArray(valor)) return null;
    if (!valor.length) return "todos";
    var vistos = {};
    var out = [];
    for (var i = 0; i < valor.length; i += 1) {
      var n = Number(valor[i]);
      if (!Number.isInteger(n) || n < 0 || n > 6) return null;
      if (!vistos[n]) {
        vistos[n] = true;
        out.push(n);
      }
    }
    out.sort(function (a, b) {
      return a - b;
    });
    if (out.length === 7) return "todos";
    return out;
  }

  function validarMedicamento(body) {
    var origem = body || {};
    var nome = String(origem.nome == null ? "" : origem.nome).trim();
    var dose = String(origem.dose == null ? "" : origem.dose).trim();
    var instrucoes = String(origem.instrucoes == null ? "" : origem.instrucoes).trim();

    if (nome.length < 2 || nome.length > 80) {
      return { ok: false, error: "Informe o nome do medicamento (2 a 80 caracteres)." };
    }
    if (dose.length > 80) {
      return { ok: false, error: "A dose deve ter no máximo 80 caracteres." };
    }
    if (instrucoes.length > 200) {
      return { ok: false, error: "As instruções devem ter no máximo 200 caracteres." };
    }

    var horarios = normalizarHorarios(origem.horarios);
    if (!horarios.length) {
      return { ok: false, error: "Adicione pelo menos um horário no formato HH:MM." };
    }
    if (horarios.length > MAX_HORARIOS) {
      return { ok: false, error: "Máximo de " + MAX_HORARIOS + " horários por medicamento." };
    }

    var diasSemana = normalizarDiasSemana(origem.diasSemana);
    if (diasSemana === null) {
      return { ok: false, error: "Dias da semana inválidos (use 0 a 6, ou \"todos\")." };
    }

    var ativo = origem.ativo === false ? false : true;

    return {
      ok: true,
      value: {
        nome: nome,
        dose: dose,
        instrucoes: instrucoes,
        horarios: horarios,
        diasSemana: diasSemana,
        ativo: ativo,
      },
    };
  }

  /**
   * Extrai as partes locais (fuso informado) de uma data:
   * { dataRef: "YYYY-MM-DD", hhmm: "HH:MM", diaSemana: 0-6 }.
   */
  function partesLocais(date, tz) {
    var quando = date || new Date();
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || TZ_PADRAO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    var mapa = {};
    fmt.formatToParts(quando).forEach(function (parte) {
      mapa[parte.type] = parte.value;
    });
    var hora = mapa.hour === "24" ? "00" : mapa.hour;
    return {
      dataRef: mapa.year + "-" + mapa.month + "-" + mapa.day,
      hhmm: hora + ":" + mapa.minute,
      diaSemana: DIAS_ABREV[mapa.weekday],
    };
  }

  /** true se o medicamento deve ser lembrado no minuto/dia representado por `partes`. */
  function estaDevido(med, partes) {
    if (!med || med.ativo === false) return false;
    if (!partes) return false;
    var horarios = med.horarios || [];
    if (horarios.indexOf(partes.hhmm) === -1) return false;
    var dias = med.diasSemana;
    if (dias === "todos" || dias == null) return true;
    if (Array.isArray(dias)) return dias.indexOf(partes.diaSemana) !== -1;
    return true;
  }

  return {
    HORARIO_RE: HORARIO_RE,
    MAX_HORARIOS: MAX_HORARIOS,
    TZ_PADRAO: TZ_PADRAO,
    normalizarHorario: normalizarHorario,
    normalizarHorarios: normalizarHorarios,
    normalizarDiasSemana: normalizarDiasSemana,
    validarMedicamento: validarMedicamento,
    partesLocais: partesLocais,
    estaDevido: estaDevido,
  };
});

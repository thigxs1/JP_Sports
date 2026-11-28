/* JP Sport · Lista de atletas do pedido (nome, número e tamanho).
   Cada atleta gera um jogo de peças no pacote de impressão. Navegador e Node. */
(function (raiz) {
  "use strict";

  var TAMANHOS = ["P", "M", "G", "GG", "XG", "Infantil"];
  var LIMITE = 200;
  var NOME_MAX = 15;
  var NUMERO_MAX = 3;

  function texto(v) { return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim(); }
  function tamanhoValido(t) {
    var s = texto(t).toLowerCase();
    if (s === "inf") s = "infantil";
    return TAMANHOS.find(function (x) { return x.toLowerCase() === s; }) || null;
  }

  function normalizarAtleta(bruto) {
    var b = bruto || {};
    var nome = texto(b.nome).toUpperCase(), numero = texto(b.numero), tam = texto(b.tamanho);
    if (!nome && !numero) return { ok: false, erro: "informe nome ou número" };
    if (Array.from(nome).length > NOME_MAX) return { ok: false, erro: "nome com mais de " + NOME_MAX + " caracteres" };
    if (numero && !/^\d+$/.test(numero)) return { ok: false, erro: "número só com dígitos" };
    if (numero.length > NUMERO_MAX) return { ok: false, erro: "número com mais de " + NUMERO_MAX + " dígitos" };
    if (!tam) return { ok: false, erro: "tamanho ausente" };
    var tamanho = tamanhoValido(tam);
    if (!tamanho) return { ok: false, erro: "tamanho " + tam + " não existe" };
    return { ok: true, atleta: { nome: nome, numero: numero, tamanho: tamanho } };
  }

  /* Uma linha por atleta: "nome; número; tamanho" (aceita ; , ou tab). */
  function lerColado(textoColado) {
    var atletas = [], erros = [];
    String(textoColado || "").split(/\r?\n/).forEach(function (linha, i) {
      if (!linha.trim()) return;
      var partes = linha.split(/[;\t,]/);
      var r = normalizarAtleta({ nome: partes[0], numero: partes[1], tamanho: partes[2] });
      if (!r.ok) { erros.push({ linha: i + 1, motivo: r.erro }); return; }
      if (atletas.length >= LIMITE) { erros.push({ linha: i + 1, motivo: "limite de " + LIMITE + " atletas por pedido" }); return; }
      atletas.push(r.atleta);
    });
    return { atletas: atletas, erros: erros };
  }

  function gradeDeAtletas(atletas) {
    var g = {};
    TAMANHOS.forEach(function (t) { g[t] = 0; });
    (atletas || []).forEach(function (a) { if (Object.prototype.hasOwnProperty.call(g, a.tamanho)) g[a.tamanho]++; });
    return g;
  }

  function avisos(atletas) {
    var vistos = {}, saida = [];
    (atletas || []).forEach(function (a) {
      var n = texto(a.numero);
      if (!n) return;
      if (vistos[n] === 1) saida.push("Número " + n + " repetido");
      vistos[n] = (vistos[n] || 0) + 1;
    });
    return saida;
  }

  var JPAtletas = {
    TAMANHOS: TAMANHOS, LIMITE: LIMITE, normalizarAtleta: normalizarAtleta, lerColado: lerColado,
    gradeDeAtletas: gradeDeAtletas, avisos: avisos
  };
  raiz.JPAtletas = JPAtletas;
  if (typeof module !== "undefined" && module.exports) module.exports = JPAtletas;
})(typeof window !== "undefined" ? window : globalThis);

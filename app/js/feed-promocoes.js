/* JP Sport · Feed de promoções da home.
   Também expõe o card em window.JPFeedPromocoes, usado na prévia do painel. */
(function () {
  "use strict";
  var MODALIDADES = { futebol: "Futebol", basquete: "Basquete", volei: "Vôlei" };
  var LINK_PADRAO = "orcamento.html";
  var ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function texto(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function esc(v) { return texto(v).replace(/[&<>"']/g, function (c) { return ENTIDADES[c]; }); }

  /* Aceita caminhos relativos e http/https; devolve null para o resto
     (javascript:, data:, //host, barras invertidas, espaços e controles). */
  function linkSeguro(v) {
    var s = texto(v);
    if (!s || /[\s\x00-\x1f\x7f\\]/.test(s) || s.indexOf("//") === 0) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
    if (!/^https?:\/\//i.test(s)) return null;
    try { return new URL(s).href; } catch (e) { return null; }
  }
  function hojeLocal() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function validade(p) { return texto(p.valida_ate).slice(0, 10); }
  function expirada(p) { return !!validade(p) && validade(p) < hojeLocal(); }
  function dataBR(v) { return texto(v).slice(0, 10).split("-").reverse().join("/"); }
  function nomeModalidade(m) {
    return Object.prototype.hasOwnProperty.call(MODALIDADES, m) ? MODALIDADES[m] : "Todas as modalidades";
  }
  function ordenar(dados) {
    return dados.slice().sort(function (a, b) { return (Number(a.ordem) || 0) - (Number(b.ordem) || 0); });
  }

  function cardHTML(p) {
    return '<article class="promo-card">' +
      '<div class="promo-topo">' + (texto(p.badge) ? '<span class="tag cheia">' + esc(p.badge) + "</span>" : "") +
      '<span class="promo-modalidade">' + esc(nomeModalidade(p.modalidade)) + "</span></div>" +
      (texto(p.desconto_texto) ? '<p class="promo-desconto">' + esc(p.desconto_texto) + "</p>" : "") +
      '<h3 class="t-h3">' + esc(p.titulo) + "</h3>" +
      (texto(p.subtitulo) ? '<p class="promo-sub">' + esc(p.subtitulo) + "</p>" : "") +
      '<div class="promo-pe"><a class="btn btn-acao" href="' + esc(linkSeguro(p.cta_link) || LINK_PADRAO) + '">' +
      esc(texto(p.cta_texto) || "Aproveitar") + ' <span class="seta" aria-hidden="true">→</span></a>' +
      (validade(p) ? "<small>Válida até " + esc(dataBR(validade(p))) + "</small>" : "") +
      "</div></article>";
  }

  async function carregar() {
    var secao = document.getElementById("promocoes");
    var lista = document.getElementById("promocoes-lista");
    if (!secao || !lista) return; // no painel só os auxiliares são usados
    try {
      var r = await window.JP_DB.listarPromocoes({ apenasAtivas: true });
      if (!r.ok) throw new Error(r.erro || "erro desconhecido");
      var validas = ordenar(r.dados.filter(function (p) { return p.ativa && !expirada(p); }));
      lista.innerHTML = validas.map(cardHTML).join("");
      secao.hidden = !validas.length;
    } catch (e) {
      console.warn("[feed-promocoes]", e);
      secao.hidden = true;
    }
  }

  window.JPFeedPromocoes = {
    cardHTML: cardHTML, linkSeguro: linkSeguro, expirada: expirada,
    dataBR: dataBR, nomeModalidade: nomeModalidade, ordenar: ordenar
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", carregar);
  else carregar();
})();

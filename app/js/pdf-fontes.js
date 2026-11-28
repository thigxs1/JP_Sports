/* JP Sport · Fontes incorporadas no PDF de impressão (TTF em app/assets/fontes, licença OFL).
   Cada família/peso é registrada no jsPDF com um nome único sem espaços (JPMontserrat900),
   porque o context2d do jsPDF não lê pesos numéricos. Navegador e Node. */
(function (raiz) {
  "use strict";

  var FONTES_TTF = {
    "Montserrat": { "900": "Montserrat-Black.ttf", "800": "Montserrat-ExtraBold.ttf" },
    "Bebas Neue": { "400": "BebasNeue-Regular.ttf" },
    "Teko": { "600": "Teko-SemiBold.ttf" },
    "Graduate": { "400": "Graduate-Regular.ttf" },
    "Anton": { "400": "Anton-Regular.ttf" },
    "JetBrains Mono": { "500": "JetBrainsMono-Medium.ttf" }
  };
  var PADRAO = { familia: "Montserrat", peso: "800" };
  // o context2d do jsPDF não aceita dígitos no nome da família
  var NOMES_PESO = { "400": "Regular", "500": "Medium", "600": "SemiBold", "800": "ExtraBold", "900": "Black" };

  function nomeInterno(familia, peso) {
    var pesos = FONTES_TTF[familia];
    if (!pesos) { familia = PADRAO.familia; peso = PADRAO.peso; pesos = FONTES_TTF[familia]; }
    if (!pesos[peso]) peso = Object.keys(pesos)[0];
    return "JP" + familia.replace(/\s+/g, "") + (NOMES_PESO[peso] || "Regular");
  }

  /* carregarTTF(arquivo) -> Promise<string base64> (fetch no navegador, fs no Node). */
  async function registrarFontes(doc, carregarTTF) {
    var pares = [];
    Object.keys(FONTES_TTF).forEach(function (f) {
      Object.keys(FONTES_TTF[f]).forEach(function (p) { pares.push([f, p, FONTES_TTF[f][p]]); });
    });
    var dados = await Promise.all(pares.map(function (x) { return carregarTTF(x[2]); }));
    pares.forEach(function (x, i) {
      doc.addFileToVFS(x[2], dados[i]);
      doc.addFont(x[2], nomeInterno(x[0], x[1]), "normal");
    });
  }

  /* Fonte no formato que o doc.context2d entende; tamanho em unidades do documento (mm). */
  function fontePDF(familia, peso, tamanho) {
    return "normal " + tamanho + "px " + nomeInterno(familia, peso);
  }

  function glifoSuportado(doc, familia, peso, ch) {
    try {
      var f = doc.internal.getFont(nomeInterno(familia, peso), "normal");
      var meta = f && f.metadata;
      if (!meta || !meta.characterToGlyph) return true;
      return meta.characterToGlyph(String(ch).codePointAt(0)) > 0;
    } catch (e) { return true; }
  }

  /* Quadrado de 100 × 100 mm com legenda, para conferir a escala no RIP. */
  function quadradoControle(doc, x, y) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(x, y, 100, 100);
    doc.setFont(nomeInterno("Montserrat", "800"), "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("100 x 100 mm · ESCALA 1:1", x + 50, y + 50, { align: "center", baseline: "middle" });
  }

  /* Opacidade no PDF: o context2d ignora globalAlpha, o ExtGState do jsPDF funciona. */
  function alfaPDF(doc) {
    var cache = {};
    return function (a) {
      var k = String(a);
      if (!cache[k]) cache[k] = new doc.GState({ opacity: a });
      doc.setGState(cache[k]);
    };
  }

  var JPPdfFontes = {
    FONTES_TTF: FONTES_TTF, nomeInterno: nomeInterno, registrarFontes: registrarFontes,
    fontePDF: fontePDF, alfaPDF: alfaPDF, glifoSuportado: glifoSuportado, quadradoControle: quadradoControle
  };
  raiz.JPPdfFontes = JPPdfFontes;
  if (typeof module !== "undefined" && module.exports) module.exports = JPPdfFontes;
})(typeof window !== "undefined" ? window : globalThis);

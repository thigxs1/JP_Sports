/* JP Sport · Posicionamento livre da arte no simulador.
   O cliente escolhe um elemento (marca, escudo, patrocínio, nome, número), arrasta sobre o
   contorno real da peça do molde (tamanho M) e ajusta o tamanho. O layout resultante (cm, a
   partir do decote) é o mesmo que o 3D e o PDF de impressão usam (js/arte-pecas.js). */
(function (raiz) {
  "use strict";
  var Arte = raiz.JPArtePecas || (typeof require === "function" ? require("./arte-pecas.js") : null);

  var LIMITES = Arte.LIMITES;
  var NOMES = { marca: "Marca JP", escudo: "Escudo", patrocinio: "Patrocínio", nome: "Nome", numero: "Número" };
  var PECAS = { frente: "Frente", costas: "Costas", "manga-esquerda": "Manga esq.", "manga-direita": "Manga dir." };

  function clonar(layout) { return JSON.parse(JSON.stringify(layout)); }
  function achar(layout, id) { return layout.elementos.find(function (e) { return e.id === id; }); }
  function pecaDe(molde, id) { return molde.pecas.find(function (p) { return p.id === id; }); }
  function arred(v) { return Math.round(v * 10) / 10; }

  /* Move em cm; o centro do elemento fica sempre dentro da caixa da peça. */
  function moverElemento(layout, id, dxCm, dyCm, molde) {
    var novo = clonar(layout), el = achar(novo, id);
    if (!el) return novo;
    var peca = pecaDe(molde, el.peca);
    el.dx = arred(el.dx + dxCm);
    el.dy = arred(el.dy + dyCm);
    if (peca) {
      var y0 = el.ancora === "centro" ? peca.altura / 2 : peca.pontos.decote[1];
      // limites arredondados para dentro, para o arredondamento não empurrar para fora da peça
      var dentro = function (v, min, max) { return Math.min(Math.max(v, Math.ceil(min * 10) / 10), Math.floor(max * 10) / 10); };
      el.dx = dentro(el.dx, -peca.pontos.centro / 10, (peca.largura - peca.pontos.centro) / 10);
      el.dy = dentro(el.dy, -y0 / 10, (peca.altura - y0) / 10);
    }
    return novo;
  }
  function redimensionar(layout, id, larguraCm) {
    var novo = clonar(layout), el = achar(novo, id), lim = LIMITES[id] || [1, 60];
    if (el) el.largura = arred(Math.min(Math.max(Number(larguraCm) || lim[0], lim[0]), lim[1]));
    return novo;
  }
  function passoTeclado(tecla, shift) {
    var p = shift ? 2 : 0.5;
    return { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[tecla] || null;
  }
  function dimensoesEscudo(w, h, max) {
    var m = max || 1500, k = Math.min(1, m / Math.max(w, h));
    return { w: Math.round(w * k), h: Math.round(h * k) };
  }
  function avisos(layout, molde, mm) {
    return layout.elementos.filter(function (el) {
      var p = pecaDe(molde, el.peca);
      return p && Arte.foraDaAreaSegura(el, p, mm);
    }).map(function (el) { return { id: el.id, texto: "Muito perto da costura" }; });
  }

  /* ---------- Interface ---------- */
  var SVG = "http://www.w3.org/2000/svg";
  function no(tag, atributos, filhos) {
    var e = document.createElementNS(SVG, tag);
    Object.keys(atributos || {}).forEach(function (k) { e.setAttribute(k, atributos[k]); });
    (filhos || []).forEach(function (f) { e.appendChild(f); });
    return e;
  }
  function html(tag, atributos, texto) {
    var e = document.createElement(tag);
    Object.keys(atributos || {}).forEach(function (k) { e.setAttribute(k, atributos[k]); });
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  /* opcoes: { molde, layout, aoMudar(layout), areaSegura (mm, padrão 20) } */
  function iniciar(raizDom, opcoes) {
    var molde = opcoes.molde, area = opcoes.areaSegura || 20;
    var layout = Arte.normalizarLayout(opcoes.layout, molde.modelo);
    var ativo = "escudo";
    raizDom.textContent = "";

    var botoes = html("div", { class: "pos-elementos", role: "radiogroup", "aria-label": "Elemento da arte" });
    Arte.ELEMENTOS.forEach(function (id) {
      var b = html("button", { type: "button", class: "pos-el", "data-el": id, role: "radio" }, NOMES[id]);
      b.addEventListener("click", function () { ativo = id; render(); svg.focus({ preventScroll: true }); });
      botoes.appendChild(b);
    });
    var svg = no("svg", { class: "pos-svg", tabindex: "0", role: "application",
      "aria-label": "Peça do molde. Arraste o elemento ou use as setas (Shift para passos maiores)." });
    var rotTam = html("label", { for: "posTamanho" });
    var tamanho = html("input", { type: "range", id: "posTamanho", step: "0.5" });
    var aviso = html("p", { class: "pos-aviso", role: "status" });
    var resetar = html("button", { type: "button", class: "pos-reset" }, "Voltar ao padrão");
    var linha = html("div", { class: "pos-tamanho" });
    linha.appendChild(rotTam); linha.appendChild(tamanho);
    [botoes, svg, linha, aviso, resetar].forEach(function (e) { raizDom.appendChild(e); });

    function mudar(novo) { layout = novo; render(); opcoes.aoMudar(clonar(layout)); }
    tamanho.addEventListener("input", function () { mudar(redimensionar(layout, ativo, tamanho.value)); });
    resetar.addEventListener("click", function () { mudar(Arte.layoutPadrao(molde.modelo)); });
    svg.addEventListener("keydown", function (e) {
      var p = passoTeclado(e.key, e.shiftKey);
      if (!p) return;
      e.preventDefault();
      mudar(moverElemento(layout, ativo, p[0], p[1], molde));
    });

    var arrasto = null;
    function pontoSvg(e) {
      var m = svg.getScreenCTM();
      if (!m) return null;
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(m.inverse());
    }
    svg.addEventListener("pointerdown", function (e) {
      var alvo = e.target.closest && e.target.closest("[data-el]");
      if (alvo) ativo = alvo.getAttribute("data-el");
      var p = pontoSvg(e);
      if (!p) return;
      arrasto = { x: p.x, y: p.y, layout: layout };
      svg.setPointerCapture(e.pointerId);
      render();
    });
    svg.addEventListener("pointermove", function (e) {
      if (!arrasto) return;
      var p = pontoSvg(e);
      if (!p) return;
      layout = moverElemento(arrasto.layout, ativo, (p.x - arrasto.x) / 10, (p.y - arrasto.y) / 10, molde);
      render();
      // 3D ao vivo durante o arrasto, no máximo uma vez por quadro
      if (!arrasto.quadro) arrasto.quadro = requestAnimationFrame(function () { if (arrasto) arrasto.quadro = 0; opcoes.aoMudar(clonar(layout)); });
    });
    function soltar() { if (arrasto) { arrasto = null; opcoes.aoMudar(clonar(layout)); } }
    svg.addEventListener("pointerup", soltar);
    svg.addEventListener("pointercancel", soltar);

    function render() {
      var el = achar(layout, ativo), peca = pecaDe(molde, el.peca);
      botoes.querySelectorAll("[data-el]").forEach(function (b) {
        b.setAttribute("aria-checked", String(b.getAttribute("data-el") === ativo));
        b.classList.toggle("active", b.getAttribute("data-el") === ativo);
      });
      svg.setAttribute("viewBox", [-20, -20, peca.largura + 40, peca.altura + 40].join(" "));
      svg.textContent = "";
      svg.appendChild(no("polygon", { class: "pos-contorno", points: peca.contorno.map(function (q) { return q.join(","); }).join(" ") }));
      svg.appendChild(no("text", { x: 10, y: peca.altura - 12, class: "pos-peca" }, [document.createTextNode(PECAS[peca.id] + " · molde M")]));
      var ruins = avisos(layout, molde, area).map(function (a) { return a.id; });
      layout.elementos.filter(function (e) { return e.peca === peca.id; }).forEach(function (e) {
        var pos = Arte.posicao(e, peca), h = Arte.alturaElemento(e);
        svg.appendChild(no("g", { "data-el": e.id, class: "pos-item" + (e.id === ativo ? " ativo" : "") + (ruins.indexOf(e.id) >= 0 ? " ruim" : "") }, [
          no("rect", { x: pos.x - pos.largura / 2, y: pos.y - h / 2, width: pos.largura, height: h }),
          no("text", { x: pos.x, y: pos.y, "text-anchor": "middle", "dominant-baseline": "middle" }, [document.createTextNode(NOMES[e.id])])
        ]));
      });
      var lim = LIMITES[ativo];
      tamanho.min = lim[0]; tamanho.max = lim[1]; tamanho.value = el.largura;
      rotTam.textContent = "Tamanho de " + NOMES[ativo] + ": " + String(el.largura).replace(".", ",") + " cm";
      aviso.textContent = ruins.indexOf(ativo) >= 0 ? NOMES[ativo] + ": muito perto da costura. Afaste da borda da peça." : "";
    }
    render();
    return { definirLayout: function (l) { layout = Arte.normalizarLayout(l, molde.modelo); render(); } };
  }

  var JPEditorPosicao = {
    LIMITES: LIMITES, moverElemento: moverElemento, redimensionar: redimensionar, passoTeclado: passoTeclado,
    dimensoesEscudo: dimensoesEscudo, avisos: avisos, iniciar: iniciar
  };
  raiz.JPEditorPosicao = JPEditorPosicao;
  if (typeof module !== "undefined" && module.exports) module.exports = JPEditorPosicao;
})(typeof window !== "undefined" ? window : globalThis);

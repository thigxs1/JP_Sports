/* JP Sport · Arte do uniforme desenhada por peça do molde, em milímetros.
   O mesmo código pinta a textura do 3D (com a calibração afim mm → px de UV) e o
   PDF de impressão (via doc.context2d do jsPDF): qualquer ctx com a API do Canvas 2D.
   Posição dos elementos em cm, presa a uma âncora da peça (decote ou centro), com
   o mesmo tamanho em todos os tamanhos de molde. Funciona no navegador e no Node. */
(function (raiz) {
  "use strict";

  var ELEMENTOS = ["marca", "escudo", "patrocinio", "nome", "numero"];

  /* Padrão derivado das posições fixas do 3D (drawPlayerDetails em app.js), convertidas
     de px da textura 2048 para cm com ~0,72 mm/px na frente e ~0,52 mm/px nas costas.
     A Task 5 confere o resultado no 3D. */
  var PADRAO = {
    "camiseta-basica": [
      { id: "marca", peca: "frente", ancora: "decote", dx: -9, dy: 9, largura: 6 },
      { id: "escudo", peca: "frente", ancora: "decote", dx: 9, dy: 9, largura: 9 },
      { id: "patrocinio", peca: "frente", ancora: "decote", dx: 0, dy: 23, largura: 30 },
      { id: "nome", peca: "costas", ancora: "decote", dx: 0, dy: 12, largura: 23 },
      { id: "numero", peca: "costas", ancora: "decote", dx: 0, dy: 25, largura: 22 }
    ]
  };
  /* Altura do texto como fração da largura do elemento (mesmas proporções do 3D). */
  var ALTURA_TEXTO = { marca: 0.6, patrocinio: 0.132, nome: 0.141, numero: 0.62 };
  var ENCOLHE_ATE = 0.6; // como escreveAjustado: reduz até 60% antes de comprimir
  var PESOS_CAMISA = { "Montserrat": "900", "Bebas Neue": "400", "Teko": "600", "Graduate": "400" };

  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function layoutPadrao(modelo) {
    return { modelo: modelo, base: "M", elementos: copia(PADRAO[modelo] || PADRAO["camiseta-basica"]) };
  }
  /* Layout salvo no projeto, completado com o padrão para elementos ausentes ou inválidos. */
  function normalizarLayout(layout, modelo) {
    var padrao = layoutPadrao(modelo);
    var salvos = layout && Array.isArray(layout.elementos) ? layout.elementos : [];
    padrao.elementos = padrao.elementos.map(function (p) {
      var s = salvos.find(function (e) { return e && e.id === p.id; });
      if (!s) return p;
      var n = Object.assign({}, p);
      ["dx", "dy", "largura"].forEach(function (k) { if (isFinite(Number(s[k]))) n[k] = Number(s[k]); });
      if (typeof s.peca === "string") n.peca = s.peca;
      if (s.ancora === "centro" || s.ancora === "decote") n.ancora = s.ancora;
      return n;
    });
    return padrao;
  }

  function posicao(el, peca) {
    var y0 = el.ancora === "centro" ? peca.altura / 2 : peca.pontos.decote[1];
    return { x: peca.pontos.centro + el.dx * 10, y: y0 + el.dy * 10, largura: el.largura * 10 };
  }
  function alturaElemento(el) {
    return el.id === "escudo" ? el.largura * 10 : el.largura * 10 * (ALTURA_TEXTO[el.id] || 0.2);
  }

  /* ---------- Geometria ---------- */
  function areaAssinada(c) {
    var s = 0;
    for (var i = 0; i < c.length - 1; i++) s += c[i][0] * c[i + 1][1] - c[i + 1][0] * c[i][1];
    return s / 2;
  }
  /* Desloca o contorno fechado para fora em `mm` (junta em meia-esquadria, limitada a 2×). */
  function expandirContorno(contorno, mm) {
    var pts = contorno.slice(0, -1), n = pts.length;
    if (!mm || n < 3) return contorno.slice();
    var sinal = areaAssinada(contorno) > 0 ? 1 : -1;
    var saida = pts.map(function (p, i) {
      var a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      function normal(u, v) {
        var dx = v[0] - u[0], dy = v[1] - u[1], l = Math.hypot(dx, dy) || 1;
        return [sinal * dy / l, -sinal * dx / l];
      }
      var n1 = normal(a, p), n2 = normal(p, b);
      var mx = n1[0] + n2[0], my = n1[1] + n2[1], ml = Math.hypot(mx, my);
      if (ml < 1e-6) return [p[0] + n1[0] * mm, p[1] + n1[1] * mm];
      mx /= ml; my /= ml;
      var cos = mx * n1[0] + my * n1[1];
      var d = Math.min(mm / Math.max(cos, 1e-6), mm * 2);
      return [p[0] + mx * d, p[1] + my * d];
    });
    saida.push(saida[0]);
    return saida;
  }
  function dentroPoligono(p, c) {
    var dentro = false;
    for (var i = 0, j = c.length - 2; i < c.length - 1; j = i++) {
      var a = c[i], b = c[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) dentro = !dentro;
    }
    return dentro;
  }
  function distSegmento(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function distContorno(p, c) {
    var m = Infinity;
    for (var i = 0; i < c.length - 1; i++) m = Math.min(m, distSegmento(p, c[i], c[i + 1]));
    return m;
  }
  /* true se algum canto da caixa do elemento sai da peça ou fica a menos de `mm` do contorno. */
  function foraDaAreaSegura(el, peca, mm) {
    var c = posicao(el, peca), w = c.largura / 2, h = alturaElemento(el) / 2;
    return [[c.x - w, c.y - h], [c.x + w, c.y - h], [c.x + w, c.y + h], [c.x - w, c.y + h], [c.x, c.y]].some(function (p) {
      return !dentroPoligono(p, peca.contorno) || distContorno(p, peca.contorno) < mm;
    });
  }

  /* ---------- Texto ---------- */
  var CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;
  function limparTexto(s, suporta) {
    var removidos = [], texto = "";
    Array.from(String(s === null || s === undefined ? "" : s)).forEach(function (ch) {
      if (CONTROLE.test(ch)) return;
      if (suporta && !suporta(ch)) { removidos.push(ch); return; }
      texto += ch;
    });
    return { texto: texto.replace(/\s+/g, " ").trim(), removidos: removidos };
  }
  function fonteCSS(familia, peso, px) { return peso + " " + px + "px '" + familia + "', sans-serif"; }

  /* Escreve centrado em (x, y), reduzindo até 60%; se ainda não couber, comprime na
     horizontal e avisa. escala converte o measureText para mm (o context2d do jsPDF mede em pt). */
  function escreverAjustado(ctx, texto, fonte, px, max, x, y, escala) {
    var k = escala || 1, t = px;
    var medir = function () { return ctx.measureText(texto).width * k; };
    ctx.font = fonte(t);
    while (t > px * ENCOLHE_ATE && medir() > max) {
      t = Math.max(px * ENCOLHE_ATE, t - px * 0.04);
      ctx.font = fonte(t);
    }
    var w = medir();
    if (w <= max + 1e-6) { ctx.fillText(texto, x, y); return true; }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(max / w, 1);
    ctx.fillText(texto, 0, 0);
    ctx.restore();
    return false;
  }

  /* ---------- Estampas ---------- */
  function hexParaRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(h || ""));
    var v = parseInt(m ? m[1] : "000000", 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }
  function rgbParaHex(c) {
    return "#" + c.map(function (x) { return ("0" + Math.round(x).toString(16)).slice(-2); }).join("");
  }
  function brush(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.35, y - h * 0.5);
    ctx.lineTo(x + w * 0.5, y - h * 0.15);
    ctx.lineTo(x + w * 0.35, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  /* Mesmo rajado do 3D (semente 1337), em mm: 1 px da textura ≈ 0,6 mm. */
  function rajado(ctx, caixa, cor1, cor2, alfa) {
    var K = 0.6, W = caixa.w, H = caixa.h;
    var escala = (W * H) / Math.pow(2048 * K, 2);
    var seed = 1337;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var D = Math.hypot(W, H) * 1.1;
    ctx.save();
    ctx.translate(caixa.x + W / 2, caixa.y + H / 2);
    ctx.rotate(-0.42);
    [[cor2, 0.38, 65 * 6.76, [120, 340], [10, 26]],
      [cor2, 0.88, 95 * 6.76, [65, 260], [6, 16]],
      [cor1, 0.65, 55 * 6.76, [80, 240], [5, 14]]].forEach(function (cam) {
      ctx.fillStyle = cam[0];
      alfa(cam[1]);
      var n = Math.max(1, Math.round(cam[2] * escala));
      for (var i = 0; i < n; i++) {
        var rx = (rand() - 0.5) * D, ry = (rand() - 0.5) * D;
        var rw = (cam[3][0] + rand() * cam[3][1]) * K, rh = (cam[4][0] + rand() * cam[4][1]) * K;
        brush(ctx, rx, ry, rw, rh);
      }
    });
    alfa(1);
    ctx.restore();
  }
  function fundo(ctx, peca, projeto, caixa, alfa) {
    var cores = projeto.cores || {};
    var cor = function (k, padrao) { return (cores[k] && cores[k].hex) || padrao; };
    var c1 = cor("cor1", "#0F1F3D"), c2 = cor("cor2", "#2F5BFF");
    if (peca.id === "ribana") {
      ctx.fillStyle = cor("cor3", "#FFFFFF");
      ctx.fillRect(caixa.x, caixa.y, caixa.w, caixa.h);
      return [];
    }
    var estampa = projeto.estampa;
    if (estampa !== "gradient") {
      ctx.fillStyle = c1;
      ctx.fillRect(caixa.x, caixa.y, caixa.w, caixa.h);
    }
    if (estampa === "stripes") {
      ctx.fillStyle = c2;
      for (var x = caixa.x + 30; x < caixa.x + caixa.w; x += 60) ctx.fillRect(x, caixa.y, 30, caixa.h);
    } else if (estampa === "gradient") {
      var a = hexParaRgb(c1), b = hexParaRgb(c2), passo = caixa.h / 64;
      for (var i = 0; i < 64; i++) {
        var t = i / 63;
        ctx.fillStyle = rgbParaHex([0, 1, 2].map(function (k) { return a[k] + (b[k] - a[k]) * t; }));
        ctx.fillRect(caixa.x, caixa.y + i * passo, caixa.w, passo + 0.2);
      }
    } else if (estampa === "rajado") {
      rajado(ctx, caixa, c1, c2, alfa);
    } else if (estampa === "colors") {
      return ["Estampa Colors exportada na cor 1 (desenho por peça ainda não disponível)"];
    }
    return [];
  }

  /* Escudo padrão "SEU ESCUDO" (só na prévia do 3D; na impressão não entra). */
  function escudoPadrao(ctx, cx, cy, size, fontes) {
    var r = size * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.88);
    ctx.lineTo(r * 0.78, -r * 0.68);
    ctx.lineTo(r * 0.72, r * 0.18);
    ctx.quadraticCurveTo(r * 0.55, r * 0.68, 0, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.68, -r * 0.72, r * 0.18);
    ctx.lineTo(-r * 0.78, -r * 0.68);
    ctx.closePath();
    ctx.fillStyle = "#141619";
    ctx.fill();
    ctx.lineWidth = size * 0.045;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = fontes("Montserrat", "800", size * 0.12);
    ctx.fillText("SEU", 0, -r * 0.45);
    ctx.font = fontes("Montserrat", "900", size * 0.19);
    ctx.fillText("ESCUDO", 0, -r * 0.04);
    ctx.restore();
  }

  function caminho(ctx, pontos) {
    ctx.beginPath();
    pontos.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
  }

  /* Desenha a peça inteira no ctx (já em mm). opcoes: { sangria, fontes(fam, peso, px), alfa(a), escalaMedida,
     suporta(ch), escudo (imagem para drawImage), previa (bool), layout (sobrepõe o do projeto) } */
  function desenharPeca(ctx, peca, projeto, atleta, opcoes) {
    var o = opcoes || {}, p = projeto || {}, avisos = [];
    var fontes = o.fontes || fonteCSS;
    var sangria = Number(o.sangria) || 0;
    var caixa = { x: -sangria, y: -sangria, w: peca.largura + 2 * sangria, h: peca.altura + 2 * sangria };
    var cores = p.cores || {};
    var cor = function (k) { return (cores[k] && cores[k].hex) || "#FFFFFF"; };

    ctx.save();
    caminho(ctx, expandirContorno(peca.contorno, sangria));
    ctx.clip();
    var alfa = o.alfa || function (a) { ctx.globalAlpha = a; };
    avisos = avisos.concat(fundo(ctx, peca, p, caixa, alfa));

    var layout = normalizarLayout(o.layout || p.layout, (p.layout && p.layout.modelo) || "camiseta-basica");
    var familia = Object.prototype.hasOwnProperty.call(PESOS_CAMISA, p.fonte) ? p.fonte : "Montserrat";
    var textosDe = {
      marca: "JP",
      patrocinio: String(p.patrocinio || "").toUpperCase(),
      nome: String(atleta ? atleta.nome : p.nome || "").toUpperCase(),
      numero: String(atleta ? atleta.numero : p.numero || "")
    };
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    layout.elementos.forEach(function (el) {
      if (el.peca !== peca.id) return;
      var pos = posicao(el, peca);
      if (el.id === "escudo") {
        if (o.escudo) ctx.drawImage(o.escudo, pos.x - pos.largura / 2, pos.y - pos.largura / 2, pos.largura, pos.largura);
        else if (o.previa) escudoPadrao(ctx, pos.x, pos.y, pos.largura, fontes);
        else avisos.push("Sem escudo do cliente: área do escudo fica vazia");
        return;
      }
      var limpo = limparTexto(textosDe[el.id], o.suporta);
      if (limpo.removidos.length) avisos.push("Caracteres removidos de \"" + textosDe[el.id] + "\": " + limpo.removidos.join(" "));
      if (!limpo.texto) return;
      var px = el.largura * 10 * ALTURA_TEXTO[el.id];
      var fonte = el.id === "marca" ? function (t) { return fontes("Anton", "400", t); }
        : el.id === "patrocinio" ? function (t) { return fontes("Montserrat", "800", t); }
          : function (t) { return fontes(familia, PESOS_CAMISA[familia], t); };
      ctx.fillStyle = cor(el.id === "nome" || el.id === "numero" ? "cor5" : "cor4");
      if (!escreverAjustado(ctx, limpo.texto, fonte, px, pos.largura, pos.x, pos.y, o.escalaMedida)) {
        avisos.push("\"" + limpo.texto + "\" não cabe em " + el.largura + " cm e foi comprimido");
      }
    });
    ctx.restore();
    return { avisos: avisos };
  }

  var JPArtePecas = {
    ELEMENTOS: ELEMENTOS, layoutPadrao: layoutPadrao, normalizarLayout: normalizarLayout,
    posicao: posicao, alturaElemento: alturaElemento, foraDaAreaSegura: foraDaAreaSegura,
    expandirContorno: expandirContorno, limparTexto: limparTexto, desenharPeca: desenharPeca,
    fonteCSS: fonteCSS
  };
  raiz.JPArtePecas = JPArtePecas;
  if (typeof module !== "undefined" && module.exports) module.exports = JPArtePecas;
})(typeof window !== "undefined" ? window : globalThis);

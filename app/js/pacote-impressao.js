/* JP Sport · Pacote de impressão para sublimação.
   Gera, a partir de um pedido (orcamentos) e dos moldes do Audaces em mm:
   ficha técnica (.txt/.prn), um PDF 1:1 por tamanho, um PDF unificado encaixado na
   largura útil da plotter e o manifesto JSON, tudo num .zip. A peça nunca é reduzida
   para caber: se não couber nem girada, o pacote recusa com o motivo.
   Navegador (window.JPPacoteImpressao) e Node (module.exports). */
(function (raiz) {
  "use strict";

  var dep = function (nomeGlobal, arquivo) {
    if (raiz[nomeGlobal]) return raiz[nomeGlobal];
    return typeof require === "function" ? require(arquivo) : null;
  };
  var Arte = dep("JPArtePecas", "./arte-pecas.js");
  var Fontes = dep("JPPdfFontes", "./pdf-fontes.js");
  var Ficha = dep("JPMoldeMatricial", "./molde-matricial.js");

  var TAMANHOS = ["P", "M", "G", "GG", "XG", "Infantil"];
  var NOMES_MODALIDADE = { futebol: "futebol", basquete: "basquete", volei: "vôlei" };
  var PERFIL_PADRAO = {
    larguraUtil: 1600, margemLateral: 10, sangria: 5, espaco: 10, girar90: true, espelhar: false,
    comprimentoMax: 5000, linhasTecnicas: true, areaSegura: 20
  };
  var LIMITE_PDF_MM = 5080; // 200 polegadas: maior página que um PDF comum aceita
  var TOPO_MM = 130;        // faixa do cabeçalho e do quadrado de controle em cada prancha

  function texto(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function objeto(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : null; }
  function inteiro(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }

  function podeExportar(pedido, indice) {
    var proj = objeto(pedido && pedido.projeto_3d) || {};
    var modalidade = texto((pedido && pedido.modalidade) || proj.modalidade).toLowerCase();
    var ids = Object.keys(indice || {});
    var id = ids.find(function (k) { return indice[k].modalidade === modalidade; });
    if (!id) return { ok: false, motivo: "Molde de " + (NOMES_MODALIDADE[modalidade] || modalidade || "modalidade") + " não cadastrado" };
    var gola = texto(proj.gola).toLowerCase();
    if (gola && indice[id].gola && gola !== indice[id].gola) return { ok: false, motivo: "Molde de gola V/polo não cadastrado" };
    return { ok: true, modelo: id };
  }

  /* Um item por camisa: um por atleta, ou pela grade quando não há lista. */
  function copias(pedido) {
    var avisos = [], lista = [];
    var atletas = Array.isArray(pedido && pedido.atletas) ? pedido.atletas.filter(objeto) : [];
    if (atletas.length) {
      TAMANHOS.concat(Array.from(new Set(atletas.map(function (a) { return texto(a.tamanho); })))
        .filter(function (t) { return TAMANHOS.indexOf(t) < 0; }))
        .forEach(function (t) {
          var doTamanho = atletas.filter(function (a) { return texto(a.tamanho) === t; });
          doTamanho.forEach(function (a, i) {
            lista.push({ tamanho: t, atleta: { nome: texto(a.nome), numero: texto(a.numero), tamanho: t }, indice: i + 1, total: doTamanho.length });
          });
        });
    } else {
      var g = objeto(pedido && pedido.grade) || {};
      TAMANHOS.forEach(function (t) {
        var n = inteiro(g[t]);
        for (var i = 1; i <= n; i++) lista.push({ tamanho: t, atleta: null, indice: i, total: n });
      });
      avisos.push("Sem lista de atletas: todas as camisas com o nome e o número do projeto");
    }
    return { lista: lista, avisos: avisos };
  }

  /* Encaixe em faixas: mais altas primeiro; gira 90° só quando a peça não cabe em pé. */
  function encaixar(itens, perfil) {
    var p = Object.assign({}, PERFIL_PADRAO, perfil);
    var x0 = p.margemLateral, xMax = p.larguraUtil - p.margemLateral;
    var util = xMax - x0, altMax = p.comprimentoMax - TOPO_MM - p.margemLateral;
    if (!(util > 0) || !(altMax > 0)) return { erro: "Perfil inválido: largura útil ou comprimento muito pequenos" };
    var postos = [];
    for (var i = 0; i < itens.length; i++) {
      var it = itens[i], w = it.largura, h = it.altura, girado = false;
      if (w > util || h > altMax) {
        if (p.girar90 && h <= util && w <= altMax) { girado = true; w = it.altura; h = it.largura; }
        else return { erro: "Perfil de " + p.larguraUtil + " mm não comporta a peça " + it.nome + " (" + Math.round(Math.min(it.largura, it.altura)) + " mm)" };
      }
      postos.push({ item: it, w: w, h: h, girado: girado });
    }
    postos.sort(function (a, b) { return b.h - a.h; });
    var pranchas = [], atual = null, x = 0, y = 0, faixa = 0;
    function novaPrancha() { atual = { itens: [], comprimento: 0 }; pranchas.push(atual); x = x0; y = TOPO_MM; faixa = 0; }
    novaPrancha();
    postos.forEach(function (o) {
      if (x + o.w > xMax + 1e-6) { x = x0; y += faixa + p.espaco; faixa = 0; }
      if (y + o.h > p.comprimentoMax - p.margemLateral + 1e-6) novaPrancha();
      atual.itens.push(Object.assign({}, o.item, { x: x, y: y, girado: o.girado }));
      atual.comprimento = Math.max(atual.comprimento, y + o.h + p.margemLateral);
      x += o.w + p.espaco;
      faixa = Math.max(faixa, o.h);
    });
    pranchas.forEach(function (pr) { pr.comprimento = Math.ceil(pr.comprimento); });
    return { pranchas: pranchas };
  }

  function rotulo(pedido, peca, copia) {
    var quem = copia.atleta ? [copia.atleta.numero, copia.atleta.nome].filter(Boolean).join(" ") : copia.indice + "/" + copia.total;
    return "#" + texto(pedido.id) + " · " + peca.nome + " · " + copia.tamanho + " · " + quem;
  }

  function caminho(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
  }

  /* Desenha uma peça já posicionada: arte, linha de corte, linhas técnicas e rótulo. */
  function desenharItem(doc, ctx, item, perfil, projeto, opcoesArte) {
    var peca = item.peca, s = perfil.sangria;
    ctx.save();
    if (item.girado) { ctx.translate(item.x + item.altura - s, item.y + s); ctx.rotate(Math.PI / 2); }
    else ctx.translate(item.x + s, item.y + s);
    var r = Arte.desenharPeca(ctx, peca, projeto, item.copia.atleta, opcoesArte);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 0.3;
    caminho(ctx, peca.contorno);
    ctx.stroke();
    if (perfil.linhasTecnicas) {
      ctx.lineWidth = 0.2;
      [peca.fio].concat(peca.piques || []).forEach(function (seg) {
        if (!seg || seg.length < 2) return;
        ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); ctx.lineTo(seg[1][0], seg[1][1]); ctx.stroke();
      });
    }
    // o rótulo usa a mesma fonte: tira o que ela não tem (emoji etc.)
    item.rotulo = Arte.limparTexto(item.rotulo, opcoesArte.suporta).texto;
    var ty = Math.max(6, peca.pontos.barra - 8);
    ctx.font = Fontes.fontePDF("Montserrat", "800", 3);
    var largura = ctx.measureText(item.rotulo).width * opcoesArte.escalaMedida + 3;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(peca.pontos.centro - largura / 2, ty - 2.5, largura, 4.5);
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.rotulo, peca.pontos.centro, ty);
    ctx.restore();
    return r.avisos;
  }

  async function gerarPDF(itens, perfil, pedido, projeto, deps, titulo, avisos) {
    var enc = encaixar(itens.map(function (it) {
      return Object.assign({}, it, { largura: it.peca.largura + 2 * perfil.sangria, altura: it.peca.altura + 2 * perfil.sangria });
    }), perfil);
    if (enc.erro) throw new Error(enc.erro);
    var primeira = enc.pranchas[0];
    var formato = function (pr) { return [perfil.larguraUtil, pr.comprimento]; };
    var orient = function (pr) { return perfil.larguraUtil > pr.comprimento ? "landscape" : "portrait"; };
    var doc = new deps.jsPDF({ unit: "mm", format: formato(primeira), orientation: orient(primeira), compress: true });
    await Fontes.registrarFontes(doc, deps.carregarTTF);
    var opcoesArte = {
      sangria: perfil.sangria, fontes: Fontes.fontePDF, alfa: Fontes.alfaPDF(doc),
      escalaMedida: 1 / doc.internal.scaleFactor, // measureText do context2d vem em pt
      suporta: function (ch) { return Fontes.glifoSuportado(doc, "Montserrat", "900", ch); },
      escudo: projeto.escudo || null
    };
    enc.pranchas.forEach(function (pr, i) {
      if (i) doc.addPage(formato(pr), orient(pr));
      var ctx = doc.context2d;
      ctx.save();
      if (perfil.espelhar) { ctx.translate(perfil.larguraUtil, 0); ctx.scale(-1, 1); }
      pr.itens.forEach(function (it) {
        desenharItem(doc, ctx, it, perfil, projeto, opcoesArte).forEach(function (a) { if (avisos.indexOf(a) < 0) avisos.push(a); });
      });
      ctx.restore();
      doc.setFont(Fontes.nomeInterno("Montserrat", "800"), "normal");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(titulo + " · prancha " + (i + 1) + "/" + enc.pranchas.length + " · largura útil " + perfil.larguraUtil +
        " mm · ESCALA 1:1" + (perfil.espelhar ? " · ESPELHADO" : ""), perfil.margemLateral, 12);
      Fontes.quadradoControle(doc, perfil.larguraUtil - perfil.margemLateral - 100, 18);
    });
    return {
      encaixe: enc.pranchas,
      bytes: new Uint8Array(doc.output("arraybuffer")),
      pranchas: enc.pranchas.map(function (pr) { return { comprimento: pr.comprimento, pecas: pr.itens.length }; }),
      pecas: enc.pranchas.reduce(function (l, pr) { return l.concat(pr.itens.map(function (it) { return { rotulo: it.rotulo, girado: it.girado }; })); }, [])
    };
  }

  /* deps: { moldes: {P: Molde, ...}, indice, perfil, jsPDF, JSZip, carregarTTF, previaPNG? } */
  async function gerarPacote(pedido, deps) {
    var pode = podeExportar(pedido, deps.indice);
    if (!pode.ok) return { erro: pode.motivo };
    var perfil = Object.assign({}, PERFIL_PADRAO, deps.perfil);
    if (perfil.comprimentoMax > LIMITE_PDF_MM) perfil.comprimentoMax = LIMITE_PDF_MM;
    var avisos = [];
    var projeto = objeto(pedido.projeto_3d);
    if (!projeto) { avisos.push("Sem projeto 3D: cores e layout padrão"); projeto = {}; }
    var c = copias(pedido);
    avisos = avisos.concat(c.avisos);
    var id = texto(pedido.id) || "pedido";

    var porTamanho = {};
    c.lista.forEach(function (copia) {
      var molde = deps.moldes[copia.tamanho];
      if (!molde) { var a = "Tamanho " + copia.tamanho + " sem molde"; if (avisos.indexOf(a) < 0) avisos.push(a); return; }
      (porTamanho[copia.tamanho] = porTamanho[copia.tamanho] || { molde: molde, itens: [], copias: 0 }).copias++;
      molde.pecas.forEach(function (peca) {
        porTamanho[copia.tamanho].itens.push({
          id: copia.tamanho + "|" + copia.indice + "|" + peca.id, nome: peca.nome, peca: peca, copia: copia,
          rotulo: rotulo(pedido, peca, copia)
        });
      });
    });

    var zip = new deps.JSZip();
    var manifesto = {
      pedido: id, modelo: pode.modelo, versaoMolde: null, escala: "1:1", unidade: "mm", perfil: perfil,
      tamanhos: {}, unificado: null, avisos: avisos, geradoEm: new Date().toISOString()
    };
    var todos = [];
    for (var i = 0; i < TAMANHOS.length; i++) {
      var t = TAMANHOS[i], grupo = porTamanho[t];
      if (!grupo) continue;
      manifesto.versaoMolde = manifesto.versaoMolde || grupo.molde.versao;
      var pdf = await gerarPDF(grupo.itens, perfil, pedido, projeto, deps, "Pedido #" + id + " · tamanho " + t, avisos);
      var arquivo = "impressao-" + id + "-" + t + ".pdf";
      zip.file(arquivo, pdf.bytes);
      manifesto.tamanhos[t] = { arquivo: arquivo, copias: grupo.copias, pranchas: pdf.pranchas, pecas: pdf.pecas };
      todos = todos.concat(grupo.itens);
    }
    if (todos.length) {
      var uni = await gerarPDF(todos, perfil, pedido, projeto, deps, "Pedido #" + id + " · unificado", avisos);
      var arqUni = "impressao-" + id + "-unificado.pdf";
      zip.file(arqUni, uni.bytes);
      manifesto.unificado = { arquivo: arqUni, pranchas: uni.pranchas, pecas: uni.pecas };
      if (deps.previaPNG) zip.file("previa-" + id + ".png", await deps.previaPNG(uni));
    }
    zip.file("ficha-" + id + ".txt", Ficha.gerarTextoPuro(pedido, { moldes: deps.moldes }));
    zip.file("ficha-" + id + ".prn", Ficha.gerarArquivoMatricialESCP(pedido, { moldes: deps.moldes }));
    zip.file("manifesto-" + id + ".json", JSON.stringify(manifesto, null, 2));
    return { zip: await zip.generateAsync({ type: "uint8array" }), manifesto: manifesto, avisos: avisos };
  }

  /* ---------- Perfil de produção (salvo no navegador do painel) ---------- */
  var CHAVE_PERFIL = "jpPerfilProducao";
  var FAIXAS = {
    larguraUtil: [200, 5000, "Largura útil"], margemLateral: [0, 200, "Margem lateral"], sangria: [0, 30, "Sangria"],
    espaco: [0, 100, "Espaço entre peças"], comprimentoMax: [500, LIMITE_PDF_MM, "Comprimento máximo"], areaSegura: [0, 100, "Área segura"]
  };
  function validarPerfil(entrada) {
    var e = entrada || {}, perfil = Object.assign({}, PERFIL_PADRAO);
    var chaves = Object.keys(FAIXAS);
    for (var i = 0; i < chaves.length; i++) {
      var k = chaves[i];
      if (e[k] === undefined || e[k] === "") continue;
      var v = Number(e[k]), f = FAIXAS[k];
      if (!isFinite(v) || v < f[0] || v > f[1]) return { ok: false, erro: f[2] + " deve ficar entre " + f[0] + " e " + f[1] + " mm" };
      perfil[k] = v;
    }
    ["girar90", "espelhar", "linhasTecnicas"].forEach(function (k) { if (e[k] !== undefined) perfil[k] = e[k] === true || e[k] === "true"; });
    if (perfil.larguraUtil - 2 * perfil.margemLateral <= 0) return { ok: false, erro: "Largura útil menor que as margens" };
    return { ok: true, perfil: perfil };
  }
  function lerPerfil(storage) {
    try {
      var salvo = JSON.parse((storage && storage.getItem(CHAVE_PERFIL)) || "null");
      var r = validarPerfil(Object.assign({}, PERFIL_PADRAO, salvo || {}));
      return r.ok ? r.perfil : Object.assign({}, PERFIL_PADRAO);
    } catch (e) { return Object.assign({}, PERFIL_PADRAO); }
  }
  function salvarPerfil(storage, entrada) {
    var r = validarPerfil(Object.assign({}, lerPerfil(storage), entrada));
    if (!r.ok) return r;
    try { storage.setItem(CHAVE_PERFIL, JSON.stringify(r.perfil)); } catch (e) { return { ok: false, erro: "Não foi possível salvar o perfil neste navegador" }; }
    return r;
  }

  var JPPacoteImpressao = {
    PERFIL_PADRAO: PERFIL_PADRAO, podeExportar: podeExportar, copias: copias, encaixar: encaixar,
    gerarPacote: gerarPacote, validarPerfil: validarPerfil, lerPerfil: lerPerfil, salvarPerfil: salvarPerfil
  };
  raiz.JPPacoteImpressao = JPPacoteImpressao;
  if (typeof module !== "undefined" && module.exports) module.exports = JPPacoteImpressao;
})(typeof window !== "undefined" ? window : globalThis);

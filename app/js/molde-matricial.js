/* JP Sport · Molde técnico do pedido.
   SVG P&B para impressão comum e ficha de 80 colunas para impressora matricial
   (ESC/P: Epson LX-300, FX-890). Funciona no navegador e no Node.
   O pedido vem de um formulário público: todo texto é escapado (SVG/HTML) ou
   reduzido a ASCII imprimível (matricial), para não injetar marcação nem comandos. */
(function (raiz) {
  "use strict";

  var COLUNAS = 80;
  var TAMANHOS = ["P", "M", "G", "GG", "XG", "Infantil"];
  var MODALIDADES = { futebol: "Futebol", basquete: "Basquete", volei: "Vôlei" };
  var STATUS = { novo: "Novo", em_producao: "Em produção", finalizado: "Finalizado", cancelado: "Cancelado" };
  var GOLAS = { v: "Gola V", redonda: "Gola redonda", polo: "Gola polo", regata: "Decote regata" };
  var ESTAMPAS = { rajado: "Rajado", colors: "Colors", stripes: "Listras", gradient: "Gradiente", solid: "Lisa" };
  var ROTULOS_COR = {
    cor1: "Cor 1", cor2: "Cor 2", cor3: "Cor 3", cor4: "Cor 4", cor5: "Cor 5",
    corCalcao: "Calção", corMeiao: "Meião"
  };

  /* Medidas de referência do tamanho M, em cm. Conferir com a modelagem antes do corte. */
  var MEDIDAS = {
    comManga: { peito: 52, comprimento: 72, cava: 24, ombros: 46, mangaComp: 24, mangaLargura: 40, punho: 34 },
    regata: { peito: 52, comprimento: 74, cava: 28, ombros: 34 }
  };
  var DECOTES = {
    v: { largura: 18, profundidade: 14 }, redonda: { largura: 18, profundidade: 9 },
    polo: { largura: 18, profundidade: 13 }, regata: { largura: 22, profundidade: 16 }
  };

  /* ---------- Normalização ---------- */
  function objeto(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function rotulo(mapa, chave) {
    return Object.prototype.hasOwnProperty.call(mapa, chave) ? mapa[chave] : limpo(chave);
  }
  function limpo(v) {
    if (v === null || v === undefined || typeof v === "object") return "";
    // remove controles e surrogates soltos, que são inválidos em XML
    return String(v).replace(/[\u0000-\u001F\u007F-\u009F\uFFFE\uFFFF]+/g, " ")
      .replace(/\p{Cs}/gu, "").replace(/\s+/g, " ").trim();
  }
  function cortar(v, n) {
    var letras = Array.from(limpo(v));
    return letras.length > n ? letras.slice(0, n - 1).join("") + "…" : letras.join("");
  }
  function esc(v) {
    return limpo(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function dataBR(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpo(v));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : limpo(v);
  }
  function inteiro(v) {
    var n = Math.floor(Number(v));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function normalizar(pedido) {
    var p = objeto(pedido);
    var proj = objeto(p.projeto_3d);
    var g = objeto(p.grade);
    var modalidade = limpo(p.modalidade || proj.modalidade).toLowerCase();
    var basquete = modalidade === "basquete";
    var golaPedida = limpo(proj.gola).toLowerCase();
    var golaValida = Object.prototype.hasOwnProperty.call(GOLAS, golaPedida);
    // regata de basquete tem sempre decote próprio, como no simulador
    var gola = basquete ? "regata" : (golaValida ? golaPedida : "redonda");

    var grade = TAMANHOS.map(function (t) { return { tamanho: t, qtd: inteiro(g[t]) }; });
    var soma = grade.reduce(function (s, x) { return s + x.qtd; }, 0);
    var informado = inteiro(p.total_pecas);

    var cores = [];
    var brutas = objeto(proj.cores);
    Object.keys(ROTULOS_COR).forEach(function (k) {
      var c = brutas[k];
      if (!c || (!p.kit_completo && (k === "corCalcao" || k === "corMeiao"))) return;
      var nome = typeof c === "string" ? "" : limpo(c.nome);
      var hex = limpo(typeof c === "string" ? c : c.hex);
      if (nome || hex) cores.push({ rotulo: ROTULOS_COR[k], nome: nome, hex: hex });
    });

    var atletas = (Array.isArray(p.atletas) ? p.atletas : []).filter(function (a) { return objeto(a) === a; }).map(function (a) {
      return { nome: limpo(a.nome), numero: limpo(a.numero), tamanho: limpo(a.tamanho) };
    });

    return {
      atletas: atletas,
      id: limpo(p.id) || "-", time: limpo(p.time) || "-", cidade: limpo(p.cidade) || "-",
      responsavel: limpo(p.responsavel) || "-", basquete: basquete,
      modalidade: rotulo(MODALIDADES, modalidade) || "-",
      kit: p.kit_completo ? "Sim (camisa, calção, meião)" : "Não (somente camisa)",
      prazo: dataBR(p.prazo) || "A combinar", criado: dataBR(p.criado_em) || "-",
      status: rotulo(STATUS, limpo(p.status) || "novo"),
      observacoes: limpo(p.observacoes), gola: gola,
      golaTexto: GOLAS[gola] + (basquete || golaValida ? "" : " (não informada: confirmar)"),
      estampa: rotulo(ESTAMPAS, limpo(proj.estampa)) || "Não informada",
      numero: limpo(proj.numero), nome: limpo(proj.nome), cores: cores,
      grade: grade, total: soma,
      alertaTotal: informado !== soma ? "ATENÇÃO: o pedido informa " + informado + " peças; a grade soma " + soma + "." : "",
      medidas: basquete ? MEDIDAS.regata : MEDIDAS.comManga, decote: DECOTES[gola]
    };
  }
  function textoCor(c) { return c.rotulo + ": " + [c.nome, c.hex].filter(Boolean).join(" "); }

  /* ---------- SVG técnico ---------- */
  var ESCALA = 4; // unidades por cm nas vistas de frente e costas
  var TRACO = 'fill="none" stroke="#000000" stroke-width="2" stroke-linejoin="round"';
  var TRACEJADO = 'fill="none" stroke="#000000" stroke-width="1" stroke-dasharray="6 4"';
  var CENTRO = 'fill="none" stroke="#000000" stroke-width="0.8" stroke-dasharray="14 4 3 4"';
  var MEIO = 'text-anchor="middle"';
  var FIM = 'text-anchor="end"';
  var FORTE = 'font-weight="700"';

  function txt(x, y, texto, tam, extra) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (tam || 12) + '" ' + (extra || "") + ">" + esc(texto) + "</text>";
  }
  function linha(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#000000" stroke-width="1"/>';
  }
  function caixa(x, y, w, h) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#000000" stroke-width="1.5"/>';
  }
  function caminho(d, estilo) { return '<path d="' + d + '" ' + estilo + "/>"; }
  /* Halo branco mantém a cota legível sobre as linhas do desenho. */
  function rotuloCota(x, y, texto, extra) {
    return txt(x, y, texto, 11, MEIO + ' stroke="#ffffff" stroke-width="4" paint-order="stroke" ' + FORTE + " " + (extra || ""));
  }
  function cotaH(x1, x2, y, texto) {
    return linha(x1, y, x2, y) + linha(x1 - 4, y + 4, x1 + 4, y - 4) + linha(x2 - 4, y + 4, x2 + 4, y - 4) +
      rotuloCota((x1 + x2) / 2, y - 5, texto);
  }
  function cotaV(x, y1, y2, texto) {
    var ym = (y1 + y2) / 2;
    return linha(x, y1, x, y2) + linha(x - 4, y1 + 4, x + 4, y1 - 4) + linha(x - 4, y2 + 4, x + 4, y2 - 4) +
      rotuloCota(x - 5, ym, texto, 'transform="rotate(-90 ' + (x - 5) + " " + ym + ')"');
  }

  /* Decote da direita para a esquerda, a partir de (n, 0). */
  function decoteFrente(gola, n, prof) {
    if (gola === "v" || gola === "polo") return "L 0 " + prof + " L " + -n + " 0";
    return "C " + n * 0.9 + " " + prof * 1.33 + " " + -n * 0.9 + " " + prof * 1.33 + " " + -n + " 0";
  }
  /* Linha de acabamento paralela ao decote. */
  function acabamento(gola, n, prof, folga) {
    return "M " + (n + folga) + " 0 " + decoteFrente(gola, n + folga, prof + folga * 1.4);
  }
  function abasPolo(n, prof) {
    return "M " + n + " 0 L " + (n + 9) + " " + prof * 0.45 + " L " + n * 0.55 + " " + prof * 0.75 + " L 0 " + prof * 0.35 +
      " L " + -n * 0.55 + " " + prof * 0.75 + " L " + -(n + 9) + " " + prof * 0.45 + " L " + -n + " 0";
  }
  /* Número/nome vazado; comprime quando passa da largura disponível. */
  function rotuloPeca(x, y, texto, tam, max) {
    var t = cortar(texto, 20);
    var aperta = t.length * tam * 0.65 > max ? ' textLength="' + max + '" lengthAdjust="spacingAndGlyphs"' : "";
    return txt(x, y, t, tam, MEIO + " " + FORTE + ' fill="#ffffff" stroke="#000000" stroke-width="1.2"' + aperta);
  }

  function vistaCorpo(d, costas) {
    var m = d.medidas;
    var meio = m.peito * ESCALA / 2, alt = m.comprimento * ESCALA, ombro = m.ombros * ESCALA / 2;
    var n = d.decote.largura * ESCALA / 2, prof = d.decote.profundidade * ESCALA;
    var topo = d.basquete ? 8 : 18; // queda do ombro
    var axila = topo + m.cava * ESCALA;
    var s = [];
    var decote = costas
      ? "C " + n * 0.6 + " 16 " + -n * 0.6 + " 16 " + -n + " 0"
      : decoteFrente(d.gola, n, prof);

    var esquerda = d.basquete
      ? " L " + -ombro + " " + topo + " C " + -(ombro - 8) + " " + axila * 0.7 + " " + -meio + " " + axila * 0.85 + " " + -meio + " " + axila
      : " L " + -ombro + " " + topo + " L -164 98 L -124 128 L " + -meio + " " + axila;
    var direita = d.basquete
      ? " L " + meio + " " + axila + " C " + meio + " " + axila * 0.85 + " " + (ombro - 8) + " " + axila * 0.7 + " " + ombro + " " + topo
      : " L " + meio + " " + axila + " L 124 128 L 164 98 L " + ombro + " " + topo;
    var contorno = "M " + n + " 0 " + decote + esquerda + " L " + -meio + " " + alt + " L " + meio + " " + alt + direita + " Z";

    s.push(caminho(contorno, TRACO));
    // margem de costura: contorno ampliado em cerca de 1 cm
    s.push('<g transform="translate(0 ' + alt / 2 + ") scale(1.038 1.028) translate(0 " + -alt / 2 + ')">' + caminho(contorno, TRACEJADO) + "</g>");
    s.push(caminho("M " + -meio + " " + (alt - 8) + " H " + meio, TRACEJADO)); // dobra da barra
    s.push(caminho("M 0 " + (costas ? 14 : prof) + " V " + alt, CENTRO));
    if (!d.basquete) {
      [-1, 1].forEach(function (l) {
        s.push(caminho("M " + l * ombro + " " + topo + " Q " + l * (ombro - 6) + " " + axila * 0.7 + " " + l * meio + " " + axila, TRACO));
        s.push(caminho("M " + l * 157 + " 92 L " + l * 118 + " 121", TRACEJADO)); // dobra do punho
      });
    }
    if (costas) {
      if (d.nome) s.push(rotuloPeca(0, 72, d.nome, 26, 110));
      if (d.numero) s.push(rotuloPeca(0, 190, d.numero, 110, 130));
      s.push(cotaH(-ombro, ombro, -10, "Ombro a ombro " + m.ombros + " cm"));
      s.push(cotaH(-meio, meio, alt + 22, "Barra " + m.peito + " cm"));
    } else {
      s.push(d.gola === "polo" ? caminho(abasPolo(n, prof), TRACO) : caminho(acabamento(d.gola, n, prof, 6), TRACEJADO));
      if (d.numero) s.push(d.gola === "regata" ? rotuloPeca(0, 112, d.numero, 34, 60) : rotuloPeca(50, 92, d.numero, 30, 44));
      s.push(cotaH(-meio, meio, axila + 30, "Largura peito " + m.peito + " cm"));
      s.push(cotaV(196, 0, alt, "Comprimento total " + m.comprimento + " cm"));
      s.push(cotaV(d.basquete ? -meio - 14 : -ombro + 24, topo, axila, "Cava " + m.cava + " cm"));
    }
    return s.join("");
  }

  function vistaManga(d) {
    var m = d.medidas;
    if (d.basquete) {
      return caminho("M -40 0 H 0 C -8 60 10 100 60 118 V 136", TRACO) +
        caminho("M -10 0 C -18 64 4 108 50 126 V 136", TRACEJADO) +
        cotaV(84, 0, 118, "Cava " + m.cava + " cm") +
        txt(0, 160, "RECORTE REGATA SEM MANGA", 13, MEIO + " " + FORTE) +
        txt(0, 175, "Acabamento da cava em viés (tracejado)", 10, MEIO);
    }
    var contorno = "M -100 76 C -60 70 -50 0 0 0 C 50 0 60 70 100 76 L 84 140 H -84 Z";
    return caminho(contorno, TRACO) +
      '<g transform="translate(0 70) scale(1.05 1.07) translate(0 -70)">' + caminho(contorno, TRACEJADO) + "</g>" +
      caminho("M -86 131 H 86", TRACEJADO) +
      caminho("M 0 0 V 140", CENTRO) +
      cotaH(-100, 100, 84, "Largura " + m.mangaLargura + " cm") +
      cotaH(-84, 84, 168, "Punho " + m.punho + " cm") +
      cotaV(134, 0, 140, "Comprimento " + m.mangaComp + " cm");
  }

  function vistaGola(d) {
    var n = 72, prof = Math.round(d.decote.profundidade * 7);
    var s = [
      caminho("M 130 24 L " + n + " 0 " + decoteFrente(d.gola, n, prof) + " L -130 24", TRACO),
      caminho("M " + n + " 0 C 40 18 -40 18 " + -n + " 0", TRACO)
    ];
    if (d.gola === "polo") {
      s.push(caminho(abasPolo(n, prof), TRACO));
      s.push(caminho("M -9 " + prof + " V " + (prof + 42) + " H 9 V " + prof, TRACO));
      [14, 31].forEach(function (y) {
        s.push('<circle cx="0" cy="' + (prof + y) + '" r="3" fill="#ffffff" stroke="#000000"/>');
      });
    } else {
      s.push(caminho(acabamento(d.gola, n, prof, 12), TRACO));
      s.push(caminho(acabamento(d.gola, n, prof, 18), TRACEJADO));
    }
    s.push(cotaH(-n, n, -8, "Abertura " + d.decote.largura + " cm"));
    s.push(cotaV(164, 0, prof, "Prof. " + d.decote.profundidade + " cm"));
    return s.join("");
  }

  function gerarDesenhoTecnicoSVG(pedido) {
    var d = normalizar(pedido);
    function grupo(x, y, conteudo) { return '<g transform="translate(' + x + " " + y + ')">' + conteudo + "</g>"; }
    var s = [];
    s.push('<svg xmlns="http://www.w3.org/2000/svg" class="molde-svg" viewBox="0 0 800 940" width="800" height="940" role="img" font-family="Arial, Helvetica, sans-serif" fill="#000000">');
    s.push("<title>" + esc("Desenho técnico · " + d.time + " · " + d.id) + "</title>");
    s.push('<rect x="0" y="0" width="800" height="940" fill="#ffffff"/>');
    s.push(caixa(10, 10, 780, 920));
    s.push(txt(22, 36, "JP SPORT · DESENHO TÉCNICO DO MOLDE", 18, FORTE));
    s.push(txt(22, 53, "Tamanho-base M · medidas de referência em cm · sem escala", 11));
    s.push(txt(778, 36, "Pedido " + cortar(d.id, 36), 12, FIM + " " + FORTE));
    s.push(txt(778, 53, cortar(d.time, 40), 12, FIM));

    s.push(caixa(10, 64, 390, 406), caixa(400, 64, 390, 406));
    s.push(txt(22, 84, "FRENTE", 14, FORTE), txt(412, 84, "COSTAS", 14, FORTE));
    s.push(grupo(190, 128, vistaCorpo(d, false)), grupo(595, 128, vistaCorpo(d, true)));

    s.push(caixa(10, 470, 390, 216), caixa(400, 470, 390, 216));
    s.push(txt(22, 490, d.basquete ? "CAVA (SEM MANGA)" : "MANGA (2x)", 14, FORTE));
    s.push(txt(412, 490, "DETALHE DA GOLA", 14, FORTE));
    s.push(txt(778, 490, d.golaTexto, 11, FIM));
    s.push(grupo(200, 504, vistaManga(d)), grupo(590, 530, vistaGola(d)));

    // quadro técnico
    s.push(caixa(10, 686, 520, 244), caixa(530, 686, 260, 244));
    s.push(txt(22, 706, "QUADRO TÉCNICO", 14, FORTE), txt(542, 706, "GRADE DE CORTE", 14, FORTE));
    var y = 726;
    [["ID", cortar(d.id, 48)], ["Time", cortar(d.time, 48)], ["Modalidade", cortar(d.modalidade, 30)],
      ["Kit completo", d.kit], ["Gola", d.golaTexto], ["Estampa", cortar(d.estampa, 40)],
      ["Número", cortar(d.numero, 20) || "-"], ["Nome", cortar(d.nome, 40) || "-"], ["Prazo", cortar(d.prazo, 20)]
    ].forEach(function (par) {
      s.push(txt(22, y, par[0], 11, FORTE), txt(112, y, par[1], 11));
      y += 15;
    });
    s.push(txt(22, y, "Cores", 11, FORTE));
    if (!d.cores.length) s.push(txt(112, y, "Não informadas", 11));
    d.cores.forEach(function (c, i) {
      s.push(txt(i % 2 ? 322 : 112, y + Math.floor(i / 2) * 14, cortar(textoCor(c), 32), 11));
    });
    s.push(txt(22, 922, "Contínua: contorno · Tracejada: margem de costura (1 cm) e dobras · Traço-ponto: fio/centro", 9));

    y = 726;
    d.grade.concat([{ tamanho: "TOTAL", qtd: d.total }]).forEach(function (g) {
      var estilo = g.tamanho === "TOTAL" ? FORTE : "";
      s.push(txt(550, y, g.tamanho, 13, estilo), txt(770, y, g.qtd, 13, FIM + " " + estilo));
      s.push(linha(542, y + 7, 778, y + 7));
      y += 24;
    });
    if (d.alertaTotal) {
      s.push(txt(542, 904, "ATENÇÃO: total do pedido diverge da", 10, FORTE), txt(542, 917, "soma da grade. Confirmar antes do corte.", 10, FORTE));
    }
    s.push("</svg>");
    return s.join("");
  }

  /* ---------- Ficha matricial (80 colunas) ---------- */
  /* ASCII puro: a tabela de caracteres muda entre impressoras e um download
     em UTF-8 sairia com acentos trocados. */
  function ascii(v) {
    return limpo(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[·–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
      .replace(/[^\x20-\x7E]/gu, "?");
  }
  function repetir(c, n) { return new Array(n + 1).join(c); }
  function preencher(t, n) { return t.length >= n ? t : t + repetir(" ", n - t.length); }
  function centro(t, n) {
    return preencher(repetir(" ", Math.floor(Math.max(0, n - t.length) / 2)) + t, n);
  }
  /* Quebra por palavra; palavras maiores que a largura são partidas. */
  function quebrar(t, largura) {
    var linhas = [], atual = "";
    t.split(" ").forEach(function (palavra) {
      if (atual && atual.length + 1 + palavra.length > largura) { linhas.push(atual); atual = ""; }
      while (palavra.length > largura) { linhas.push(palavra.slice(0, largura)); palavra = palavra.slice(largura); }
      atual = atual ? atual + " " + palavra : palavra;
    });
    linhas.push(atual);
    return linhas;
  }
  function campo(nome, valor) {
    var prefixo = preencher(nome, 15) + ": ";
    return quebrar(ascii(valor) || "-", COLUNAS - prefixo.length).map(function (l, i) {
      return (i ? repetir(" ", prefixo.length) : prefixo) + l;
    });
  }

  var DECOTE_ASCII = {
    v: ["\\           /", " \\         / ", "  \\       /  ", "   '.   .'   ", "     '.'     "],
    redonda: ["\\           /", " \\         / ", "  '-.___.-'  ", "             ", "             "],
    polo: ["\\\\_  . .  _//", " \\ \\_\\ /_/ / ", "  \\_/ | \\_/  ", "      |o     ", "      |o     "],
    regata: ["|           |", "|           |", " \\         / ", "  \\       /  ", "   '-._.-'   "]
  };
  var DECOTE_COSTAS = ["'-._______.-'", "             ", "             ", "             ", "             "];

  /* Vista de 35 colunas. */
  function corpoAscii(d, costas) {
    var c = costas ? DECOTE_COSTAS : DECOTE_ASCII[d.gola];
    var topo = d.basquete
      ? ["        ___" + c[0] + "___        ", "       |   " + c[1] + "   |       ", "       /   " + c[2] + "   \\       ",
        "      /    " + c[3] + "    \\      ", "     /     " + c[4] + "     \\     "]
      : ["      _____" + c[0] + "_____      ", "    .'     " + c[1] + "     '.    ", "   /       " + c[2] + "       \\   ",
        "  /   |    " + c[3] + "    |   \\  ", " /    |    " + c[4] + "    |    \\ "];
    var l = d.basquete ? "     |" : "      |", largura = d.basquete ? 23 : 21;
    function corpo(t) { return l + centro(t, largura) + "|"; }
    if (!d.basquete) topo.push("/_____|" + repetir(" ", 21) + "|_____\\");
    var p = costas
      ? [corpo(ascii(d.nome).slice(0, 19)), corpo(""), corpo("No. " + (ascii(d.numero).slice(0, 8) || "--"))]
      : [corpo("<----- " + d.medidas.peito + " cm ----->"), corpo("largura peito"), corpo("")];
    return topo.concat(p, [corpo(""), corpo("- - - - - - - - - -"), l + repetir("_", largura) + "|"]);
  }

  function detalhesAscii(d) {
    var m = d.medidas, c = DECOTE_ASCII[d.gola];
    var esq = d.basquete
      ? ["CAVA (SEM MANGA)", "   ____", "       |      RECORTE REGATA", "       |      SEM MANGA", "        \\", "         \\_   cava: " + m.cava + " cm", "           |  acabamento: vies"]
      : ["MANGA (2x)", "        .-'''-.", "     .-'   :   '-.", "   .'      :      '.", "  |<---- " + m.mangaLargura + " cm ---->|", "   \\- - - -:- - - -/", "    \\______:______/"];
    var dir = ["DETALHE DA GOLA: " + ascii(GOLAS[d.gola]).toUpperCase(),
      "  " + c[0], "  " + c[1], "  " + c[2] + "   abertura: " + d.decote.largura + " cm",
      "  " + c[3] + "   profund.: " + d.decote.profundidade + " cm", "  " + c[4], ""];
    return esq.map(function (t, i) { return preencher(t, 40) + dir[i]; });
  }

  function cmBR(mm) { return (Math.round(mm) / 10).toFixed(1).replace(".", ","); }
  /* Peças reais do molde (Audaces) para cada tamanho do pedido. */
  function pecasDoMolde(d, moldes) {
    var L = ["PECAS DO MOLDE (LARGURA x ALTURA, COM MARGEM DE COSTURA)"];
    d.grade.filter(function (g) { return g.qtd > 0; }).forEach(function (g) {
      var m = moldes[g.tamanho];
      if (!m) { L.push(g.tamanho + ": sem molde cadastrado (usar medidas de referencia e confirmar)"); return; }
      var vistas = {};
      var itens = m.pecas.filter(function (p) {
        var chave = p.id.indexOf("manga") === 0 ? "manga" : p.id;
        if (vistas[chave]) return false;
        vistas[chave] = true;
        return true;
      }).map(function (p) {
        var nome = p.id.indexOf("manga") === 0 ? "Manga (2x)" : ascii(p.nome);
        return nome + ": " + cmBR(p.largura) + " x " + cmBR(p.altura) + " cm";
      });
      L = L.concat(quebrar(g.tamanho + "  " + itens.join(" | "), COLUNAS));
    });
    return L;
  }
  function atletasAscii(d) {
    var L = ["ATLETAS (" + d.atletas.length + ")"];
    TAMANHOS.concat(d.atletas.map(function (a) { return a.tamanho; }).filter(function (t, i, arr) {
      return TAMANHOS.indexOf(t) < 0 && arr.indexOf(t) === i;
    })).forEach(function (t) {
      var doTam = d.atletas.filter(function (a) { return a.tamanho === t; });
      if (!doTam.length) return;
      var nomes = doTam.map(function (a) { return ascii([a.numero, a.nome].filter(Boolean).join(" ")) || "-"; });
      var prefixo = ascii(t) + " (" + doTam.length + "): ";
      quebrar(nomes.join(" | "), COLUNAS - prefixo.length).forEach(function (l, i) {
        L.push((i ? repetir(" ", prefixo.length) : prefixo) + l);
      });
    });
    return L;
  }

  function linhasFicha(d, opcoes) {
    var m = d.medidas, L = [], moldes = (opcoes && opcoes.moldes) || null;
    var dupla = repetir("=", COLUNAS), simples = repetir("-", COLUNAS);
    function add(x) { L = L.concat(x); }

    add([dupla, centro("JP SPORT - ORDEM DE PRODUCAO", COLUNAS), dupla]);
    add(campo("Pedido", d.id + " (" + d.criado + ")"));
    add(campo("Time", d.time));
    add(campo("Cidade", d.cidade));
    add(campo("Responsavel", d.responsavel));
    add(campo("Modalidade", d.modalidade));
    add(campo("Kit completo", d.kit));
    add(campo("Prazo", d.prazo));
    add(campo("Status", d.status));

    add([simples, "MOLDE TECNICO - TAMANHO-BASE M, REFERENCIA EM CM (SEM ESCALA)"]);
    add(preencher(centro("FRENTE", 35), 43) + centro("COSTAS", 35));
    var f = corpoAscii(d, false), c = corpoAscii(d, true);
    add(f.map(function (t, i) { return preencher(t, 43) + c[i]; }));
    add("Peito: " + m.peito + " cm | Comprimento total: " + m.comprimento + " cm | Cava: " + m.cava + " cm | Ombros: " + m.ombros + " cm");
    add(d.basquete ? "Manga: nao se aplica (regata)" :
      "Manga: comprimento " + m.mangaComp + " cm | largura " + m.mangaLargura + " cm | punho " + m.punho + " cm");
    add("");
    add(detalhesAscii(d));

    add([simples, "ESPECIFICACOES"]);
    add(campo("Tecido", "Nao informado no pedido (confirmar com a producao)"));
    add(campo("Gola", d.golaTexto));
    add(campo("Estampa", d.estampa));
    add(campo("Cores", d.cores.map(textoCor).join(" | ") || "Não informadas"));
    add(campo("Personalizacao", "Número " + (d.numero || "-") + " | Nome " + (d.nome || "-")));
    if (d.observacoes) add(campo("Observacoes", d.observacoes));

    var borda = repetir("+" + repetir("-", 10), 7) + "+";
    function celulas(v) { return "|" + v.map(function (x) { return centro(String(x), 10); }).join("|") + "|"; }
    add([simples, "GRADE DE CORTE", borda, celulas(TAMANHOS.concat(["TOTAL"])), borda]);
    add([celulas(d.grade.map(function (g) { return g.qtd; }).concat([d.total])), borda]);
    if (d.alertaTotal) add(quebrar(ascii(d.alertaTotal), COLUNAS));
    if (moldes) add([simples].concat(pecasDoMolde(d, moldes)));
    if (d.atletas.length) add([simples].concat(atletasAscii(d)));
    add(["", "Corte: ____________________  Costura: ___________________  Data: ___/___/_____"]);
    return L.map(function (l) { return l.replace(/ +$/, "").slice(0, COLUNAS); });
  }

  /* opcoes.comComandosESCP (padrão true) · opcoes.condensado (padrão false, 10 CPI) · opcoes.moldes. */
  function gerarArquivoMatricialESCP(pedido, opcoes) {
    var o = opcoes || {};
    var texto = linhasFicha(normalizar(pedido), o).join("\r\n");
    if (o.comComandosESCP === false) return texto + "\r\n";
    return "\x1B@" + "\x1B\x32" + (o.condensado ? "\x0F" : "\x12") + texto + "\r\n\f";
  }
  /* opcoes.moldes: { P: Molde, M: Molde, ... } para o quadro de peças reais. */
  function gerarTextoPuro(pedido, opcoes) {
    return gerarArquivoMatricialESCP(pedido, Object.assign({}, opcoes, { comComandosESCP: false }));
  }

  /* ---------- Navegador: impressão e download ---------- */
  function imprimirMolde(pedido) {
    var d = normalizar(pedido);
    var area = document.getElementById("area-impressao");
    if (!area) {
      area = document.createElement("div");
      area.id = "area-impressao";
    }
    // filho direto do body: a regra de impressão esconde todos os outros
    if (area.parentNode !== document.body) document.body.appendChild(area);
    area.innerHTML = gerarDesenhoTecnicoSVG(pedido) +
      '<section class="resumo-corte"><h2>Resumo de corte · ' + esc(d.time) + "</h2><table><thead><tr>" +
      TAMANHOS.map(function (t) { return "<th>" + t + "</th>"; }).join("") + "<th>Total</th></tr></thead><tbody><tr>" +
      d.grade.map(function (g) { return "<td>" + g.qtd + "</td>"; }).join("") + "<td><strong>" + d.total + "</strong></td></tr></tbody></table>" +
      "<p>Responsável: " + esc(d.responsavel) + " · " + esc(d.cidade) + " · Kit completo: " + esc(d.kit) + " · Prazo: " + esc(d.prazo) + "</p>" +
      (d.alertaTotal ? "<p><strong>" + esc(d.alertaTotal) + "</strong></p>" : "") +
      (d.observacoes ? "<p>Observações: " + esc(d.observacoes) + "</p>" : "") + "</section>";
    raiz.print();
  }
  function baixar(conteudo, tipo, pedido, extensao) {
    var d = normalizar(pedido);
    var base = ascii(d.time).slice(0, 50) + "-" + ascii(d.id).slice(0, 40);
    base = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    var url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "molde-" + (base || "pedido") + extensao;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function baixarPRN(pedido) { baixar(gerarArquivoMatricialESCP(pedido), "application/octet-stream", pedido, ".prn"); }
  function baixarTXT(pedido) { baixar(gerarTextoPuro(pedido), "text/plain;charset=utf-8", pedido, ".txt"); }

  var JPMoldeMatricial = {
    gerarDesenhoTecnicoSVG: gerarDesenhoTecnicoSVG,
    gerarArquivoMatricialESCP: gerarArquivoMatricialESCP,
    gerarTextoPuro: gerarTextoPuro,
    imprimirMolde: imprimirMolde, baixarPRN: baixarPRN, baixarTXT: baixarTXT,
    normalizar: normalizar, escapar: esc, textoCor: textoCor,
    MODALIDADES: MODALIDADES, STATUS: STATUS
  };
  raiz.JPMoldeMatricial = JPMoldeMatricial;
  if (typeof module !== "undefined" && module.exports) module.exports = JPMoldeMatricial;
})(typeof window !== "undefined" ? window : globalThis);

/* JP Sport · Painel de operação (login, abas, pedidos com molde técnico e promoções).
   Ao abrir uma aba dispara "jp-operacao:aba" em document, com detail
   { aba, perfil, modo }, para os módulos de promoções e usuários. */
(function () {
  "use strict";
  var Molde = window.JPMoldeMatricial;
  var esc = Molde.escapar;
  var DEMO = {
    admin: { email: "admin@jpsport.com", senha: "admin123" },
    operacao: { email: "operacao@jpsport.com", senha: "op123" }
  };
  var CARGOS = { admin_global: "Admin Global", operacao: "Operação" };
  var ABAS = ["pedidos", "promocoes", "usuarios"];
  var estado = { perfil: null, modo: "local", pedidos: [], selecionado: null, carga: 0, salvando: {} };
  var Pacote = window.JPPacoteImpressao;
  var moldes = { indice: null, porModelo: {} };

  /* Índice dos moldes do Audaces (app/moldes/index.json): decide se o pacote pode sair. */
  async function carregarIndiceMoldes() {
    if (!Pacote || typeof fetch !== "function") return;
    try {
      var r = await fetch("moldes/index.json");
      moldes.indice = r.ok ? await r.json() : {};
    } catch (e) { moldes.indice = {}; console.warn("[operacao] índice de moldes:", e); }
    renderInspetor();
  }
  async function moldesDoModelo(modelo) {
    if (moldes.porModelo[modelo]) return moldes.porModelo[modelo];
    var lista = {}, tamanhos = (moldes.indice[modelo] && moldes.indice[modelo].tamanhos) || [];
    await Promise.all(tamanhos.map(async function (t) {
      var r = await fetch("moldes/" + modelo + "/" + t + ".json");
      if (r.ok) lista[t] = await r.json();
    }));
    moldes.porModelo[modelo] = lista;
    return lista;
  }
  function textoAtletas(d) {
    if (!d.atletas.length) return "Sem lista (nome e número do projeto em todas)";
    var grupos = {};
    d.atletas.forEach(function (a) { (grupos[a.tamanho] = grupos[a.tamanho] || []).push([a.numero, a.nome].filter(Boolean).join(" ") || "-"); });
    return Object.keys(grupos).map(function (t) { return t + ": " + grupos[t].join(", "); }).join(" · ");
  }

  function el(id) { return document.getElementById(id); }
  function nomeDe(mapa, chave) { return Object.prototype.hasOwnProperty.call(mapa, chave) ? mapa[chave] : chave || "-"; }
  function statusDe(p) { return p.status || "novo"; }
  function acharPedido(id) {
    return estado.pedidos.find(function (p) { return String(p.id) === String(id); });
  }
  function dataHora(v) {
    var d = new Date(v);
    return isNaN(d) ? "-" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  /* ---------- Sessão ---------- */
  function mostrarLogin(mensagem) {
    estado.perfil = null;
    estado.pedidos = [];
    estado.selecionado = null;
    estado.salvando = {};
    estado.carga++; // descarta respostas ainda em trânsito
    el("lista-pedidos").innerHTML = "";
    el("inspetor").innerHTML = "";
    el("area-impressao").innerHTML = "";
    encerrarPromocoes();
    encerrarUsuarios();
    el("tela-painel").hidden = true;
    el("tela-login").hidden = false;
    el("login-erro").textContent = mensagem || "";
    el("login-modo").textContent = JP_DB.cliente()
      ? "Supabase configurado: contas reais usam o banco. Os botões abaixo entram no modo local se as contas de demonstração não existirem no banco."
      : "Modo local/protótipo: o Supabase não está disponível. Os dados ficam só neste navegador.";
  }
  async function abrirPainel() {
    var perfil = await JP_DB.perfilAtual();
    var sessao = perfil && await JP_DB.sessaoAtual();
    if (!perfil || !sessao) return false;
    estado.perfil = perfil;
    estado.modo = sessao.modo;
    el("usuario-nome").textContent = perfil.nome;
    el("usuario-email").textContent = perfil.email;
    el("usuario-cargo").textContent = nomeDe(CARGOS, perfil.role);
    el("usuario-modo").textContent = estado.modo;
    el("usuario-modo").title = estado.modo === "local" ? "Protótipo: dados só neste navegador" : "Dados do Supabase";
    document.querySelector('[data-aba="usuarios"]').hidden = perfil.role !== "admin_global";
    el("tela-login").hidden = true;
    el("tela-painel").hidden = false;
    trocarAba("pedidos");
    carregarPedidos();
    return true;
  }
  async function entrar(email, senha) {
    var botoes = document.querySelectorAll("#tela-login button");
    botoes.forEach(function (b) { b.disabled = true; });
    el("login-erro").textContent = "";
    try {
      var r = await JP_DB.login(email, senha);
      if (!r.ok) {
        el("login-erro").textContent = r.erro || "Não foi possível entrar.";
      } else if (await abrirPainel()) {
        el("form-login").reset();
      } else {
        el("login-erro").textContent = "Não foi possível carregar o seu perfil. Tente novamente.";
      }
    } catch (e) {
      console.error("[operacao] login:", e);
      el("login-erro").textContent = "Não foi possível entrar. Tente novamente.";
    }
    botoes.forEach(function (b) { b.disabled = false; });
  }

  /* ---------- Abas ---------- */
  function trocarAba(aba) {
    if (!estado.perfil || ABAS.indexOf(aba) < 0) return;
    ABAS.forEach(function (a) {
      el("tab-" + a).hidden = a !== aba;
      var b = document.querySelector('[data-aba="' + a + '"]');
      if (a === aba) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    document.dispatchEvent(new CustomEvent("jp-operacao:aba", {
      detail: { aba: aba, perfil: estado.perfil, modo: estado.modo }
    }));
  }

  /* ---------- Pedidos ---------- */
  async function carregarPedidos() {
    var carga = ++estado.carga;
    var aviso = el("pedidos-aviso");
    aviso.textContent = "";
    el("pedidos-contagem").textContent = "Carregando…";
    var r;
    try { r = await JP_DB.listarOrcamentos(); } catch (e) { r = { ok: false, dados: [], erro: String(e) }; }
    if (carga !== estado.carga) return;
    if (!r.ok) {
      aviso.textContent = "Não foi possível carregar os pedidos: " + (r.erro || "erro desconhecido");
    } else {
      estado.pedidos = r.dados;
      if (r.modo === "local" && estado.modo === "supabase") {
        aviso.textContent = "Supabase indisponível: exibindo pedidos locais deste navegador.";
      }
      if (!acharPedido(estado.selecionado)) estado.selecionado = null;
    }
    renderLista();
    renderInspetor();
  }
  function badgeStatus(p) {
    return '<span class="op-status" data-status="' + esc(statusDe(p)) + '">' + esc(nomeDe(Molde.STATUS, statusDe(p))) + "</span>";
  }
  function renderLista() {
    var st = el("filtro-status").value, mod = el("filtro-modalidade").value;
    var visiveis = estado.pedidos.filter(function (p) {
      return (st === "todos" || statusDe(p) === st) && (mod === "todas" || p.modalidade === mod);
    });
    el("pedidos-contagem").textContent = visiveis.length + (visiveis.length === 1 ? " pedido" : " pedidos");
    el("lista-pedidos").innerHTML = visiveis.map(function (p) {
      return '<button type="button" class="op-pedido" data-id="' + esc(p.id) + '" aria-pressed="' + (String(p.id) === estado.selecionado) + '">' +
        '<span class="op-pedido-linha"><strong>' + esc(p.time) + "</strong>" + badgeStatus(p) + "</span>" +
        "<span>" + esc(nomeDe(Molde.MODALIDADES, p.modalidade)) + " · " + Molde.normalizar(p).total + " peças</span>" +
        "<small>" + esc(p.id) + " · " + esc(dataHora(p.criado_em)) + "</small></button>";
    }).join("") || '<p class="op-vazio">' + (estado.pedidos.length
      ? "Nenhum pedido com esses filtros." : "Nenhum pedido para exibir.") + "</p>";
  }
  function renderInspetor() {
    var p = acharPedido(estado.selecionado);
    if (!p) {
      el("inspetor").innerHTML = '<p class="op-vazio">Selecione um pedido para ver os detalhes e o molde.</p>';
      return;
    }
    var d = Molde.normalizar(p);
    var valor = p.estimativa === null || p.estimativa === undefined ? NaN : Number(p.estimativa);
    var campos = [
      ["Pedido", d.id], ["Criado em", dataHora(p.criado_em)], ["Cidade", d.cidade], ["Responsável", d.responsavel],
      ["Modalidade", d.modalidade], ["Kit completo", d.kit], ["Prazo", d.prazo],
      ["Estimativa", isFinite(valor) ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"],
      ["Gola", d.golaTexto], ["Estampa", d.estampa], ["Número / nome", (d.numero || "-") + " / " + (d.nome || "-")],
      ["Cores", d.cores.map(Molde.textoCor).join(" · ") || "Não informadas"],
      ["Grade", d.grade.map(function (g) { return g.tamanho + ": " + g.qtd; }).join(" · ")],
      ["Total", d.total + " peças"], ["Atletas", textoAtletas(d)], ["Observações", d.observacoes || "-"]
    ];
    var pacote = "";
    if (Pacote) {
      var pode = moldes.indice ? Pacote.podeExportar(p, moldes.indice) : null;
      pacote = !pode ? '<p class="op-aviso">Carregando moldes…</p>'
        : pode.ok ? '<button type="button" class="btn btn-acao" data-acao="pacote">Baixar pacote de impressão</button>'
          : '<p class="op-aviso op-bloqueado">' + esc(pode.motivo) + ": o pacote de impressão não sai para este pedido.</p>";
    }
    el("inspetor").innerHTML =
      '<header class="op-inspetor-topo"><h2 class="t-h3">' + esc(d.time) + "</h2>" +
      '<div class="campo"><label for="pedido-status">Status do pedido</label><select id="pedido-status"' +
      (estado.salvando[String(p.id)] ? " disabled" : "") + ">" +
      Object.keys(Molde.STATUS).map(function (s) {
        return '<option value="' + s + '"' + (s === statusDe(p) ? " selected" : "") + ">" + esc(Molde.STATUS[s]) + "</option>";
      }).join("") + "</select></div></header>" +
      '<p id="status-aviso" class="op-aviso" role="status"></p>' +
      (d.alertaTotal ? '<p class="op-erro">' + esc(d.alertaTotal) + "</p>" : "") +
      '<dl class="op-detalhes">' + campos.map(function (c) {
        return "<div><dt>" + c[0] + "</dt><dd>" + esc(c[1]) + "</dd></div>";
      }).join("") + "</dl>" +
      '<div class="op-acoes op-acoes-pacote">' + pacote + '</div><p id="pacote-aviso" class="op-aviso" role="status"></p>' +
      (Pacote ? formPerfil() : "") +
      '<div class="op-acoes">' +
      '<button type="button" class="op-btn" data-acao="imprimir">Imprimir Desenho Técnico (P&amp;B)</button>' +
      '<button type="button" class="op-btn" data-acao="prn">Baixar Molde Matricial (.prn ESC/P)</button>' +
      '<button type="button" class="op-btn" data-acao="txt">Baixar Ficha (.txt)</button></div>' +
      '<div class="op-preview">' + Molde.gerarDesenhoTecnicoSVG(p) + "</div>";
  }
  /* ---------- Perfil de produção (plotter) ---------- */
  var CAMPOS_PERFIL = [["larguraUtil", "Largura útil (mm)"], ["margemLateral", "Margem lateral (mm)"], ["sangria", "Sangria (mm)"],
    ["espaco", "Espaço entre peças (mm)"], ["comprimentoMax", "Comprimento máx. por prancha (mm)"], ["areaSegura", "Área segura (mm)"]];
  var MARCAS_PERFIL = [["girar90", "Girar peças 90° quando não couberem"], ["espelhar", "Espelhar (só se o RIP não espelha)"],
    ["linhasTecnicas", "Imprimir fio e piques"]];
  function formPerfil() {
    var pf = Pacote.lerPerfil(window.localStorage);
    return '<details class="op-perfil"><summary>Perfil de produção da plotter</summary><form id="form-perfil" class="op-perfil-campos">' +
      CAMPOS_PERFIL.map(function (c) {
        return '<div class="campo"><label for="perfil-' + c[0] + '">' + c[1] + '</label><input id="perfil-' + c[0] + '" name="' + c[0] +
          '" type="number" step="1" value="' + esc(pf[c[0]]) + '"></div>';
      }).join("") +
      MARCAS_PERFIL.map(function (c) {
        return '<label class="op-check"><input type="checkbox" name="' + c[0] + '"' + (pf[c[0]] ? " checked" : "") + "> " + c[1] + "</label>";
      }).join("") +
      '<div class="op-acoes"><button type="submit" class="op-btn">Salvar perfil</button></div>' +
      '<p id="perfil-aviso" class="op-aviso" role="status"></p></form></details>';
  }
  function salvarPerfilDoForm(form) {
    var entrada = {};
    CAMPOS_PERFIL.forEach(function (c) { entrada[c[0]] = form.elements[c[0]].value; });
    MARCAS_PERFIL.forEach(function (c) { entrada[c[0]] = form.elements[c[0]].checked; });
    var r = Pacote.salvarPerfil(window.localStorage, entrada);
    el("perfil-aviso").textContent = r.ok ? "Perfil salvo neste navegador." : r.erro;
    el("perfil-aviso").classList.toggle("op-erro", !r.ok);
  }

  /* ---------- Pacote de impressão ---------- */
  function base64(buffer) {
    var bytes = new Uint8Array(buffer), partes = [];
    for (var i = 0; i < bytes.length; i += 0x8000) partes.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
    return btoa(partes.join(""));
  }
  function carregarImagem(src) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
  }
  /* Prévia PNG da primeira prancha do unificado, a 0,5 px/mm. */
  function previaPNG(perfil, projeto) {
    return async function (uni) {
      var pr = uni.encaixe[0], k = 0.5, c = document.createElement("canvas");
      c.width = Math.round(perfil.larguraUtil * k);
      c.height = Math.round(pr.comprimento * k);
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.scale(k, k);
      var escudo = Pacote.escudoValido(projeto.escudo) ? await carregarImagem(projeto.escudo) : null;
      pr.itens.forEach(function (it) {
        var s = perfil.sangria;
        ctx.save();
        if (it.girado) { ctx.translate(it.x + it.altura - s, it.y + s); ctx.rotate(Math.PI / 2); } else ctx.translate(it.x + s, it.y + s);
        JPArtePecas.desenharPeca(ctx, it.peca, projeto, it.copia.atleta, { sangria: s, escudo: escudo });
        ctx.restore();
      });
      return new Promise(function (ok) {
        c.toBlob(function (b) { b.arrayBuffer().then(function (a) { ok(new Uint8Array(a)); }); }, "image/png");
      });
    };
  }
  async function baixarPacote(p) {
    var botao = document.querySelector('[data-acao="pacote"]');
    var aviso = el("pacote-aviso");
    var perfilSessao = estado.perfil;
    if (botao) botao.disabled = true;
    aviso.classList.remove("op-erro");
    aviso.textContent = "Gerando o pacote… (pode levar alguns segundos)";
    try {
      var pode = Pacote.podeExportar(p, moldes.indice);
      if (!pode.ok) throw new Error(pode.motivo);
      var perfil = Pacote.lerPerfil(window.localStorage);
      var r = await Pacote.gerarPacote(p, {
        moldes: await moldesDoModelo(pode.modelo), indice: moldes.indice, perfil: perfil,
        jsPDF: window.jspdf && window.jspdf.jsPDF, JSZip: window.JSZip,
        carregarTTF: async function (arquivo) { return base64(await (await fetch("assets/fontes/" + arquivo)).arrayBuffer()); },
        previaPNG: previaPNG(perfil, p.projeto_3d || {})
      });
      if (estado.perfil !== perfilSessao) return;
      if (r.erro) throw new Error(r.erro);
      var url = URL.createObjectURL(new Blob([r.zip], { type: "application/zip" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = "pacote-" + String(p.id).replace(/[^\w.-]+/g, "_") + ".zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      aviso.textContent = "Pacote gerado." + (r.avisos.length ? " Avisos: " + r.avisos.join(" · ") : "");
    } catch (e) {
      console.error("[operacao] pacote:", e);
      aviso.textContent = "Não foi possível gerar o pacote: " + (e && e.message ? e.message : e);
      aviso.classList.add("op-erro");
    }
    if (botao && document.body.contains(botao)) botao.disabled = false;
  }

  function selecionar(id) {
    estado.selecionado = String(id);
    document.querySelectorAll(".op-pedido").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.id === estado.selecionado));
    });
    renderInspetor();
    if (window.matchMedia("(max-width: 960px)").matches) {
      el("inspetor").scrollIntoView({ block: "start" });
      el("inspetor").focus({ preventScroll: true });
    }
  }
  async function mudarStatus(id, status) {
    var perfil = estado.perfil;
    estado.salvando[id] = true;
    el("pedido-status").disabled = true;
    el("status-aviso").textContent = "Salvando…";
    var r;
    try { r = await JP_DB.atualizarStatusOrcamento(id, status); } catch (e) { r = { ok: false, erro: String(e) }; }
    if (estado.perfil !== perfil) return; // saiu do painel enquanto salvava
    delete estado.salvando[id];
    var p = acharPedido(id);
    if (r.ok && p) p.status = status;
    renderLista();
    if (estado.selecionado === id) {
      renderInspetor();
      el("status-aviso").textContent = r.ok ? "Status atualizado." : "Não foi possível atualizar o status: " + (r.erro || "erro desconhecido");
      el("status-aviso").classList.toggle("op-erro", !r.ok);
      el("pedido-status").focus({ preventScroll: true });
    } else if (!r.ok) {
      el("pedidos-aviso").textContent = "Não foi possível atualizar o pedido " + id + ": " + (r.erro || "erro desconhecido");
    }
  }

  /* ---------- Promoções ---------- */
  var Feed = window.JPFeedPromocoes;
  var LINK_INVALIDO = "Link inválido: use um caminho relativo ou http/https, sem espaços.";
  var promos = { dados: [], carga: 0, ocupado: false };

  function campoPromo(id, rotulo, atributos, largo) {
    return '<div class="campo' + (largo ? " op-largo" : "") + '"><label for="promo-' + id + '">' + rotulo + "</label>" +
      '<input id="promo-' + id + '" name="' + id + '" ' + (atributos || 'type="text"') + "></div>";
  }
  function montarPromocoes() {
    if (el("form-promocao")) return;
    el("promocoes-conteudo").innerHTML =
      '<div class="op-promo-editor"><form id="form-promocao" class="op-cartao" autocomplete="off">' +
      '<h3 id="promo-form-titulo" class="op-subtitulo">Nova promoção</h3>' +
      '<input type="hidden" id="promo-id" name="id">' +
      '<div class="op-promo-campos">' +
      campoPromo("titulo", "Título (obrigatório)", 'type="text" required', true) +
      campoPromo("subtitulo", "Subtítulo", "", true) +
      campoPromo("badge", "Badge", 'type="text" placeholder="Oferta, Temporada, Frete Grátis"') +
      campoPromo("desconto_texto", "Desconto", 'type="text" placeholder="15% OFF, Kit completo"') +
      '<div class="campo"><label for="promo-modalidade">Modalidade</label><select id="promo-modalidade" name="modalidade">' +
      '<option value="">Geral / Todas</option><option value="futebol">Futebol</option>' +
      '<option value="basquete">Basquete</option><option value="volei">Vôlei</option></select></div>' +
      campoPromo("valida_ate", "Válida até", 'type="date" max="9999-12-31"') +
      campoPromo("cta_texto", "Texto do botão", 'type="text" value="Aproveitar"') +
      campoPromo("cta_link", "Link do botão", 'type="text" value="orcamento.html"') +
      campoPromo("ordem", "Ordem", 'type="number" step="1" min="-9999" max="9999" value="0"') +
      '<label class="op-check"><input type="checkbox" id="promo-ativa" name="ativa" checked> Promoção ativa</label>' +
      "</div>" +
      '<p id="promo-aviso" class="op-aviso" role="status"></p>' +
      '<div class="op-acoes"><button type="submit" class="btn btn-acao">Salvar promoção</button>' +
      '<button type="button" id="promo-limpar" class="op-btn">Limpar / Nova</button></div></form>' +
      '<section class="op-promo-previa" aria-labelledby="promo-previa-titulo">' +
      '<h3 id="promo-previa-titulo" class="op-subtitulo">Pré-visualização</h3>' +
      '<div id="promo-previa" inert></div><p id="promo-previa-nota" class="op-modo-info"></p></section></div>' +
      '<section aria-labelledby="promo-lista-titulo"><div class="op-lista-topo">' +
      '<h3 id="promo-lista-titulo" class="op-subtitulo">Promoções cadastradas</h3>' +
      '<span id="promo-contagem" role="status"></span></div>' +
      '<p id="promo-lista-aviso" class="op-aviso" role="status"></p>' +
      '<div id="promo-lista" class="op-promo-lista"></div></section>';

    el("form-promocao").addEventListener("submit", function (e) { e.preventDefault(); salvarPromocao(); });
    el("form-promocao").addEventListener("input", renderPrevia);
    el("form-promocao").addEventListener("change", renderPrevia);
    el("promo-limpar").addEventListener("click", function () {
      limparPromocao();
      el("promo-titulo").focus();
    });
    el("promo-lista").addEventListener("click", function (e) {
      var b = e.target.closest("[data-promo-acao]");
      var p = b && acharPromocao(b.closest("[data-promo-id]").dataset.promoId);
      if (!p || promos.ocupado) return;
      if (b.dataset.promoAcao === "editar") editarPromocao(p);
      else if (b.dataset.promoAcao === "alternar") alternarPromocao(p);
      else excluirPromocao(p);
    });
    renderPrevia();
  }
  /* Saída do painel: descarta o rascunho, a lista e respostas em trânsito. */
  function encerrarPromocoes() {
    promos.dados = [];
    promos.ocupado = false;
    promos.carga++;
    el("promocoes-conteudo").innerHTML = "";
  }
  function acharPromocao(id) {
    return promos.dados.find(function (p) { return String(p.id) === String(id); });
  }
  function avisar(id, mensagem, erro) {
    el(id).textContent = mensagem;
    el(id).classList.toggle("op-erro", !!erro);
  }
  function ocuparPromocoes(sim) {
    promos.ocupado = sim;
    el("promocoes-conteudo").querySelectorAll("input, select, button").forEach(function (c) { c.disabled = sim; });
  }
  function lerPromocao() {
    function v(nome) { return el("promo-" + nome).value.trim(); }
    return {
      id: el("promo-id").value, // sempre string: ids locais são "local-..."
      titulo: v("titulo"), subtitulo: v("subtitulo") || null, badge: v("badge") || null,
      desconto_texto: v("desconto_texto") || null, modalidade: v("modalidade") || null,
      cta_texto: v("cta_texto") || "Aproveitar", cta_link: v("cta_link") || "orcamento.html",
      valida_ate: v("valida_ate") || null, ordem: parseInt(v("ordem"), 10) || 0,
      ativa: el("promo-ativa").checked
    };
  }
  function renderPrevia() {
    var p = lerPromocao();
    var notas = [];
    if (!p.ativa) notas.push("Pausada: não aparece no feed.");
    if (Feed.expirada(p)) notas.push("Validade vencida: não aparece no feed.");
    if (!Feed.linkSeguro(p.cta_link)) notas.push(LINK_INVALIDO);
    el("promo-previa").innerHTML = Feed.cardHTML(Object.assign({}, p, { titulo: p.titulo || "Título da promoção" }));
    el("promo-previa-nota").textContent = notas.join(" ");
  }
  function limparPromocao() {
    el("form-promocao").reset();
    el("promo-id").value = ""; // reset() não limpa campos ocultos
    el("promo-form-titulo").textContent = "Nova promoção";
    avisar("promo-aviso", "");
    renderPrevia();
  }
  function editarPromocao(p) {
    limparPromocao();
    el("promo-id").value = String(p.id);
    ["titulo", "subtitulo", "badge", "desconto_texto", "modalidade", "cta_texto", "cta_link"].forEach(function (k) {
      el("promo-" + k).value = p[k] === null || p[k] === undefined ? "" : p[k];
    });
    el("promo-valida_ate").value = String(p.valida_ate || "").slice(0, 10);
    el("promo-ordem").value = Number(p.ordem) || 0;
    el("promo-ativa").checked = !!p.ativa;
    el("promo-form-titulo").textContent = "Editar promoção";
    renderPrevia();
    el("form-promocao").scrollIntoView({ block: "start" });
    el("promo-titulo").focus({ preventScroll: true });
  }
  function renderPromocoes() {
    el("promo-contagem").textContent = promos.dados.length + (promos.dados.length === 1 ? " promoção" : " promoções");
    el("promo-lista").innerHTML = promos.dados.map(function (p) {
      var detalhes = [Feed.nomeModalidade(p.modalidade), "Ordem " + (Number(p.ordem) || 0),
        p.valida_ate ? "Válida até " + Feed.dataBR(p.valida_ate) + (Feed.expirada(p) ? " (vencida)" : "") : "Sem validade"];
      var titulo = esc(p.titulo);
      return '<article class="op-promo-item" data-promo-id="' + esc(p.id) + '"><div class="op-promo-info">' +
        '<div class="op-promo-selos"><span class="op-status" data-status="' + (p.ativa ? "ativa" : "pausada") + '">' +
        (p.ativa ? "Ativa" : "Pausada") + "</span>" +
        (p.badge ? '<span class="op-status">' + esc(p.badge) + "</span>" : "") +
        (p.desconto_texto ? "<b>" + esc(p.desconto_texto) + "</b>" : "") + "</div>" +
        "<strong>" + titulo + "</strong><small>" + esc(detalhes.join(" · ")) + "</small></div>" +
        '<div class="op-acoes">' + [["editar", "Editar"], ["alternar", p.ativa ? "Pausar" : "Ativar"], ["excluir", "Excluir"]].map(function (a) {
          return '<button type="button" class="op-btn" data-promo-acao="' + a[0] + '" aria-label="' + a[1] + ": " + titulo + '"' +
            (promos.ocupado ? " disabled" : "") + ">" + a[1] + "</button>";
        }).join("") + "</div></article>";
    }).join("") || '<p class="op-vazio">Nenhuma promoção para exibir.</p>';
  }
  async function carregarPromocoes() {
    var carga = ++promos.carga;
    el("promo-contagem").textContent = "Carregando…";
    var r;
    try { r = await JP_DB.listarPromocoes({ apenasAtivas: false }); } catch (e) { r = { ok: false, erro: String(e) }; }
    if (carga !== promos.carga) return;
    if (!r.ok) {
      avisar("promo-lista-aviso", "Não foi possível carregar as promoções: " + (r.erro || "erro desconhecido"), true);
    } else {
      promos.dados = Feed.ordenar(r.dados);
      if (r.modo === "local" && estado.modo === "supabase") {
        avisar("promo-lista-aviso", "Supabase indisponível: exibindo promoções locais deste navegador.", true);
      }
    }
    renderPromocoes();
  }
  /* Grava, avisa e recarrega a lista; ignora a resposta se o usuário saiu. */
  async function gravarPromocao(avisoId, fn, sucesso, aoConcluir) {
    if (promos.ocupado) return;
    var perfil = estado.perfil;
    avisar("promo-aviso", "");
    avisar("promo-lista-aviso", "");
    ocuparPromocoes(true);
    avisar(avisoId, "Salvando…");
    var r;
    try { r = await fn(); } catch (e) { r = { ok: false, erro: String(e) }; }
    if (estado.perfil !== perfil) return;
    ocuparPromocoes(false);
    if (!r.ok) {
      avisar(avisoId, "Não foi possível concluir: " + (r.erro || "erro desconhecido"), true);
      return;
    }
    aoConcluir();
    var soLocal = r.modo === "local" && estado.modo === "supabase";
    avisar(avisoId, sucesso + (soLocal ? " Atenção: alterada só neste navegador." : ""), soLocal);
    await carregarPromocoes();
  }
  function salvarPromocao() {
    var p = lerPromocao();
    if (!p.titulo || !Feed.linkSeguro(p.cta_link)) {
      avisar("promo-aviso", p.titulo ? LINK_INVALIDO : "Informe o título da promoção.", true);
      el(p.titulo ? "promo-cta_link" : "promo-titulo").focus();
      return;
    }
    gravarPromocao("promo-aviso", function () { return JP_DB.salvarPromocao(p); },
      p.id ? "Promoção atualizada." : "Promoção criada.", limparPromocao);
  }
  async function alternarPromocao(p) {
    var ativa = !p.ativa, id = String(p.id);
    await gravarPromocao("promo-lista-aviso", function () { return JP_DB.salvarPromocao({ id: p.id, ativa: ativa }); },
      ativa ? "Promoção ativada." : "Promoção pausada.", function () {
        // em edição: evita que salvar o formulário desfaça a mudança
        if (el("promo-id").value === id) { el("promo-ativa").checked = ativa; renderPrevia(); }
      });
    // a lista foi refeita: devolve o foco ao botão, se ele não foi para outro lugar
    if (!el("promo-lista") || document.activeElement !== document.body) return;
    el("promo-lista").querySelectorAll("[data-promo-id]").forEach(function (item) {
      if (item.dataset.promoId === id) item.querySelector('[data-promo-acao="alternar"]').focus({ preventScroll: true });
    });
  }
  function excluirPromocao(p) {
    if (!window.confirm('Excluir a promoção "' + p.titulo + '"?')) return;
    gravarPromocao("promo-lista-aviso", function () { return JP_DB.excluirPromocao(p.id); }, "Promoção excluída.", function () {
      if (el("promo-id").value === String(p.id)) limparPromocao();
    });
  }
  document.addEventListener("jp-operacao:aba", function (e) {
    if (e.detail.aba !== "promocoes") return;
    montarPromocoes(); // só na primeira vez: preserva o rascunho ao trocar de aba
    if (promos.ocupado) return; // a gravação em curso já recarrega a lista
    avisar("promo-aviso", "");
    avisar("promo-lista-aviso", "");
    carregarPromocoes();
  });

  /* ---------- Usuários (só admin_global; no banco, quem garante é o RLS) ---------- */
  var SENHA_MINIMA = 6;
  var users = { dados: [], carga: 0, ocupado: false, montado: false };

  function ehAdmin() { return !!estado.perfil && estado.perfil.role === "admin_global"; }
  function campoUsuario(id, rotulo, atributos) {
    return '<div class="campo"><label for="usuario-form-' + id + '">' + rotulo + "</label>" +
      '<input id="usuario-form-' + id + '" name="' + id + '" ' + atributos + "></div>";
  }
  function montarUsuarios() {
    if (users.montado) return;
    users.montado = true;
    el("usuarios-conteudo").innerHTML =
      '<form id="form-usuario" class="op-cartao" autocomplete="off">' +
      '<h3 class="op-subtitulo">Novo usuário de operação</h3><div class="op-usuario-campos">' +
      campoUsuario("nome", "Nome (obrigatório)", 'type="text" required') +
      campoUsuario("email", "E-mail (obrigatório)", 'type="email" required') +
      campoUsuario("senha", "Senha (mínimo " + SENHA_MINIMA + " caracteres)",
        'type="password" autocomplete="new-password" required minlength="' + SENHA_MINIMA + '"') +
      '</div><p id="usuario-aviso" class="op-aviso" role="status"></p>' +
      '<div class="op-acoes"><button type="submit" class="btn btn-acao">Criar usuário de operação</button></div></form>' +
      '<section aria-labelledby="usuario-lista-titulo"><div class="op-lista-topo">' +
      '<h3 id="usuario-lista-titulo" class="op-subtitulo">Usuários cadastrados</h3>' +
      '<span id="usuario-contagem" role="status"></span></div>' +
      '<p id="usuario-lista-aviso" class="op-aviso" role="status"></p>' +
      '<div id="usuario-lista" class="op-tabela-caixa"></div></section>';

    el("form-usuario").addEventListener("submit", function (e) { e.preventDefault(); criarUsuario(); });
    el("usuario-lista").addEventListener("click", function (e) {
      var b = e.target.closest("[data-usuario-id]");
      if (b) alternarUsuario(b.dataset.usuarioId);
    });
  }
  /* Saída do painel ou acesso negado: descarta dados e respostas em trânsito. */
  function encerrarUsuarios() {
    users.dados = [];
    users.ocupado = false;
    users.montado = false;
    users.carga++;
    el("usuarios-conteudo").innerHTML = "";
  }
  function ocuparUsuarios(sim) {
    users.ocupado = sim;
    el("form-usuario").querySelectorAll("input, button").forEach(function (c) { c.disabled = sim; });
    renderUsuarios();
  }
  function renderUsuarios() {
    var linhas = users.dados.map(function (u) {
      var voce = String(u.id) === String(estado.perfil.id);
      var acao = u.ativo ? "Desativar" : "Ativar";
      var nome = esc(u.nome);
      return '<tr><th scope="row" data-rotulo="Nome">' + nome + '</th><td data-rotulo="E-mail">' + esc(u.email) + "</td>" +
        '<td data-rotulo="Perfil"><span class="op-badge" data-role="' + esc(u.role) + '">' + esc(nomeDe(CARGOS, u.role)) + "</span></td>" +
        '<td data-rotulo="Status"><span class="op-status" data-status="' + (u.ativo ? "ativa" : "pausada") + '">' +
        (u.ativo ? "Ativo" : "Inativo") + "</span></td>" +
        '<td data-rotulo="Criado em">' + esc(dataHora(u.criado_em)) + "</td>" +
        '<td><button type="button" class="op-btn" data-usuario-id="' + esc(u.id) + '" aria-label="' + acao + ": " + nome + (voce ? " (você)" : "") + '"' +
        (voce || users.ocupado ? " disabled" : "") + ">" + acao + (voce ? " (você)" : "") + "</button></td></tr>";
    }).join("");
    el("usuario-contagem").textContent = users.dados.length + (users.dados.length === 1 ? " usuário" : " usuários");
    el("usuario-lista").innerHTML = linhas
      ? '<table class="op-tabela"><thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Perfil</th>' +
        '<th scope="col">Status</th><th scope="col">Criado em</th><th scope="col">Ação</th></tr></thead><tbody>' + linhas + "</tbody></table>"
      : '<p class="op-vazio">Nenhum usuário para exibir.</p>';
  }
  async function carregarUsuarios() {
    var carga = ++users.carga;
    el("usuario-contagem").textContent = "Carregando…";
    var r;
    try { r = await JP_DB.listarUsuarios(); } catch (e) { r = { ok: false, erro: String(e) }; }
    if (carga !== users.carga) return;
    if (!r.ok) {
      avisar("usuario-lista-aviso", "Não foi possível carregar os usuários: " + (r.erro || "erro desconhecido"), true);
    } else {
      users.dados = r.dados;
      if (r.modo === "local" && estado.modo === "supabase") {
        avisar("usuario-lista-aviso", "Supabase indisponível: exibindo usuários locais deste navegador.", true);
      }
    }
    renderUsuarios();
  }
  /* Grava e devolve o resultado; null se o usuário saiu enquanto gravava. */
  async function gravarUsuario(avisoId, fn) {
    var perfil = estado.perfil;
    avisar("usuario-aviso", "");
    avisar("usuario-lista-aviso", "");
    ocuparUsuarios(true);
    avisar(avisoId, "Salvando…");
    var r;
    try { r = await fn(); } catch (e) { r = { ok: false, erro: String(e) }; }
    if (estado.perfil !== perfil) return null;
    ocuparUsuarios(false);
    if (!r.ok) avisar(avisoId, "Não foi possível concluir: " + (r.erro || "erro desconhecido"), true);
    return r;
  }
  async function criarUsuario() {
    if (!ehAdmin() || users.ocupado) return;
    var novo = {
      nome: el("usuario-form-nome").value.trim(), email: el("usuario-form-email").value.trim(),
      senha: el("usuario-form-senha").value
    };
    var invalido = !novo.nome ? ["nome", "Informe o nome."] : !novo.email ? ["email", "Informe o e-mail."]
      : novo.senha.length < SENHA_MINIMA ? ["senha", "A senha precisa ter no mínimo " + SENHA_MINIMA + " caracteres."] : null;
    if (invalido) {
      avisar("usuario-aviso", invalido[1], true);
      el("usuario-form-" + invalido[0]).focus();
      return;
    }
    var r = await gravarUsuario("usuario-aviso", function () { return JP_DB.criarUsuarioOperacao(novo); });
    if (!r || !r.ok) return;
    el("form-usuario").reset();
    var soLocal = r.modo === "local" && (!!r.erro || estado.modo === "supabase");
    avisar("usuario-aviso", soLocal
      ? "Atenção: o usuário foi salvo apenas localmente neste navegador e não foi cadastrado no Supabase" +
        (r.erro ? " (" + r.erro + ")" : "") + ". Ele não terá acesso em outros dispositivos e pode não aparecer na lista abaixo."
      : "Usuário de operação criado.", soLocal);
    await carregarUsuarios();
  }
  async function alternarUsuario(id) {
    var u = users.dados.find(function (x) { return String(x.id) === String(id); });
    if (!u || users.ocupado || !ehAdmin() || String(u.id) === String(estado.perfil.id)) return;
    var ativo = !u.ativo;
    var r = await gravarUsuario("usuario-lista-aviso", function () { return JP_DB.alternarStatusUsuario(String(u.id), ativo); });
    if (!r) return;
    if (r.ok) {
      var soLocal = r.modo === "local" && estado.modo === "supabase";
      avisar("usuario-lista-aviso", (ativo ? "Usuário ativado." : "Usuário desativado.") +
        (soLocal ? " Atenção: alterado só neste navegador." : ""), soLocal);
      await carregarUsuarios();
    }
    // a lista foi refeita: devolve o foco ao botão, se ele não foi para outro lugar
    if (!users.montado || document.activeElement !== document.body) return;
    el("usuario-lista").querySelectorAll("[data-usuario-id]").forEach(function (b) {
      if (b.dataset.usuarioId === String(id)) b.focus({ preventScroll: true });
    });
  }
  document.addEventListener("jp-operacao:aba", function (e) {
    if (e.detail.aba !== "usuarios") return;
    // usa o perfil da sessão, não o do evento, que qualquer script pode disparar
    if (!ehAdmin()) {
      encerrarUsuarios();
      el("usuarios-conteudo").innerHTML = '<p class="op-vazio" role="alert">Acesso restrito: apenas o administrador global pode gerenciar usuários.</p>';
      return;
    }
    montarUsuarios(); // só na primeira vez: preserva o rascunho ao trocar de aba
    if (users.ocupado) return; // a gravação em curso já recarrega a lista
    avisar("usuario-aviso", "");
    avisar("usuario-lista-aviso", "");
    carregarUsuarios();
  });

  /* ---------- Eventos ---------- */
  el("form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    entrar(el("login-email").value, el("login-senha").value);
  });
  document.querySelectorAll("[data-demo]").forEach(function (b) {
    b.addEventListener("click", function () { var c = DEMO[b.dataset.demo]; entrar(c.email, c.senha); });
  });
  el("btn-sair").addEventListener("click", async function () {
    await JP_DB.logout();
    mostrarLogin();
  });
  document.querySelector(".op-abas").addEventListener("click", function (e) {
    var b = e.target.closest("[data-aba]");
    if (b) trocarAba(b.dataset.aba);
  });
  el("filtro-status").addEventListener("change", renderLista);
  el("filtro-modalidade").addEventListener("change", renderLista);
  el("btn-recarregar").addEventListener("click", carregarPedidos);
  el("lista-pedidos").addEventListener("click", function (e) {
    var b = e.target.closest("[data-id]");
    if (b) selecionar(b.dataset.id);
  });
  el("inspetor").addEventListener("submit", function (e) {
    if (!e.target || e.target.id !== "form-perfil") return;
    e.preventDefault();
    salvarPerfilDoForm(e.target);
  });
  el("inspetor").addEventListener("change", function (e) {
    if (e.target.id === "pedido-status") mudarStatus(estado.selecionado, e.target.value);
  });
  el("inspetor").addEventListener("click", function (e) {
    var b = e.target.closest("[data-acao]");
    var p = b && acharPedido(estado.selecionado);
    if (!p) return;
    if (b.dataset.acao === "pacote") baixarPacote(p);
    else if (b.dataset.acao === "imprimir") Molde.imprimirMolde(p);
    else if (b.dataset.acao === "prn") Molde.baixarPRN(p);
    else Molde.baixarTXT(p);
  });

  carregarIndiceMoldes();
  (async function () {
    try {
      if (!(await abrirPainel())) mostrarLogin();
    } catch (e) {
      console.error("[operacao] início:", e);
      mostrarLogin("Não foi possível verificar a sessão. Entre novamente.");
    }
  })();
})();

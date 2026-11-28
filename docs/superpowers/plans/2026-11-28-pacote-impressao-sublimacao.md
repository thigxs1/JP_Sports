# Pacote de impressão para sublimação · plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o painel de operação baixa um `.zip` com ficha técnica, PDFs 1:1 por tamanho e um PDF unificado, com a arte do cliente (posicionada livremente no simulador) dentro dos moldes do Audaces e um jogo de peças por atleta.

**Architecture:** os PLT viram JSON de moldes em mm (`app/moldes/`). Um módulo de arte (`app/js/arte-pecas.js`) desenha cada peça com a API do Canvas 2D em mm, a partir de um layout em cm preso ao decote/centro. O mesmo código pinta a textura 3D (via calibração afim mm → px de UV) e o PDF (via `doc.context2d` do jsPDF). O pacote (`app/js/pacote-impressao.js`) faz o encaixe na largura útil e monta o zip com JSZip.

**Tech Stack:** HTML/CSS/JS puro sem build; Three.js r128 (já existe); jsPDF 2.5.1 e JSZip 3.10.1 por CDN no navegador e como `devDependencies` para os testes em Node; testes Node com `assert` no padrão `tests/verify_*.js`.

**Spec:** `docs/superpowers/specs/2026-11-28-pacote-impressao-sublimacao-design.md`

## Global Constraints
- Unidade HPGL: **40 unidades = 1 mm**. Moldes guardados em **mm**, eixo x na largura da peça, eixo y de cima (decote/cabeça da manga) para baixo.
- Escala 1:1 sempre; peça nunca é esticada. Rotação só de 90°, e só se o perfil permitir.
- Perfil padrão: `larguraUtil: 1600`, `margemLateral: 10`, `sangria: 5`, `espaco: 10`, `girar90: true`, `espelhar: false`, `comprimentoMax: 5000`, `linhasTecnicas: true`, `areaSegura: 20` (todos em mm).
- Quadrado de controle de **100 × 100 mm** em toda prancha, com "ESCALA 1:1".
- Pacote só para `modalidade === "futebol"` e `gola === "redonda"`; nos outros casos, aviso **"Molde de gola V/polo não cadastrado"** (ou "Molde de <modalidade> não cadastrado") e só a ficha técnica.
- Atletas: nome até **15** caracteres, número até **3** dígitos (string, preserva zeros), tamanho em `P, M, G, GG, XG, Infantil`, no máximo **200** por pedido.
- Elemento da arte tem o mesmo tamanho em cm em todos os tamanhos; posição em cm a partir da âncora (`decote` ou `centro`).
- Todo texto vindo de pedido é escapado (HTML/SVG) e o `.prn` continua ASCII de 80 colunas.
- CDNs: `https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js` (expõe `window.jspdf.jsPDF`) e `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` (expõe `window.JSZip`).
- Fontes da arte no PDF: TTF incorporadas a partir de `app/assets/fontes/` (licença OFL junto). Baixar os TTF é um download: **pedir autorização ao usuário antes** (Task 3).

## Review Focus
1. **Nome com acento, cedilha ou emoji** ("JOÃO", "MÜLLER", "🔥"): acentos saem certos no PDF; caracteres fora da fonte são removidos e geram aviso no manifesto (teste na Task 4).
2. **Pedido antigo sem `layout`, sem `atletas` ou sem `projeto_3d`**: exporta com o layout padrão e a grade; sem `projeto_3d`, cores padrão com aviso (teste na Task 4).
3. **Perfil estreito demais** (largura útil 500 mm): nada é reduzido; o pacote falha com "Perfil de 500 mm não comporta a peça Frente (590 mm)" (teste na Task 4).
4. **Escudo enorme ou transparente** (foto de 6000 × 4000, PNG com alfa): salvo com lado máximo de 1500 px, mantendo a transparência (teste na Task 6).
5. **Lista colada malformada** (`gg` minúsculo, número `007`, linha sem tamanho, separador `,` ou tab): tamanho normalizado sem diferenciar maiúsculas, número preservado como texto, linha inválida rejeitada com aviso pela linha (teste na Task 7).

---

### Task 0: Branch e documentos
- [ ] **Step 1:** `git fetch && git checkout -b feat/pacote-impressao origin/main`
- [ ] **Step 2:** commitar a spec, este plano e `docs/ACOMPANHAMENTO.md` (`git commit -m "docs: spec e plano do pacote de impressão"`).

### Task 1: Biblioteca de moldes (PLT → JSON)

**Files:**
- Create: `scripts/importar_molde_plt.js`, `app/moldes/index.json`, `app/moldes/camiseta-basica/{P,M,G}.json`, `app/moldes/camiseta-basica/fonte/CAMISETA BASICA {P,M,G}.plt` (copiados de `%USERPROFILE%\Downloads`)
- Test: `tests/verify_moldes.js`

**Interfaces:**
- Produces: `importarPLT(texto: string, meta: {modelo, tamanho, versao}) -> Molde` (exportado por `module.exports`); CLI `node scripts/importar_molde_plt.js <arquivo.plt> <modelo> <tamanho>` grava `app/moldes/<modelo>/<tamanho>.json`.
- `Molde = { modelo, tamanho, versao: "audaces-2026-11", unidade: "mm", pecas: Peca[] }`
- `Peca = { id: "frente"|"costas"|"manga-esquerda"|"manga-direita"|"ribana", nome, largura, altura, contorno: [x,y][], fio: [[x,y],[x,y]], piques: [[x,y],[x,y]][], pontos: { centro: x, decote: [x,y], barra: y } }`
- `index.json = { "camiseta-basica": { nome: "Camiseta básica gola careca", tamanhos: ["P","M","G"], modalidade: "futebol", gola: "redonda" } }`

- [ ] **Step 1: Write the failing test** `tests/verify_moldes.js`, lendo os JSON gerados:
```js
const esperado = { // largura × altura em mm (±1), da tabela da spec (x = largura, y = altura)
  P: { frente: [557, 772], costas: [560, 820], manga: [421, 246], ribana: [408, 55] },
  M: { frente: [587, 788], costas: [590, 835], manga: [445, 252], ribana: [420, 55] },
  G: { frente: [617, 804], costas: [620, 852], manga: [469, 258], ribana: [432, 55] } };
// para cada tamanho: 5 peças com os ids acima; dimensões batem ±1 mm;
// contorno fechado (primeiro ponto === último); frente tem decote mais fundo que costas
// (pontos.decote[1] da frente > da costas); pontos.centro ≈ largura/2 (±2 mm);
// nenhum ponto fora de [0, largura] × [0, altura]; fio tem 2 pontos dentro da peça.
```
- [ ] **Step 2:** `node tests/verify_moldes.js` → FAIL (arquivos não existem).
- [ ] **Step 3: Implement `importarPLT`.** Ler comandos `PU/PD`, montar polilinhas (cada `PU` abre uma). Uma polilinha de contorno é a que volta ao primeiro vértice: corta ali, e o resto dela vira pique. Descartar a moldura (o maior retângulo de 5 pontos) e as polilinhas de rótulo (todas com caixa < 15 mm que não toquem um contorno). Peças: ribana = retângulo de 5 pontos com lado menor ≈ 55 mm; mangas = os dois contornos de mesma área (esquerda = menor y no PLT); entre os dois maiores, **frente = o de decote mais fundo**. Converter para o referencial da peça: `x = yPLT − y0`, `y = xPLT − x0`, dividido por 40. Linha de fio = segmento de 2 pontos dentro da caixa da peça. `pontos.centro` = x da linha de fio (corpo) ou largura/2; `pontos.decote` = ponto do contorno sobre `x = centro` com menor y; `pontos.barra` = maior y.
- [ ] **Step 4:** rodar o CLI para P, M e G, criar `index.json`, `node tests/verify_moldes.js` → PASS.
- [ ] **Step 5:** commit `feat(moldes): importa camiseta básica P/M/G do Audaces`.

### Task 2: Módulo de arte por peça

**Files:**
- Create: `app/js/arte-pecas.js` (mesmo padrão UMD de `molde-matricial.js`: `window.JPArtePecas` e `module.exports`)
- Test: `tests/verify_arte_pecas.js`

**Interfaces:**
- Consumes: `Peca` (Task 1).
- Produces:
  - `ELEMENTOS = ["marca","escudo","patrocinio","nome","numero"]`
  - `layoutPadrao(modelo: string) -> Layout`, com `Layout = { modelo, base: "M", elementos: { id, peca, ancora: "decote"|"centro", dx, dy, largura }[] }` (cm)
  - `posicao(el, peca) -> { x, y, largura }` em mm (centro do elemento), `x = pontos.centro + dx·10`, `y = pontos.decote[1] + dy·10` (âncora `centro`: `y = altura/2 + dy·10`)
  - `foraDaAreaSegura(el, peca, areaSeguraMm) -> boolean`
  - `desenharPeca(ctx, peca, projeto, atleta, opcoes) -> { avisos: string[] }`; `ctx` é qualquer objeto com a API Canvas 2D (já em mm); `projeto` = `projeto_3d`; `atleta = { nome, numero, tamanho } | null`; `opcoes = { fontes: (familia, px) => string, sangria: mm }`
  - `limparTexto(s, glifosSuportados?: (ch) => boolean) -> { texto, removidos }`

- [ ] **Step 1: Write the failing test** com um `ctx` falso que grava chamadas (`fillText`, `drawImage`, `clip`, `fillRect`, e `measureText` retornando `0.6·px·len`):
  - `layoutPadrao("camiseta-basica")` tem os 5 elementos; número e nome em `costas`, escudo/marca/patrocínio em `frente`.
  - Com o molde P, M e G: o `fillText` do número cai em `x = pontos.centro` (±0,5 mm) e `y = decote + dy·10` (±0,5 mm) de cada tamanho; o tamanho da fonte (px em mm) é igual nos três.
  - `desenharPeca` chama `clip()` antes de pintar o fundo, com o contorno expandido pela sangria.
  - Atleta `{nome:"SILVA", numero:"07"}` → `fillText("SILVA")` e `fillText("07")` nas costas; nada de nome/número na frente.
  - Texto `<script>` é desenhado como texto literal (sem marcação); `limparTexto("JOÃO🔥")` → `{ texto: "JOÃO", removidos: ["🔥"] }` com um filtro que aceite só Latin-1.
  - Estampas: `solid` faz 1 `fillRect`; `stripes` faz faixas verticais de 30 mm alternando `cor1`/`cor2`; `gradient` faz **64 faixas** horizontais interpolando `cor1`→`cor2`; `rajado` com a mesma semente gera a mesma sequência de chamadas duas vezes.
- [ ] **Step 2:** `node tests/verify_arte_pecas.js` → FAIL.
- [ ] **Step 3: Implement.** Porta as estampas de `app.js` (`drawRajadoPattern`, `drawBrushSlash`, `drawDefaultTeamCrest`, a lógica de `escreveAjustado`) para mm. O rajado usa a semente `1337` (a mesma do 3D) por peça. Transparência: usar `globalAlpha` (a Task 3 confirma no PDF). Valores padrão do layout: medir a posição atual de `drawPlayerDetails()` no 3D e converter; o builder registra no código de onde vieram.
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5:** commit `feat(arte): desenho da arte por peça em mm`.

### Task 3: Prova do PDF (jsPDF + fontes)

**Files:**
- Modify: `package.json` (`devDependencies`: `jspdf@2.5.1`, `jszip@3.10.1`), `.gitignore` (`node_modules/`)
- Create: `app/assets/fontes/` (TTF + `OFL.txt` de Montserrat 800/900, Bebas Neue, Teko 600, Graduate, Anton, JetBrains Mono 500), `app/js/pdf-fontes.js`
- Test: `tests/verify_pdf_basico.js`

**Interfaces:**
- Produces: `registrarFontes(doc, carregarTTF: (arquivo) => Promise<string base64>) -> Promise<void>` em `pdf-fontes.js` (navegador: `fetch`; Node: `fs`); `FONTES_TTF = { "Montserrat": {900: "Montserrat-Black.ttf", 800: "Montserrat-ExtraBold.ttf"}, ... }`; `glifoSuportado(familia, ch) -> boolean`.

- [ ] **Step 1: Pedir autorização** ao usuário para baixar os TTF do repositório oficial `google/fonts` no GitHub (nome, origem, tamanho). Sem autorização, parar a task.
- [ ] **Step 2: Write the failing test:** gera em Node um PDF `mm`, página 1600 × 1000 mm, desenha via `doc.context2d` um contorno com `clip()`, um retângulo com `globalAlpha = 0.5`, um texto "JOÃO 10" em Montserrat 900 e o quadrado de controle; assert: `MediaBox` = `[0 0 4535.43 2834.65]` (±0,1 pt); a fonte `Montserrat` aparece como `/FontFile2` (incorporada); existe um operador de clip (`W n`); existe um `ExtGState` com `/ca 0.5`.
- [ ] **Step 3:** `npm i -D jspdf@2.5.1 jszip@3.10.1`; implementar `pdf-fontes.js`. Se `globalAlpha` não gerar `ExtGState` no `context2d`, registrar no módulo de arte o plano B: pré-misturar a cor sobre `cor1` (e mudar o teste do Step 2 para conferir a cor misturada).
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5:** commit `feat(pdf): fontes incorporadas e prova do PDF 1:1`.

### Task 4: Pacote de impressão (encaixe, PDFs, zip)

**Files:**
- Create: `app/js/pacote-impressao.js` (UMD: `window.JPPacoteImpressao`)
- Test: `tests/verify_pacote.js`

**Interfaces:**
- Consumes: moldes (Task 1), `desenharPeca`/`layoutPadrao`/`limparTexto` (Task 2), `registrarFontes`/`glifoSuportado` (Task 3), `JPMoldeMatricial.gerarTextoPuro`/`gerarArquivoMatricialESCP` (existente).
- Produces:
  - `PERFIL_PADRAO` (valores das Global Constraints)
  - `podeExportar(pedido, indiceMoldes) -> { ok, modelo?, motivo? }`
  - `copias(pedido) -> { tamanho, atleta, indice, total }[]` (um por atleta; sem lista, pela grade com nome/número do projeto)
  - `encaixar(itens: {id, largura, altura}[], perfil) -> { pranchas: { comprimento, itens: {id, x, y, girado}[] }[] } | { erro }`
  - `gerarPacote(pedido, { moldes, perfil, jsPDF, JSZip, carregarTTF }) -> Promise<{ zip: Uint8Array, manifesto, avisos }>`

- [ ] **Step 1: Write the failing tests** (Node, com jsPDF/JSZip reais):
  - `podeExportar`: futebol+redonda → ok; futebol+v → `motivo: "Molde de gola V/polo não cadastrado"`; basquete → `"Molde de basquete não cadastrado"`.
  - `copias`: 3 atletas M e 2 G → 5 cópias, com os atletas certos; sem `atletas` e grade `{M:2}` → 2 cópias com o nome/número do projeto e aviso `"Sem lista de atletas"`.
  - `encaixar`: nenhum item passa de `larguraUtil − 2·margemLateral`; itens não se sobrepõem (contando `espaco`); com `comprimentoMax: 2000` gera mais de uma prancha; com `larguraUtil: 500` → `erro` contendo `"Perfil de 500 mm não comporta a peça Frente"`.
  - `gerarPacote` (pedido de exemplo com 3 M e 2 G): o zip contém `ficha-<id>.txt`, `ficha-<id>.prn`, `impressao-<id>-M.pdf`, `impressao-<id>-G.pdf`, `impressao-<id>-unificado.pdf`, `manifesto-<id>.json`; o PDF do M tem 3 costas com rótulos `"#<id> · Costas · M · <número> <nome>"`; nenhuma página tem dimensão diferente da prancha calculada; manifesto lista `escala: "1:1"`, `perfil`, `versaoMolde`, cópias por tamanho.
  - Pedido com tamanho `GG` (sem molde) → PDF do GG ausente e aviso `"Tamanho GG sem molde"` no manifesto.
  - Review Focus 1 e 2: atleta `"MÜLLER🔥"` → PDF com `MÜLLER` e aviso de caractere removido; pedido sem `projeto_3d.layout` usa `layoutPadrao`; sem `projeto_3d` → cores padrão com aviso.
- [ ] **Step 2:** `node tests/verify_pacote.js` → FAIL.
- [ ] **Step 3: Implement.** Itens do encaixe = caixa da peça + 2·sangria. Encaixe em faixas: ordenar por altura decrescente; girar 90° só se a peça não couber em pé ou se diminuir a altura da faixa; abrir nova prancha ao passar de `comprimentoMax`. Página do PDF = `larguraUtil × comprimento da prancha` (mm). Cada peça: `ctx.save()`, translação (e rotação, se girada), `espelhar` aplica `scale(-1,1)` na prancha inteira, `desenharPeca`, depois a linha de corte (0,3 mm, preto) e, se `linhasTecnicas`, fio e piques (tracejado). Rótulo: Montserrat 800, 3 mm de altura, dentro da peça a 8 mm do contorno junto à barra. A prévia PNG fica para o navegador (Task 8), não entra no Node.
- [ ] **Step 4:** teste → PASS.
- [ ] **Step 5:** commit `feat(pacote): encaixe, PDFs por tamanho e unificado`.

### Task 5: 3D desenhado pelo layout (calibração)

**Files:**
- Create: `scripts/uv_ilhas.js` (lista caixas das ilhas de UV de `Camisa_Corpo` no `kit_completo.obj`, em px de 2048), `app/moldes/camiseta-basica/calibracao.json`
- Modify: `app/js/app.js` (`drawPlayerDetails`, `updateDynamicTexture`, `drawRajadoPattern`), `app/simulador.html` (script `js/arte-pecas.js` e carga de `moldes/camiseta-basica/M.json` + calibração)
- Modify: `app/js/arte-pecas.js` (`afimDePares(pares) -> [a,b,c,d,e,f]`, `aplicarAfim(m, [x,y]) -> [u,v]`)
- Test: `tests/verify_arte_pecas.js` (novos casos)

**Interfaces:**
- `calibracao.json = { textura: 2048, pecas: { frente: { pares: [[[xmm,ymm],[upx,vpx]] ×3–4] }, costas: {...}, "manga-esquerda": {...}, "manga-direita": {...} } }`
- Desenho no 3D: para cada peça, `ctx.save(); ctx.setTransform(...afim); desenharPeca(ctx, peca, projeto, atletaPrevia, opcoes); ctx.restore()`. A gola (`Gola_*`) e os punhos continuam pintados como hoje.

- [ ] **Step 1: Failing test:** `afimDePares` com 3 pares conhecidos reproduz os pontos (±0,01 px); com a calibração real, o decote da costas do M cai dentro da ilha de UV das costas (`x 24..1160, y 654..2024`) e o da frente dentro de `x 1208..2024, y 844..2024`.
- [ ] **Step 2:** FAIL → implementar `afimDePares` (mínimos quadrados para 4 pares) → PASS.
- [ ] **Step 3:** rodar `node scripts/uv_ilhas.js`, montar `calibracao.json` (decote, barra no centro e ombros de cada peça ↔ os mesmos pontos na ilha). Trocar o desenho fixo do `app.js` pelo laço acima, mantendo a gola, os punhos e o calção/meião como estão.
- [ ] **Step 4:** `npm test` passa; abrir o simulador no preview (`simulador` em `.claude/launch.json`) e conferir por captura de tela: número e nome nas costas, escudo e marca no peito, nos mesmos lugares de antes (±1 cm visual).
- [ ] **Step 5:** commit `feat(simulador): textura 3D desenhada pelo layout do molde`.

### Task 6: Posicionamento livre e escudo salvo

**Files:**
- Create: `app/js/editor-posicao.js`
- Modify: `app/simulador.html` (nova seção "Posição da arte" na aba Personalização), `app/css/simulador-jp.css`, `app/js/app.js` (`salvarProjeto` grava `layout` e `escudo`; leitura do layout salvo ao abrir)
- Test: `tests/verify_editor_posicao.js`

**Interfaces:**
- Consumes: `layoutPadrao`, `posicao`, `foraDaAreaSegura` (Task 2); molde M.
- Produces: `JPEditorPosicao.iniciar(raiz, { molde, layout, aoMudar(layout) })`; `moverElemento(layout, id, dxCm, dyCm) -> Layout`; `redimensionar(layout, id, larguraCm) -> Layout` (limites: escudo/marca 3–15 cm, patrocínio 8–40, nome 8–40, número 8–35); `dimensoesEscudo(w, h, max = 1500) -> {w, h}`.
- `projeto_3d.layout` (formato da Task 2) e `projeto_3d.escudo` (data URL PNG).

- [ ] **Step 1: Failing test:** `moverElemento` soma em cm e não deixa o centro sair da peça; `redimensionar` respeita os limites; teclas: seta = 0,5 cm, Shift+seta = 2 cm; `dimensoesEscudo(6000, 4000)` → `{w:1500, h:1000}`, `dimensoesEscudo(800, 600)` → inalterado; elemento fora da área segura gera o aviso "Muito perto da costura".
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: UI.** SVG com o contorno real da peça (M), escolha da peça (Frente/Costas) e do elemento, arrastar com ponteiro, alças/controle deslizante de tamanho, setas do teclado, "Voltar ao padrão". Cada mudança chama `updateAllTextures()`. O upload do escudo passa por `dimensoesEscudo` num canvas e é salvo como PNG (`toDataURL("image/png")`), preservando o alfa.
- [ ] **Step 4:** conferir no preview: arrastar o número move no 3D; recarregar a página mantém a posição; `localStorage.jpSportProjeto.layout` existe.
- [ ] **Step 5:** commit `feat(simulador): posicionamento livre da arte`.

### Task 7: Lista de atletas no orçamento

**Files:**
- Create: `app/js/atletas.js` (UMD: `window.JPAtletas`)
- Modify: `app/orcamento.html` (seção "Atletas" entre a grade e "Seu time"; grade calculada pela lista; envio com `atletas`), `docs/supabase/schema.sql`, `app/assets/supabase-config.js` (cópia local inclui `atletas`; semente com 3 atletas no pedido 1)
- Test: `tests/verify_atletas.js`, `tests/verify_operacao.js` (schema)

**Interfaces:**
- Produces: `normalizarAtleta(bruto) -> { ok, atleta?: {nome, numero, tamanho}, erro? }`; `lerColado(texto) -> { atletas, erros: {linha, motivo}[] }` (separadores `;`, `,` ou tab); `gradeDeAtletas(atletas) -> {P,M,G,GG,XG,Infantil}`; `avisos(atletas) -> string[]` (número repetido); `LIMITE = 200`.
- SQL: `alter table public.orcamentos add column if not exists atletas jsonb;` + `check (atletas is null or (jsonb_typeof(atletas) = 'array' and jsonb_array_length(atletas) <= 200))` (constraint com nome e `drop constraint if exists` antes).

- [ ] **Step 1: Failing test** (inclui Review Focus 5): `"silva; 007; gg"` → `{nome:"SILVA", numero:"007", tamanho:"GG"}`; `"ana,10,infantil"` → tamanho `Infantil`; linha sem tamanho → erro "linha 2: tamanho ausente"; nome de 16 caracteres → erro; número `"1234"` → erro; 201 atletas → erro de limite; `gradeDeAtletas` conta certo; dois "10" → aviso "Número 10 repetido". Em `verify_operacao.js`: o schema tem a coluna `atletas` e a constraint.
- [ ] **Step 2:** FAIL → implementar `atletas.js` → PASS.
- [ ] **Step 3: UI e envio.** Tabela editável (nome, número, tamanho, remover), "Adicionar atleta", "Colar lista" (textarea + `lerColado`, mostrando os erros por linha). Com lista, os campos da grade ficam somente leitura e mostram `gradeDeAtletas`. A primeira linha nova vem com o nome/número do simulador. Todo texto da tabela entra por `textContent`/`value` (sem `innerHTML`). A mensagem do WhatsApp ganha "Atletas: N (lista anexada no pedido)". `JP_DB.salvar("orcamentos", {..., atletas})`.
- [ ] **Step 4:** `npm test` passa; conferir no preview: colar 5 linhas atualiza a grade e a estimativa.
- [ ] **Step 5:** commit `feat(orcamento): lista de atletas com nome, número e tamanho`.

### Task 8: Painel de operação (pacote, perfil, atletas, ficha)

**Files:**
- Modify: `app/operacao.html` (scripts jsPDF, JSZip, `arte-pecas.js`, `pdf-fontes.js`, `pacote-impressao.js`), `app/js/operacao.js` (botão, perfil, inspetor), `app/js/molde-matricial.js` (medidas do molde real e tabela de atletas), `app/css/operacao.css`
- Test: `tests/verify_operacao.js` (novos casos)

**Interfaces:**
- Consumes: `podeExportar`, `gerarPacote`, `PERFIL_PADRAO` (Task 4); moldes (Task 1).
- Produces: `JPMoldeMatricial.normalizar` passa a devolver `atletas` e aceita `opcoes.molde` para as medidas; perfil salvo em `localStorage.jpPerfilProducao`.

- [ ] **Step 1: Failing tests:** o inspetor mostra o botão "Baixar pacote de impressão" para futebol+redonda e, para gola V, o texto "Molde de gola V/polo não cadastrado" sem o botão; a lista de atletas aparece no inspetor escapada (`<script>` vira `&lt;script&gt;`); a ficha `.txt` traz a tabela "ATLETAS" agrupada por tamanho dentro de 80 colunas; com o molde M, a ficha troca as medidas fixas por um quadro "PEÇAS DO MOLDE" com largura × altura reais de cada peça ("Frente: 58,7 x 78,8 cm", "Manga (2x): 44,5 x 25,2 cm"); sem molde para o tamanho, mantém as medidas de referência atuais com o aviso de confirmar; o perfil editado e salvo volta ao recarregar; valor inválido (largura útil 0) é recusado com aviso.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** ao clicar, mostrar "Gerando…", desabilitar o botão, chamar `gerarPacote` com `carregarTTF` por `fetch`, gerar a prévia PNG da primeira prancha do unificado (renderizar `desenharPeca` num canvas a 10 px/cm) e adicioná-la ao zip, baixar `pacote-<id>.zip`. Erros (perfil não comporta, falta de molde) aparecem no `status-aviso`.
- [ ] **Step 4:** `npm test` passa; no preview, com o pedido de exemplo (modo local), baixar o pacote e abrir o PDF do M: conferir o quadrado de 100 mm e os nomes nas costas.
- [ ] **Step 5:** commit `feat(operacao): pacote de impressão no painel`.

### Task 9: Fechamento
- [ ] **Step 1:** `package.json`: `"test"` roda todos os `tests/verify_*.js` (incluindo `verify_operacao.js`, que hoje fica de fora).
- [ ] **Step 2:** `README.md` (seção "Pacote de impressão" e como importar um molde novo) e `docs/ACOMPANHAMENTO.md` (estado, registro de sessão).
- [ ] **Step 3:** `npm test` → todos PASS; commit `docs: pacote de impressão no README e acompanhamento`.

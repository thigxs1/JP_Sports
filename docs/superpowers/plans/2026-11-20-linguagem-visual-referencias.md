# Linguagem visual das referências: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** levar a linguagem das referências (padel + Barcelona) para Início, Coleção e Simulador, com as cores da JP, ícones de traço e cores do simulador dentro de um ícone de camisa.

**Arquitetura:** site estático em `app/`. Tokens e componentes compartilhados em `app/assets/jp-sport.css`; estilos de cada página em `<style>` no próprio HTML. Os ícones são gerados por `app/assets/icones-modalidades.js` (`data-icone`). O seletor de cor é montado por `initColorSwatches()` em `app/js/app.js`.

**Tecnologias:** HTML/CSS/JS puro, Three.js (inalterado) e testes Node com `assert` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-20-linguagem-visual-referencias-design.md`

## Restrições globais
- Paleta fixa: `--navy #0F1F3D`, `--ink #0A1630`, `--eletrico #2F5BFF`, `--off #F2F2F2`, `--grafite #4A4A4A`, `--cinza #A6A6A6`, branco. Nenhuma cor nova de acento (sem limão nem dourado).
- Fontes atuais: Anton (títulos), Poppins (texto), JetBrains Mono (rótulos).
- Não mexer em `estadoSimulador`, texturas, OBJ/3D, preços, WhatsApp ou Supabase.
- Usar só imagens já existentes no repositório.
- Ícones: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width` entre 1.5 e 2, sem `<radialGradient>` nem cores fixas.
- Textos em pt-BR.

## Pontos de atenção na revisão
1. Cor escura (navy/ink) no seletor: a camisa precisa continuar visível no fundo escuro. O contorno em `currentColor` claro resolve isso. Teste em T3.
2. Cor branca no seletor: o corpo branco precisa continuar distinguível. O contorno resolve. Mesmo teste.
3. Trocar de parte (`.part-btn`) chama `initColorSwatches()` de novo, então os ícones precisam ser recriados sem duplicar. O teste de T3 conta os ícones.
4. Mobile (375px): o hero escuro e os cards não podem estourar a largura. Verificação em T5.
5. Ícones dentro de links do rodapé e da faixa herdam a cor do texto (`currentColor`). Teste de T1.

---

### Task 1: Ícones minimalistas de traço

**Arquivos:**
- Modificar: `app/assets/icones-modalidades.js` (reescrita)
- Modificar: `app/assets/jp-sport.css` (regra `.icone-mod`: tamanho via `width/height: 1em`, `display:inline-block`, `svg{width:100%;height:100%}`)
- Teste: `tests/verify_visual_language.js` (novo) e adicionar ao script `test` do `package.json`

**Interfaces:**
- Produz: `window.JP_ICONES = { aplicar(raiz?), lista: string[], svg(nome: string): string }`. Nomes: `futebol, basquete, volei, kit, dry, fabrica, time, camisa, seta`. `svg("camisa")` gera a camisa de traço que a T3 usa.

- [ ] **Passo 1: escrever o teste que falha.** Carregar o arquivo com `vm.runInNewContext` usando um stub de `window`/`document` (`readyState:"complete"`, `querySelectorAll:()=>[]`). Asserções: para cada nome da lista, `svg(nome)` contém `viewBox="0 0 24 24"` e `stroke="currentColor"`, e não contém `Gradient` nem `#`. `lista` inclui os 9 nomes.
- [ ] **Passo 2:** `node tests/verify_visual_language.js` deve FALHAR (`svg is not a function`).
- [ ] **Passo 3:** reescrever o módulo. Cada ícone tem de 1 a 4 `path`/`circle` simples. Camisa: contorno de camiseta com o corpo num `<path class="corpo">` (`fill="none"` por padrão). Mesmo comportamento de `aplicar` de antes (não reaplica se já tiver filho).
- [ ] **Passo 4:** o teste deve PASSAR e o `npm test` também.
- [ ] **Passo 5:** commit `feat(icones): ícones minimalistas de traço`.

### Task 2: Base visual escura no CSS compartilhado

**Arquivos:**
- Modificar: `app/assets/jp-sport.css`
- Teste: `tests/verify_visual_language.js`

**Interfaces:**
- Produz as classes que T4 e T5 usam:
  - `.destaque` = palavra em `var(--eletrico)` (alias de `.t-eletrico`)
  - `.card-jp` com filhos `.card-num` (01, em elétrico, mono), `.card-ico` (quadradinho 44px, fundo `var(--ink)`, borda `--linha-escura`, contém `[data-icone]`), `.card-titulo` (Anton, caixa alta), `.card-txt`, `.card-seta`. Fundo navy, borda 1px `--linha-escura`; no hover, borda elétrica.
  - `.moldura` = um `::before` absoluto com borda 1px elétrica, deslocado `translate(24px, 24px)`, atrás do conteúdo (`z-index:-1`; o pai precisa de `position:relative; isolation:isolate`).
  - `.faixa-beneficios` = grid de 3 itens, cada um com ícone em elétrico, título mono maiúsculo e subtítulo cinza.
  - `.btn` = retangular, fundo elétrico, texto 12px caixa alta, `letter-spacing .12em`, com `.seta`.

- [ ] **Passo 1:** adicionar ao teste asserções de string sobre `jp-sport.css`: contém `.card-jp`, `.card-num`, `.card-ico`, `.moldura`, `.faixa-beneficios`; não contém nenhum hex fora da paleta (regex `#[0-9a-fA-F]{6}` e cada match pertence à lista da paleta, mais `#000000`/`#FFFFFF`).
- [ ] **Passo 2:** o teste deve FALHAR.
- [ ] **Passo 3:** implementar as classes e mudar o `body.jp` padrão para fundo `var(--ink)` com texto branco. Manter `.secao` clara disponível como `.secao.clara`.
- [ ] **Passo 4:** o teste deve PASSAR.
- [ ] **Passo 5:** commit `feat(css): base visual escura com cards, moldura e faixa`.

### Task 3: Cores do simulador dentro do ícone de camisa

**Arquivos:**
- Modificar: `app/js/app.js:984-1024` (`initColorSwatches`) e onde `currentColorPreview` recebe `backgroundColor`
- Modificar: `app/simulador.html` (incluir `<script src="assets/icones-modalidades.js">` antes de `js/app.js`; `#currentColorPreview` vira um `<span class="cor-ico">`)
- Modificar: `app/css/style.css:404-445` e `app/css/simulador-jp.css:18,75-77`
- Teste: `tests/verify_visual_language.js`

**Interfaces:**
- Consome: `JP_ICONES.svg("camisa")` (T1).
- Produz: `pintarCamisa(el: Element, hex: string): void` em `app.js`. Põe o SVG da camisa em `el` (se ainda não tiver) e define `fill = hex` no `.corpo`.

- [ ] **Passo 1:** no teste, as asserções de string sobre `app.js`: contém `function pintarCamisa`; `initColorSwatches` não contém `backgroundColor`; não existe `swatch-circle`. Teste de comportamento: extrair `pintarCamisa` via `vm` com um stub de elemento e verificar que chamar duas vezes deixa um único `<svg>` e `fill` igual ao último hex (atenção 3). Em `style.css`, `.swatch-ico` com `color: var(--cinza)` (atenção 1 e 2) e `.swatch-item.active .swatch-ico { color: var(--eletrico) }`.
- [ ] **Passo 2:** o teste deve FALHAR.
- [ ] **Passo 3:** implementar. Cada `.swatch-item` passa a conter `<span class="swatch-ico">` pintado com `pintarCamisa` mais `.swatch-label`. O preview atual usa `pintarCamisa`. Nada muda em `estadoSimulador`.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5:** commit `feat(simulador): cores exibidas dentro do ícone de camisa`.

### Task 4: Início no estilo das referências

**Arquivos:**
- Modificar: `app/index.html` (`<style>` e seções `.hero`, `#modalidades`, simulador, CTA)
- Teste: `tests/verify_visual_language.js`

**Interfaces:**
- Consome: as classes da T2 e os ícones `dry`, `fabrica`, `time` e as modalidades da T1.

- [ ] **Passo 1:** asserções de string no `index.html`: `.hero` não tem `background: var(--off)`; existe `class="faixa-beneficios"` com `data-icone="dry"`, `"fabrica"` e `"time"`; existem 4 `class="card-jp"` com `card-num` 01–04; existem pelo menos 2 `class="moldura"`; o título do hero contém `class="destaque"`.
- [ ] **Passo 2:** o teste deve FALHAR.
- [ ] **Passo 3:** implementar.
  - **Hero:** uma seção escura de tela cheia, texto à esquerda e `#hero3d` à direita (mesmo `id`/`data-modelo`, porque o `hero3d.js` depende deles). A `.faixa-beneficios` fica na base, substituindo `.barra-beneficios` e `.hero-mods`.
  - **Modalidades:** viram `.card-jp`, mantendo os `href` e as imagens de `assets/produtos/*.png`.
  - **Simulador e CTA:** ganham `.moldura`.
- [ ] **Passo 4:** o teste deve PASSAR.
- [ ] **Passo 5:** commit `feat(home): hero escuro, cards numerados e moldura`.

### Task 5: Coleção, verificação no navegador e README

**Arquivos:**
- Modificar: `app/colecao.html` (cards de produto viram `.card-jp`, seções escuras)
- Modificar: `README.md` (seção Ícones: estilo de traço e `JP_ICONES.svg`)

- [ ] **Passo 1:** asserção: `colecao.html` contém `card-jp` e não contém `background: var(--off)` em seções. Deve FALHAR, implementar e PASSAR.
- [ ] **Passo 2:** `npm start` via preview. Abrir `/`, `/colecao` e `/simulador` em desktop e em 375px. Conferir que não há erro no console, nem rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`), e que clicar em uma cor no simulador muda o ícone ativo e o modelo 3D.
- [ ] **Passo 3:** commit `feat(colecao): cards no novo estilo; docs`.

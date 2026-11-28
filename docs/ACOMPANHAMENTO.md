# JP Sport · Acompanhamento do projeto

> Leia este arquivo no início de cada sessão nova. Ele resume o que existe, onde fica e o que falta.
> Atualize a seção **Estado atual** e o **Registro de sessões** ao final de cada sessão.
> Última revisão completa do código: **2026-11-28** (base `origin/main` @ `58729d3`, PR #6).

---

## 1. O que é

Site estático + simulador 3D de uniformes da **JP Sport** (linha esportiva da JP Produção Têxtil).
Sem framework e sem build: HTML/CSS/JS puro em `app/`, Three.js r128, Supabase como banco, deploy na Vercel.

| Item | Valor |
|---|---|
| Repositório | `github.com/thigxs1/JP_Sports` (branch principal `main`) |
| Deploy | Vercel, `vercel.json` publica `app/` (sem build, `cleanUrls`) |
| Banco | Supabase, projeto `rjqzlqtgkuvyxrotejrs` (MCP em `.mcp.json`) |
| Servidor local | `npm start` → `serve.js` na porta 3000 (`PORT=` muda); preview do app usa a 3001 (`.claude/launch.json`, nome `simulador`) |
| Testes | `npm test` (assets do kit + integração do simulador) e `node tests/verify_operacao.js` (painel, 35 verificações) |
| Idioma | Código, comentários, commits e UI em português |

---

## 2. Mapa de arquivos

### Telas (`app/`)
| Tela | Arquivo | Scripts principais |
|---|---|---|
| Início | `index.html` | `js/hero3d.js` (camisa 3D no banner), `js/cards3d.js` (modelo 3D no hover dos cards), `js/feed-promocoes.js` (feed `#promocoes`) |
| Coleção 26 | `colecao.html` | script inline: preços via `JP_CONFIG`, filtros animados |
| Simulador 3D | `simulador.html` | `js/app.js` (1366 linhas), `css/simulador-jp.css`, `css/style.css` |
| Orçamento | `orcamento.html` | script inline: grade de tamanhos, estimativa, WhatsApp + `JP_DB.salvar("orcamentos")` |
| Painel de operação | `operacao.html` (`noindex`) | `js/operacao.js`, `js/molde-matricial.js`, `css/operacao.css` |
| Playbook da marca | `referencia.html` | `assets/referencia/playbook.css` |

### Compartilhados (`app/assets/`)
- `jp-sport.css` — design system (cores, Anton / Poppins / JetBrains Mono, botões, tags, linhas de quadra, mira HUD).
- `jp-sport.js` — motion comum (cortina entre telas, reveal, contadores, parallax, botões magnéticos, menu mobile) e **`window.JP_CONFIG`** (WhatsApp e preços).
- `icones-modalidades.js` — `<span data-icone="futebol|basquete|volei|kit">` vira SVG; expõe `window.JP_ICONES`.
- `supabase-config.js` — URL + chave publishable e a camada de dados **`window.JP_DB`** (ver §4).
- `logo-jp-provisorio.svg`, `produtos/*.png` (renders do Blender), `textures/dryfit_*.png` (PBR).

### 3D (`app/models/`, `app/js/`)
- `kit_completo.obj` — malha principal com grupos `Camisa_Corpo`, `Gola_V`, `Gola_Redonda`, `Gola_Polo`, `Punhos`, `Calcao`, `Meiao`.
- `modal_basquete.obj` (`Regata_Corpo`, `Regata_Vies`) e `modal_volei.obj` (`Volei_Corpo`, `Volei_Vies`) — carregados sob demanda.
- `objeto.obj` — malha original (fallback); `formas2048.svg` — template de UV.
- `kit_completo_v1_backup.obj` — **versionado de propósito**: é a base lida por `scripts/blender_refine_kit.py`.
- `three.min.js`, `OBJLoader.js`, `OrbitControls.js` — bibliotecas vendorizadas.
- `embedded_assets.js` — **gerado** (`npm run build:embed`), ignorado no git; só é carregado em `file://`.

### Outros
- `scripts/` — pipeline do Blender via socket MCP `127.0.0.1:9876` (`blender_exec.js` envia o `.py`), `build_embedded_assets.js`.
- `tests/` — verificações Node com `assert` (sem framework).
- `docs/supabase/` — `schema.sql` (idempotente) e passo a passo.
- `docs/superpowers/` — specs, planos e auditoria de realismo (histórico de decisões).
- Raiz: muitos arquivos de pesquisa do site de referência (`probe_*`, `orig_*`, `analyze*.js`…). **Ficam fora do git** pelo `.gitignore` (whitelist). Não versionar.

---

## 3. Fluxos principais

### Simulador → Orçamento
1. `simulador.html?modalidade=basquete` abre no preset da modalidade (`KIT_PRESETS` em `app.js`).
2. Estado em `estadoSimulador` (cores `cor1..cor5`, `corCalcao`, `corMeiao`, gola, estampa, número, nome, patrocínio, escudo).
3. Texturas desenhadas em canvas (`textureCanvas` 2048, `shortsCanvas` 1024, `socksCanvas` 512) e aplicadas com `sRGBEncoding`.
4. `salvarProjeto()` grava `localStorage.jpSportProjeto`; "Pedir orçamento" vai para `orcamento.html?modalidade=…`.
5. O orçamento lê `jpSportProjeto`, calcula `JP_CONFIG.precos[modalidade] (+ calção + meião se kit) × peças`, grava em `orcamentos` (sem bloquear) e abre `wa.me/<JP_CONFIG.whatsapp>`.

### Painel de operação (`operacao.html`)
- Login real (Supabase Auth + linha ativa em `perfis`) ou **modo local de demonstração** (botões "Entrar como Admin Global / Operação").
- Abas: **Pedidos & Molde Técnico** (filtros, status, inspetor, SVG P&B, `.prn` ESC/P 80 colunas, `.txt`), **Promoções do Feed** (CRUD + prévia), **Usuários** (só `admin_global`).
- Cada aba dispara o evento `jp-operacao:aba` (`detail: { aba, perfil, modo }`); a aba Usuários confere o perfil da sessão, não o do evento.
- Respostas atrasadas são descartadas por contadores (`estado.carga`, `promos.carga`, `users.carga`).

### Feed da Home
`feed-promocoes.js` → `JP_DB.listarPromocoes({ apenasAtivas: true })`, filtra vencidas, ordena por `ordem`. `linkSeguro()` só aceita caminho relativo ou http/https. Se der erro, a seção fica escondida.

---

## 4. Dados (Supabase + `JP_DB`)

### Tabelas (`docs/supabase/schema.sql`)
| Tabela | Uso | RLS |
|---|---|---|
| `orcamentos` | pedidos do site; `status` ∈ `novo, em_producao, finalizado, cancelado` | `anon`/`authenticated` inserem; `is_operacao()` lê e atualiza |
| `perfis` | equipe (FK `auth.users`), `role` ∈ `admin_global, operacao` | cada um lê o próprio; `is_admin_global()` gerencia todos |
| `promocoes` | feed da Home | público lê `ativa = true`; `is_operacao()` gerencia |

Funções `is_admin_global()` / `is_operacao()` são `security definer` (sem recursão no RLS) e só executáveis por `authenticated`.
Primeiro admin: criar em Authentication › Users e inserir em `perfis` (comando comentado no fim do `schema.sql`).

### `JP_DB` (`app/assets/supabase-config.js`)
- Nunca lança erro; retorna `{ ok, dados|usuario, erro, modo }` com `modo` = `"supabase"` ou `"local"`.
- Com sessão Supabase usa o banco; **só cai no local** se a rede falhar ou a tabela não existir (`42P01`, `PGRST205`). Recusa de RLS é erro real.
- Update/delete barrado pelo RLS volta vazio → `exigirLinha()` transforma em falha.
- Modo local: `localStorage` (`jpDbUsuarios`, `jpDbOrcamentos`, `jpDbPromocoes`, `jpDbSessao`) com sementes de exemplo. **Senhas em texto puro, só protótipo.**
- `criarUsuarioOperacao` usa um cliente Supabase auxiliar sem persistência para o `signUp` não trocar a sessão do admin.
- Orçamentos sempre ganham também uma cópia local (para aparecerem no painel do protótipo).

### Chaves no `localStorage`
`jpSportProjeto` (simulador → orçamento), `jpDb*` (modo local do painel), `jp-db-cadastro` (storageKey do cliente auxiliar).

---

## 5. Convenções

- Branch a partir de `main` (`feat/…`, `fix/…`), `npm test` antes do PR, PR para `main`.
- Paleta fixa: `--navy #0F1F3D`, `--ink #0A1630`, `--eletrico #2F5BFF`, `--off #F2F2F2`, `--grafite #4A4A4A`, `--cinza #A6A6A6`, branco. Navy manda, elétrico só em detalhes.
- Todo texto vindo de pedido/promoção/usuário passa por `esc()` antes de `innerHTML`; o `.prn` reduz tudo a ASCII imprimível.
- Motion sempre respeita `prefers-reduced-motion`; hover 3D só com `(hover: hover)`.
- Nunca pôr a `service_role` no front-end; só a chave publishable.

---

## 6. Estado atual (2026-11-28)

### Feito (em `main`)
- PR #1 Playbook, ícones, Supabase e Vercel · PR #2 polimento do simulador e cards · PR #3 textos sempre cabem na camisa · PR #4 hover dos cards · PR #5 rebranding 2026 · **PR #6 painel de operação, molde técnico e feed de promoções**.
- Testes passando: `npm test` (2/2) e `verify_operacao.js` (35/35).

### Feito na branch `feat/pacote-impressao` (ainda sem PR)
- **Pacote de impressão para sublimação** (spec `docs/superpowers/specs/2026-11-28-pacote-impressao-sublimacao-design.md`, plano em `docs/superpowers/plans/`):
  - moldes do Audaces (camiseta básica P/M/G) em `app/moldes/`, importados por `scripts/importar_molde_plt.js`;
  - arte por peça em mm (`app/js/arte-pecas.js`), usada pelo 3D e pelo PDF; calibração em `app/moldes/camiseta-basica/calibracao.json`;
  - posicionamento livre no simulador (`app/js/editor-posicao.js`), escudo salvo no projeto;
  - lista de atletas no orçamento (`app/js/atletas.js`, coluna `orcamentos.atletas`);
  - painel: "Baixar pacote de impressão" (`app/js/pacote-impressao.js`): ficha, PDF 1:1 por tamanho, unificado, manifesto e prévia; perfil da plotter.
- `npm test` roda os 9 arquivos de teste (inclui `verify_operacao.js`).
- Precisa rodar o `schema.sql` atualizado no Supabase (coluna `atletas`).

### Em aberto no git
- Branch **`feat/linguagem-visual-referencias`** (worktree `.claude/worktrees/linguagem-visual`): 13 commits que **não estão em `main` nem no remoto** (base escura, ícones de traço, cor dentro do ícone de camisa, hero escuro, cards da coleção). Decidir: rebase sobre `main` + PR, ou descartar.
- `main` local está 8 commits atrás de `origin/main` → `git pull` antes de criar branch.

### Pendências de produto (README)
- Vetor oficial do logo (hoje `logo-jp-provisorio.svg`).
- Número de WhatsApp real (`JP_CONFIG.whatsapp` = `5500000000000`) e tabela de preços reais.
- Fotos de atleta para os banners.
- Malha base da camisa deriva de modelo de terceiros: remodelar antes do uso comercial (ver auditoria).

### Pontos de atenção encontrados na leitura
1. ~~`npm test` não roda `tests/verify_operacao.js`~~ (resolvido na branch `feat/pacote-impressao`).
2. `orcamento.html` monta o resumo com `innerHTML` usando `projeto.cores.*.hex/nome`, `numero` e `nome` do `localStorage` sem escapar (risco baixo, dado do próprio navegador, mas fácil de corrigir).
3. `orcamento.html` usa `?modalidade=` dentro de `querySelector(\`input[value="${pre}"]\`)`: um valor com aspas lança erro de seletor e quebra o script. Validar contra a lista de modalidades antes.
4. `orcamentos` aceita insert anônimo com `with check (true)` e sem limite de tamanho → avaliar limites (`check (length(...))`), rate limit ou captcha contra spam.
5. `operacao.html` carrega `@supabase/supabase-js@2.45.4` sem o caminho `dist/umd/supabase.min.js` usado nas outras telas; padronizar.
6. Credenciais de demonstração (`admin@jpsport.com` / `operacao@jpsport.com`) estão no código do modo local; se essas contas forem criadas no Supabase, usar outras senhas.
7. `criarUsuarioOperacao` depende de signUp liberado no Supabase (e da confirmação de e-mail); se estiver desligado, o usuário fica só local e o painel avisa.
8. `tests/verify_simulator_integration.js` lê `app/js/embedded_assets.js`, que é gerado (`npm run build:embed`) e fica fora do git: num clone novo, rode o build antes do `npm test`.
9. Pacote de impressão: estampa "Colors" sai lisa (cor 1) no PDF, com aviso; mangas calibradas só pela caixa da ilha de UV; sem escudo do cliente, a área fica vazia.

---

## 7. Próximos passos sugeridos
- [x] Incluir `verify_operacao.js` no `npm test`.
- [ ] Revisar e abrir o PR de `feat/pacote-impressao`; rodar o `schema.sql` no Supabase.
- [ ] Testar um PDF do pacote no RIP e na plotter reais (quadrado de 100 mm, cores, espelhamento).
- [ ] Exportar do Audaces os moldes que faltam (GG, XG, Infantil; gola V/polo; regata; vôlei; calção; meião) e importar com `npm run molde:importar`.
- [ ] Corrigir os itens 2 e 3 do `orcamento.html`.
- [ ] Decidir o destino da branch `feat/linguagem-visual-referencias`.
- [ ] Rodar `schema.sql` atualizado no projeto Supabase e criar o primeiro `admin_global`.
- [ ] Endurecer o insert público de `orcamentos`.
- [ ] Preencher WhatsApp e preços reais em `JP_CONFIG`.

---

## 8. Registro de sessões
| Data | O que foi feito | Branch / PR |
|---|---|---|
| 2026-11-28 | Leitura completa do código e criação deste arquivo | `feat/painel-operacao` |
| 2026-11-28 | Pacote de impressão para sublimação (moldes Audaces, arte por peça, posicionamento livre, atletas, painel) | `feat/pacote-impressao` |

# Pacote de impressão para sublimação (moldes 1:1 com a arte do cliente)

Data: 2026-11-28 · Status: rascunho, aguardando aprovação

## Intenção e porquê
Hoje o painel de operação exporta só uma ficha técnica: desenho fora de escala, só do tamanho M e só da camisa. A produção da JP sublima os uniformes, então precisa de arquivos prontos para o RIP/plotter, com **cada peça do molde em escala 1:1 já preenchida com a arte que o cliente montou no simulador** (cores, estampa, escudo, marca, patrocínio, nome e número).

Neste lote também entra o **posicionamento livre**: o cliente pode mover e redimensionar os elementos da arte como quiser, e o que ele vê no 3D é o que vai para o molde.

## Objetivos
1. Trazer para o projeto os moldes do Audaces que existem hoje: **camiseta básica, gola careca, tamanhos P, M e G** (`CAMISETA BASICA {P,M,G}.plt`), num formato que aceite outros modelos e tamanhos depois sem mudar código.
2. Guardar a posição de cada elemento da arte **em centímetros dentro da peça**, presa a pontos do molde, como fonte única para o 3D e para a exportação.
3. Simulador: modo de posicionamento livre (arrastar e redimensionar cada elemento na peça) com o 3D atualizando ao vivo, e um botão para voltar ao padrão.
4. Painel de operação: botão **"Baixar pacote de impressão"** no pedido, que gera um `.zip` com:
   - **ficha técnica** (a atual, atualizada com as medidas reais do molde de cada tamanho);
   - **um PDF 1:1 por tamanho** do pedido (todas as peças daquele tamanho, com a arte);
   - **um PDF unificado** com um jogo de peças por atleta, de todos os tamanhos, encaixadas na largura útil da plotter, para imprimir de uma vez;
   - **manifesto JSON** (pedido, modelo, tamanhos, quantidades, versão do molde, escala, largura útil, espelhamento, sangria, data);
   - **prévia PNG** do arquivo unificado.
5. Perfil de produção configurável no painel (largura útil, margens, sangria, espaçamento do encaixe, espelhamento, comprimento máximo por prancha).

## Fora do escopo (neste lote)
- Moldes de futebol com gola V/polo e punho, regata de basquete, vôlei, calção e meião. O pacote informa "molde não cadastrado" para essas peças.
- Tamanhos GG, XG e Infantil. Se o pedido tiver esses tamanhos, o pacote sai com os que existem e avisa dos que faltam.
- TIFF, EPS, AI, perfis ICC, presets por RIP (etapas 2 a 4 do guia técnico).
- Rotação livre dos elementos (só posição e tamanho).
- Refazer o 3D a partir dos moldes (abordagem B, descartada abaixo).

## Antiobjetivos (falha mesmo que "funcione")
- Peça esticada ou comprimida para caber no rolo. A proporção do molde é sagrada; se não couber, o encaixe reorganiza, gira 90° (se permitido) ou avisa que o perfil não comporta.
- Escala errada: um quadrado de controle de 100 × 100 mm precisa medir 100 × 100 mm no PDF.
- Texto, número ou escudo pixelado no tamanho real (arte vetorial sempre que possível; imagens a ≥ 150 ppi no tamanho final).
- Espelhar sem o operador saber (o espelhamento é uma opção explícita do perfil, desligada por padrão).
- Posição diferente entre o 3D e o PDF além da diferença de forma entre a malha e o molde.

## Restrições
- Site estático, sem build (HTML/CSS/JS puro em `app/`); bibliotecas por CDN, como já é feito com o Supabase.
- O arquivo é gerado no navegador, no painel de operação, a partir de `orcamentos.projeto_3d`.
- Unidade do PLT: 40 unidades = 1 mm (HPGL). Conferido: ribana da gola de 55 mm, molduras de 160/168/180 cm.
- PDF tem limite de página de 200 pol (5,08 m). Pranchas mais longas viram várias páginas (ou vários arquivos) com comprimento máximo configurável.
- A gradação P→M→G nos PLT é regular: +3,0 cm na largura e +1,5 a 1,7 cm no comprimento do corpo; manga +0,6 cm de largura e +2,4 cm de comprimento.

## O que os PLT contêm (por tamanho)
| Peça | P | M | G |
|---|---|---|---|
| Frente (aberta inteira) | 82,0 × 56,0 cm | 83,5 × 59,0 | 85,2 × 62,0 |
| Costas | 77,2 × 55,7 | 78,8 × 58,7 | 80,4 × 61,7 |
| Manga (2×) | 24,6 × 42,1 | 25,2 × 44,5 | 25,8 × 46,9 |
| Ribana da gola | 5,5 × 40,8 | 5,5 × 42,0 | 5,5 × 43,2 |

Cada peça tem contorno fechado (linha de corte), linha de fio, piques (inclusive os de bainha de 3 cm) e rótulos desenhados com traço. Uma moldura externa marca o encaixe original do Audaces.

## Abordagens consideradas
| | Abordagem | Troca | Decisão |
|---|---|---|---|
| **A** | **O molde é a referência.** Layout da arte em cm por peça, presos a pontos do molde; o 3D desenha via calibração afim peça ↔ ilha de UV; o PDF desenha vetorial direto no molde. | Prévia no 3D muito próxima, mas não idêntica (a malha atual é a camisa de futebol de terceiros, não a camiseta básica). Gera vetor e se adapta entre tamanhos. | **Escolhida pelo usuário.** |
| B | Refazer o 3D costurando os moldes no Blender (o UV vira o molde). | 3D idêntico à impressão e elimina a malha de terceiros, mas é muito trabalho de Blender, refeito a cada modelo, e hoje só cobriria a camiseta básica. | Descartada para este lote (pode voltar no futuro). |
| C | Copiar a textura 2048 px do 3D para dentro dos moldes. | Rápido, mas sai a ~40 ppi no tamanho real (abaixo do mínimo do guia), com distorção e texto borrado. | Descartada. |

## Design (abordagem A)

### 1. Biblioteca de moldes
- Script `scripts/importar_molde_plt.js`: lê um `.plt`, separa as polilinhas, reconhece as peças (contorno fechado + a linha de fio dentro dele), descarta os rótulos de traço e a moldura, e grava `app/moldes/<modelo>/<tamanho>.json`. Os `.plt` originais ficam em `app/moldes/<modelo>/fonte/`.
- Formato (em mm, origem no canto da peça, eixo Y para baixo):
  ```json
  { "modelo": "camiseta-basica", "tamanho": "M", "versao": "audaces-2026-11", "unidade": "mm",
    "pecas": [
      { "id": "frente", "nome": "Frente", "qtd": 1, "contorno": [[x,y], ...],
        "fio": [[x,y],[x,y]], "piques": [[[x,y],[x,y]], ...],
        "pontos": { "centro": x, "decote": [x,y], "barra": y, "ombroE": [x,y], "ombroD": [x,y] },
        "espelhavel": false }
    ] }
  ```
- `app/moldes/index.json` lista modelos, tamanhos disponíveis e a qual peça do 3D cada modelo corresponde. Adicionar um modelo ou tamanho = rodar o script e atualizar o índice.
- Os **pontos de referência** (centro, decote, barra, ombros) são detectados pelo script (centro pela linha de fio/simetria; decote e barra pelos extremos) e podem ser corrigidos à mão no JSON.

### 2. Layout da arte (fonte única)
- Novo campo `projeto_3d.layout`:
  ```json
  { "modelo": "camiseta-basica", "base": "M",
    "elementos": [
      { "id": "escudo", "peca": "frente", "ancora": "decote", "dx": 9.0, "dy": 14.0, "largura": 8.0 },
      { "id": "marca",  "peca": "frente", "ancora": "decote", "dx": -9.0, "dy": 14.0, "largura": 6.0 },
      { "id": "patrocinio", "peca": "frente", "ancora": "decote", "dx": 0, "dy": 26.0, "largura": 24.0 },
      { "id": "nome",   "peca": "costas", "ancora": "decote", "dx": 0, "dy": 9.0,  "largura": 24.0 },
      { "id": "numero", "peca": "costas", "ancora": "decote", "dx": 0, "dy": 22.0, "largura": 20.0 }
    ] }
  ```
  `dx`/`dy`/`largura` em cm, a partir da âncora da peça. Os valores padrão reproduzem a posição atual do 3D (os números acima são ilustrativos; o builder calibra a partir de `drawPlayerDetails()`).
- **Entre tamanhos:** a posição é absoluta em cm a partir da âncora (centro e decote), e o tamanho do elemento é o mesmo em todos os tamanhos (escudo de 8 cm é 8 cm no P e no G), como na produção.
- Estampas de fundo (`solid`, `stripes`, `gradient`, `rajado`, `colors`) são desenhadas em coordenadas da peça. O `rajado` usa semente fixa por pedido (o mesmo desenho em todas as exportações); o `colors` usa o template `formas2048.svg` transformado pela mesma calibração afim (continua vetorial).
- Área segura: elementos devem ficar a ≥ 2 cm do contorno (configurável). Fora disso, aviso no simulador e na exportação.

### 3. Calibração 3D ↔ molde
- Para cada peça do molde, uma transformação afim (escala, deslocamento e, se preciso, rotação) que leva mm da peça para px da textura 2048, definida em `app/moldes/<modelo>/calibracao.json` a partir de 3 ou 4 pares de pontos (decote, barra no centro, ombros).
- O `app.js` passa a desenhar estampas e elementos usando `layout` + calibração, no lugar das coordenadas fixas de hoje (por exemplo, o número em x 578, y 1210).
- O 3D da camiseta básica usa a malha atual `Camisa_Corpo` + `Gola_Redonda` + mangas (sem punhos).

### 4. Posicionamento livre (simulador)
- Nova seção na aba "Personalização": escolher o elemento, ver a peça (contorno real do molde M em SVG) e **arrastar** o elemento e mudar o **tamanho** (controle deslizante e alças). O 3D atualiza ao vivo. Botão "Voltar ao padrão".
- Também dá para mover pelo teclado (setas, 0,5 cm por passo; Shift, 2 cm), por acessibilidade.
- O layout é salvo em `jpSportProjeto.layout` e vai para `orcamentos.projeto_3d`.
- **Escudo do cliente:** hoje fica só na memória do simulador. Passa a ser redimensionado (lado máximo de 1500 px) e salvo como data URL PNG em `projeto_3d.escudo`, para o painel conseguir exportar.

### 5. Exportação (painel de operação)
- Biblioteca nova `app/js/pacote-impressao.js` (funciona no navegador e no Node para teste), com jsPDF e JSZip por CDN.
- **Perfil de produção:** guardado no navegador do painel (localStorage) neste lote, com valores padrão: largura útil 1600 mm, margens laterais 10 mm, sangria 5 mm, espaçamento 10 mm, rotação 90° permitida, espelhamento desligado, comprimento máximo por prancha 5000 mm. Tela simples na aba Pedidos para editar.
- **Cada peça no PDF:** arte desenhada em vetor dentro do contorno + sangria (clip no contorno expandido); por cima, linha de corte fina; rótulo pequeno dentro da área de sangria/margem com pedido, peça, tamanho e cópia ("#42 · Frente · M · 3/6"). Linhas técnicas (fio, piques) num traço que não se confunda com a arte, com opção de desligar no perfil.
- **Por tamanho:** um jogo de peças (mangas 2×) por atleta daquele tamanho, encaixado na largura útil.
- **Unificado:** um jogo de peças por atleta (ou pela grade, sem lista), encaixe na largura útil (encaixe por retângulos envolventes, faixas, mais altas primeiro, com rotação de 90° quando permitida). Se passar do comprimento máximo, divide em pranchas numeradas.
- Cada prancha tem um **quadrado de controle de 100 × 100 mm** e o cabeçalho com pedido, perfil e "ESCALA 1:1".
- Textos: fontes incorporadas no PDF (ou convertidas em curvas), para não trocar fonte no RIP.

### 6. Lista de atletas (decidido pelo usuário: nome e número por atleta)
- **Orçamento (`orcamento.html`):** nova seção "Atletas" com linhas de nome, número e tamanho (adicionar, remover, colar várias linhas de uma planilha no formato `nome; número; tamanho`). A grade de tamanhos passa a ser **calculada pela lista**. Se a lista ficar vazia, vale a grade digitada como hoje (compatível com os pedidos antigos e com quem ainda não tem os nomes).
- Avisos (não bloqueiam): número repetido, nome que não cabe na largura do elemento (o texto encolhe até um mínimo e depois avisa), tamanho sem molde.
- Limites: nome com até 15 caracteres e número com até 3 dígitos (os mesmos do simulador); no máximo 200 atletas por pedido.
- **Banco:** nova coluna `orcamentos.atletas jsonb` (`[{ "nome": "...", "numero": "10", "tamanho": "M" }]`), com `check` de tipo array e de tamanho máximo, no `schema.sql` (idempotente). Também vai para a cópia local do `JP_DB`.
- **Simulador:** o nome e o número continuam servindo de prévia no 3D e são o valor padrão para a primeira linha da lista.
- **Exportação:** cada atleta gera um jogo completo de peças do seu tamanho, com o seu nome e número nas costas. Frente, mangas e ribana repetem a arte comum. O rótulo de cada peça leva o atleta ("#42 · Costas · M · 10 SILVA").
  - **PDF por tamanho:** todos os atletas daquele tamanho.
  - **PDF unificado:** todos os atletas de todos os tamanhos.
  - **Sem lista:** a quantidade vem da grade, com o nome e o número do simulador em todas as cópias (com aviso no manifesto).
- **Painel:** o inspetor do pedido mostra a lista de atletas, e a ficha técnica ganha uma tabela de atletas por tamanho (no `.prn`, até 80 colunas, em ASCII).

### 7. Gola diferente da do molde
- O único molde cadastrado é de gola careca. Se o projeto tiver gola V ou polo, o botão do pacote mostra "Molde de gola V/polo não cadastrado" e não gera os PDFs de impressão; a ficha técnica continua disponível. (Decisão minha, já apresentada ao usuário: bloquear é mais seguro do que imprimir um decote errado.)

### 8. Ficha técnica
- Continua (SVG P&B e `.prn`), mas as medidas passam a vir do molde real de cada tamanho em vez dos valores fixos do M.

## Decisões do builder (já tomadas por mim; podem ser corrigidas)
- jsPDF + JSZip via CDN (consistente com o uso do Supabase por CDN).
- Layout em cm a partir da âncora; elemento com tamanho fixo entre tamanhos.
- Perfil de produção no localStorage neste lote (tabela no Supabase fica para depois).
- Escudo salvo como data URL dentro do `projeto_3d`.
- Encaixe simples por retângulos; encaixe por contorno real fica para depois.

- Pacote bloqueado para gola V/polo enquanto só existir o molde de gola careca (seção 7).
- PDF por tamanho com todos os atletas daquele tamanho; sem lista, quantidade pela grade.
- Limite de 200 atletas por pedido.

## Respondido pelo usuário
- Escopo: só os moldes que existem (camiseta básica P/M/G); o resto entra depois.
- O arquivo de impressão leva a arte dentro das peças (sublimação).
- A arte segue a posição do 3D, com posicionamento livre pelo cliente neste lote.
- Abordagem A.
- Nome e número por atleta, com lista no pedido.

## Deixado para o builder
- Calibrar os valores padrão do layout para reproduzir o 3D atual.
- Algoritmo de detecção dos pontos de referência e da expansão do contorno para a sangria.
- Organização interna dos módulos e dos testes (seguindo `tests/verify_*.js` com `assert`).

## Testes de aceite
- Importar os 3 PLT gera JSON com 5 peças cada e medidas iguais às da tabela (± 1 mm).
- PDF: o quadrado de controle mede 100,0 × 100,0 mm; nenhuma peça passa da largura útil; nenhuma peça tem escala diferente de 1:1.
- Mesmo layout em P, M e G: o número fica no centro das costas, à mesma distância do decote.
- Pedido com tamanho sem molde: pacote sai com aviso no manifesto e na ficha.
- Texto vindo do pedido é escapado (SVG/PDF) como no molde atual.
- Pedido com 3 atletas M e 2 G: o PDF do M tem 3 jogos e o do G tem 2, cada costas com o nome e o número certos; o unificado tem os 5.
- Pedido antigo sem `atletas` continua exportando pela grade.
- Projeto com gola V: o pacote de impressão fica bloqueado com aviso e a ficha continua saindo.

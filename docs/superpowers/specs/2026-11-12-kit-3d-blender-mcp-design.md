# Design Spec: Kit Esportivo 3D Completo + Golas Intercambiáveis + Texturas PBR (Blender MCP -> Simulador Web)

## Intent & Why
O simulador 3D atual da réplica Perfil Sports / Ícone Sports carrega apenas uma malha de camisa simples (`objeto.obj`) com uma única gola fixa e pintura 2D chapada sem relevo de tecido nem o restante do fardamento (calção e meião), ficando distante da imagem de referência oficial (kit completo com camisa verde rajada, escudo no peito, gola V branca, calção branco e meião verde). O objetivo é gerar no Blender (conectado via MCP na porta `9876`) os modelos 3D completos do kit, as 3 variações de gola, e as texturas PBR/estampas, integrando tudo ao visualizador Three.js em `app/`.

## Goals
1. **Cena e Modelos 3D via Blender MCP (Porta 9876):**
   - Importar `app/models/objeto.obj` no Blender, separar a malha do corpo/mangas (`Camisa_Corpo`) da gola original (`Gola_V`).
   - Modelar/gerar no Blender mais duas variações de gola encaixadas perfeitamente no decote da camisa: `Gola_Redonda` (careca tradicional) e `Gola_Polo` (colarinho dobrado com abertura frontal).
   - Modelar no Blender o `Calcao` (shorts esportivo DryTex Pro com caimento anatômico abaixo da camisa) e o `Meiao` (par de meiões esportivos abaixo do calção), alinhados nas proporções da imagem de referência.
   - Exportar o kit completo unificado em `app/models/kit_completo.obj` com grupos nomeados (`Camisa_Corpo`, `Gola_V`, `Gola_Redonda`, `Gola_Polo`, `Calcao`, `Meiao`, `Punhos`) e atualizar `app/js/embedded_assets.js` para funcionar tanto via servidor HTTP quanto via `file://`.
2. **Texturas PBR e Estampas Esportivas:**
   - Gerar via Blender/Python mapas de tecido esportivo Dry-Fit tileable (`app/assets/textures/dryfit_normal.png` e `app/assets/textures/dryfit_roughness.png`) para dar microrelevo realista de malha esportiva.
   - Criar o padrão de estampa **"Verde Rajado (Referência)"** (`slash` / `rajado`) além dos padrões existentes, e incluir um escudo vetorial padrão ("SEU ESCUDO" + logo "icone") idêntico à referência visual quando o usuário ainda não subiu um PNG próprio.
3. **Integração no Simulador Web (`app/index.html` e `app/js/app.js`):**
   - Conectar o seletor `<select id="selectGola">` (`v`, `redonda`, `polo`) para alternar em tempo real a visibilidade das malhas `Gola_V`, `Gola_Redonda` e `Gola_Polo` no modelo 3D.
   - Adicionar controles de visualização/cor para **Calção** e **Meião** (permitindo também focar câmera no Kit Completo, Só Camisa, Calção ou Meião, como nas abas/vistas da referência).
   - Aplicar o Normal Map e Roughness Map de Dry-Fit nos materiais Three.js da camisa, golas, calção e meião.

## Non-Goals & Anti-Goals
- **Non-Goal:** Simulação física de tecido em tempo real no navegador (Cloth physics pesada via WebGL) — o caimento vem esculpido na malha estática exportada do Blender.
- **Anti-Goal:** Quebrar o funcionamento offline (`file://`) que usa `app/js/embedded_assets.js`.

## Constraints
- Conexão com o Blender ativa via socket TCP JSON em `127.0.0.1:9876` (`BlenderMCPServer`).
- Toda modificação do simulador web fica contida em `app/`.

## Approaches Considered
1. **Abordagem A (Escolhida) — Kit Completo Modular em OBJ + PBR Dry-Fit:**
   - Gerar no Blender via MCP as malhas nomeadas (`Camisa_Corpo`, `Gola_V`, `Gola_Redonda`, `Gola_Polo`, `Calcao`, `Meiao`, `Punhos`), exportar e controlar visibilidade/materiais por sub-mesh no Three.js.
   - *Trade-off:* Exige separar e modelar as peças adicionais no Blender, mas entrega 100% da fidelidade visual da imagem de referência com performance máxima na web.
2. **Abordagem B — Apenas Camisa com Troca de Golas:**
   - Descartada por não contemplar o calção e meião presentes na referência.

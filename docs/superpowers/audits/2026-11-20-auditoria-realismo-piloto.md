# Auditoria — Simulador 3D de Uniformes (Projeto Piloto Comercial)

Data: 2026-11-20 · Foco: realismo do preset da camisa e conversão de lead.

## 1. Veredito

A base técnica é boa (Three.js leve, troca de gola em tempo real, presets, modo offline). O que mais travava a venda era o **realismo percebido**. A cor exibida não batia com a cor escolhida, a malha aparecia facetada e o tecido não tinha volume. Os três itens críticos abaixo foram corrigidos nesta rodada. Os demais ficam como roadmap.

## 2. Problemas encontrados e status

| # | Severidade | Problema | Impacto no lead | Status |
|---|---|---|---|---|
| 1 | **Crítica** | As texturas do canvas não eram tratadas como sRGB. O "Verde #005913" aparecia como verde-claro neon, e todas as cores da paleta ficavam lavadas. | O cliente compra uma cor e recebe outra, o que gera devolução e quebra de confiança. | ✅ Corrigido (`encoding = sRGBEncoding` em camisa, calção e meião) |
| 2 | **Crítica** | Visual facetado ("low-poly"). A camisa tinha só 2.6k faces, e o app recalculava normais (`computeVertexNormals`) em geometria não indexada, o que gera sombreamento chapado por triângulo. | Parece jogo antigo, não produto real. | ✅ Corrigido: subdivisão no Blender + normais suaves exportadas + app usa as normais do arquivo |
| 3 | **Alta** | Tecido com espessura zero (bainha, gola e punho parecendo "papel") e sem caimento. | A peça parece plástico. | ✅ Espessura real (Solidify) + drapeado sutil procedural |
| 4 | **Alta** | Iluminação com ambiente 0.72, que achatava todas as dobras. | Perde volume e leitura do tecido. | ✅ Rig de estúdio: hemisférica + key quente + rim + fill |
| 5 | Média | Logo "icone" espelhado no calção (UV invertida). | Erro grosseiro que salta aos olhos. | ✅ Corrigido no desenho da textura |
| 6 | **Alta** | O calção é geometricamente "dois tubos retos", sem cós, fenda lateral nem cavalo. | É a peça menos crível do kit. | ✅ Remodelado (Calcao v2 em `blender_refine_kit.py`): cós com volume, quadril único, entrepernas costurado, pernas em "A", fenda lateral, viés na barra e novo layout UV |
| 6b | **Alta** | Gola polo irreal: pé de ~1,3 cm, aba de ~2 cm que não caía sobre o corpo e peitilho como um quadrado solto e chapado. | A opção "Passeio/Polo" não convencia ninguém a comprar. | ✅ Gola_Polo v2 (`blender_refine_kit.py`): pé ~3 cm, aba ~7 cm drapeada sobre ombros, costas e peito, pontas abertas, peitilho de 2 tiras sobrepostas acompanhando o peito, 2 botões |
| 7 | Média | O normal map "dry-fit" dos meiões é forte demais e aparece como colmeia gigante. | Parece textura de bola, não malha. | ✅ Corrigido: normal map próprio (repeat 90, relevo 0.12), canelado vertical e punho com frisos na Cor 3 |
| 8 | Média | A estampa "rajado" só cobre o painel frontal. Costas e mangas ficam lisas. | Kits reais têm estampa contínua; o lisinho atrás denuncia o mock. | ✅ Estampa contínua em frente, costas e mangas (nome/número seguem legíveis por cima) |
| 9 | Média | Sem environment map (reflexo de estúdio). O dry-fit real tem brilho sutil. | Aspecto opaco e "CG". | ✅ Environment de estúdio procedural (cúpula + 3 softboxes via PMREM), sem arquivo HDR |
| 10 | Média | `embedded_assets.js` com 6,7 MB, carregado sempre, mesmo via HTTP. | Celular em 4G espera vários segundos, e lead que espera é lead perdido. | ✅ Parcial: embed só em `file://` + gzip no `serve.js` → 6,7 MB caiu para ~1,8 MB via HTTP. Próximo passo: glTF + Draco (~10x menor) |
| 11 | Baixa | Sem sombra de contato/chão. O kit "flutua". | Reduz o ancoramento visual. | ✅ Sombra de contato radial sob o kit |
| 12 | Baixa | Testes só verificam se strings existem nos arquivos. | Regressões visuais (como a 1 e a 2) passam despercebidas. | ⏳ Roadmap: screenshot de referência + diff de pixel |

## 3. Recomendações de produto (conversão)

1. **Foto de produto, não só 3D:** um botão "Gerar mockup" que exporta um PNG em alta (`renderer.domElement.toDataURL`) para o cliente mandar no grupo do time. É o principal gatilho de venda em uniforme coletivo.
2. **Orçamento instantâneo no resumo:** preço por peça × quantidade de atletas, com CTA de WhatsApp levando o resumo da configuração.
3. **Presets por modalidade e realidade do cliente:** varzea, society, escolinha, empresa. Hoje são 3 presets de cor; vender é mostrar "o kit do meu time" em 1 clique.
4. **Selo de fidelidade de cor:** depois da correção sRGB, faz sentido calibrar a paleta contra as amostras físicas de sublimação e informar "cor fiel à produção".

## 4. Risco jurídico — atenção antes de ofertar ao mercado

Os modelos base (`objeto.obj`, `formas2048.svg`, `info.json`), o molde UV, nomes e a marca "icone" foram **baixados do site iconesports.com.br** (ver `get_champions_data.js` e `download_scripts.js`). Se vocês não são a própria Ícone Sports ou não têm licença, **não é possível comercializar** com esses ativos nem com a marca. Para um piloto vendável:
- Modelar uma camisa própria no Blender, com UV e molde próprios. O pipeline atual (`scripts/blender_*`) já serve de base.
- Substituir "icone", "ICONE SPORTS" e os textos de marca pela identidade do seu produto.

## 5. O que foi alterado nesta rodada

- `scripts/blender_exec.js`: cliente Node para executar scripts no Blender via MCP (porta 9876).
- `scripts/blender_refine_kit.py`: pipeline de refinamento (solda de vértices, subdivisão com UV preservada, drapeado, espessura, normais suaves, export). Gera backup em `app/models/kit_completo_v1_backup.obj`/`.blend`.
- `app/models/kit_completo.obj` / `.blend`: kit refinado (cerca de 36k faces; antes cerca de 5k).
- `app/js/app.js`: sRGB nas texturas, normais do Blender preservadas, novo rig de luz, logo do calção corrigido.
- `app/js/embedded_assets.js`: regenerado.
- `.claude/launch.json`: configuração de preview do servidor local.

Reverter o modelo: copie `kit_completo_v1_backup.obj` sobre `kit_completo.obj` e rode `node scripts/build_embedded_assets.js`.

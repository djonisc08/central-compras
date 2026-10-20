---
name: nova-requisicao
description: Transforma um pedido de material vindo da obra (texto ou print do WhatsApp, foto de lista, áudio transcrito) em requisição na Central de Compras. Use quando o usuário colar uma mensagem de pedido da obra, disser "chegou pedido da obra", "nova requisição", ou deixar arquivos em ./entrada pedindo para lançar.
---

# Nova requisição a partir do WhatsApp

Objetivo: ler o pedido da obra, casar cada item com o catálogo padronizado, mostrar a prévia e **só gravar depois do OK do usuário**.

## Regras
- **Nunca** edite `data/compras.db` nem rode SQL. Grave só com `npm run gravar:requisicao`.
- **Sempre** mostre a prévia e espere a confirmação explícita ("ok", "pode gravar") antes de rodar com `--confirmar`.
- Na dúvida (obra, quantidade, unidade, material ambíguo), **pergunte** de forma curta. Não invente.

## Passo a passo

1. **Ler a entrada**
   - Texto colado na conversa, ou arquivos em `./entrada` (`.txt`, prints `.png/.jpg`, `.pdf`). Leia imagens e PDFs com a ferramenta Read.
   - Se houver vários arquivos, pergunte qual processar (ou processe um por vez).

2. **Identificar o cabeçalho**
   - **Obra:** compare com `npm run --silent ctx -- obras`. A equipe chama as obras por número ("189" = MAX Studios 189, "206" = MAX Studio 206, "94" = MAX 94, "177" = MAX Studios 177).
   - **Solicitante:** quem mandou a mensagem (nome do contato do WhatsApp).
   - **Data do pedido:** data da mensagem (ou hoje). **Data de necessidade:** converta "hoje", "amanhã", "quinta", "dia 25" para `AAAA-MM-DD` a partir da data do pedido. Sem data → pergunte.
   - **Urgente:** deixe o script decidir (necessidade em até 1 dia), a menos que a mensagem diga "urgente".

3. **Casar os itens com o catálogo**
   - Rode `npm run --silent ctx -- buscar "texto 1" "texto 2" ...` com o texto de cada item **como veio**.
   - `sinonimo_exato`/`nome_exato` → use o id. `semelhanca` ≥ 0,6 e unidade coerente → use, mas sinalize na prévia. Abaixo disso, ou se houver dois candidatos parecidos (ex.: ferro 3/8 vs 5/16) → **pergunte**.
   - Não existe no catálogo → proponha `novoMaterial` com **nome padronizado completo** (tipo + medida + especificação + embalagem, ex.: "Telha fibrocimento 2,44x1,10m 6mm"), unidade e categoria (`npm run --silent ctx -- categorias`). Categoria nova só com `"novaCategoria": true`, e avise o usuário.
   - Converta quantidades e unidades: "1 milheiro" de bloco = 1000 un; "meio caminhão de areia" → pergunte os m³.
   - Guarde o texto original em `textoOriginal`: o script aprende como sinônimo.

4. **Montar o rascunho** em `entrada/rascunhos/req-<obra>-<AAAAMMDD-HHMM>.json`:
```json
{
  "obra": "MAX Studios 189",
  "solicitante": "Mestre de obras · 189",
  "dataPedido": "2026-10-20",
  "dataNecessidade": "2026-10-22",
  "origemTexto": "<mensagem original completa>",
  "arquivoOrigem": "entrada/whats-189.png",
  "observacoes": "Descarregar no subsolo",
  "itens": [
    { "materialId": 1, "quantidade": 80, "textoOriginal": "cp2" },
    { "novoMaterial": { "nome": "Telha fibrocimento 2,44x1,10m 6mm", "unidade": "un", "categoria": "Cobertura", "novaCategoria": true },
      "quantidade": 40, "textoOriginal": "telhas fibrocimento 6mm" }
  ]
}
```

5. **Prévia:** `npm run --silent gravar:requisicao -- --arquivo entrada/rascunhos/<arquivo>.json`
   Mostre ao usuário a tabela (material padronizado × "como veio"), a data de necessidade e os avisos. Pergunte: **"Posso gravar?"**

6. **Gravar** (só após o OK): mesmo comando com `--confirmar`. O arquivo de origem vai para `entrada/processados/`.

7. **Fechar:** informe o nº da requisição e o link. Ofereça o próximo passo: *"Quer que eu gere as mensagens de cotação (skill mensagem-cotacao)?"*

## Exemplo
Entrada: `entrada/exemplos/whatsapp-pedido-obra.txt`.

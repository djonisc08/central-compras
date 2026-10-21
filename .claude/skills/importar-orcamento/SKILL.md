---
name: importar-orcamento
description: Lê orçamentos de fornecedores (PDF, foto, print, texto do WhatsApp, e-mail ou a planilha de cotação devolvida preenchida) em ./entrada, extrai preços, frete, prazo, condição, desconto à vista, IPI e validade, vincula à requisição, mostra a conferência e grava após confirmação. Use quando o usuário disser "chegou orçamento", "importa a cotação", "lança essa proposta" ou deixar arquivos de orçamento em ./entrada.
---

# Importar orçamento de fornecedor

Objetivo: tirar a digitação do comprador. Ler o orçamento, conferir item a item contra a requisição, apontar armadilhas e gravar a proposta **só depois do OK**.

## Regras
- **Nunca** edite `data/compras.db` nem rode SQL. Grave só com `npm run gravar:proposta` ou `npm run ler:planilha`.
- **Sempre** mostre a prévia com os avisos e espere a confirmação antes de `--confirmar`.
- Valores no rascunho em **reais** (`453.77`). O script converte para centavos.

## Caminho 1: planilha da Central devolvida pelo fornecedor (automático)
Arquivo `.xlsx` gerado pelo sistema (tem a aba oculta `_central`):
1. `npm run --silent ler:planilha -- entrada/<arquivo>.xlsx` cria o rascunho e mostra a prévia.
2. Mostre a tabela e os avisos. Após o OK: `npm run --silent gravar:proposta -- --arquivo <rascunho indicado> --confirmar`.
3. Se o script disser que falta o fornecedor, use `--fornecedor <id ou nome>`.

## Caminho 2: PDF, foto, print ou texto do fornecedor
1. **Ler** o arquivo com a ferramenta Read (PDF e imagem funcionam). Um orçamento pode ter vários pedidos ou páginas: leia tudo.
2. **Descobrir a requisição:**
   - Procure "cotação nº", "ref.", obra, CNPJ ou CNO no documento.
   - Compare com `npm run --silent ctx -- requisicoes` (itens e obra).
   - Na dúvida entre duas, pergunte.
3. **Pegar os ids dos itens:** `npm run --silent ctx -- requisicao <id>` lista os `requisicaoItemId`.
4. **Fornecedor:** confira com `npm run --silent ctx -- fornecedores`. Se não existir, use `{ "novo": { "nome", "cnpj", "contato", "whatsapp", "email", "cidade", "categorias": [...] } }` e avise que vai cadastrar.
5. **Extrair com atenção:**
   - **Preço unitário na unidade da requisição.** Se vier por metro e o pedido for por rolo de 100 m, converta (2,45/m → 245,00/rolo) e anote em `marca`.
   - **Quantidade cotada** em `quantidadeCotada`, sempre. O script avisa se diferir (ex.: Balaroti cotou 126 kits para 123 vasos).
   - **Kits ou componentes avulsos:** some os componentes num preço unitário por conjunto e explique na `marca`.
   - **IPI:** "s/ IPI", "IPI não incluso" ou alíquota destacada → `"impostosInclusos": false`.
   - **Frete:** CIF/grátis = 0, FOB = valor informado. Não informado → deixe vazio (o script avisa).
   - **Pagamento:** a prazo em `condicaoPagamento` ("3x (28/42/56 dias)"). Desconto à vista ou antecipado em `descontoAVistaPct` (3.5).
   - **Prazo:** dias em `prazoEntregaDias` e a base em `prazoObservacao` ("após faturamento", "após liberação do crédito"). "90 dias" ≠ "90 dias úteis": anote.
   - **Nº do orçamento ou pedido do fornecedor**, **vendedor ou representante**, **validade** (data; "5 dias" = data da cotação + 5).
   - **Item não atendido:** `"disponivel": false` (sem preço).
   - **Endereço de entrega ou faturamento errado** no orçamento (ex.: escritório no lugar da obra): coloque em `observacoes` e avise o usuário.
6. **Rascunho** em `entrada/rascunhos/prop-<req>-<fornecedor>.json`:
```json
{
  "requisicaoId": 125,
  "fornecedor": "Roca / Celite",
  "dataCotacao": "2026-10-19",
  "frete": 0,
  "condicaoPagamento": "3x (28/42/56 dias)",
  "descontoAVistaPct": 3.5,
  "prazoEntregaDias": 20,
  "prazoObservacao": "após faturamento",
  "impostosInclusos": true,
  "numeroOrcamento": "7158073",
  "vendedor": "ELP Representações",
  "validade": "2026-10-29",
  "observacoes": "Proposta veio com entrega no escritório: ajustar para a obra.",
  "arquivoOrigem": "entrada/Orcamento_Roca.pdf",
  "itens": [
    { "requisicaoItemId": 328, "precoUnitario": 453.77, "quantidadeCotada": 123, "marca": "Celite LIKE (BACIA C/CX 3/6L+CP INST LIKE BR)" },
    { "requisicaoItemId": 329, "precoUnitario": 778.51, "quantidadeCotada": 3, "marca": "Celite ACESSO COMF" }
  ]
}
```
7. **Prévia:** `npm run --silent gravar:proposta -- --arquivo <rascunho>`. Confira se o **total do script bate com o total do orçamento**. Se não bater, explique a diferença (quantidade, frete, IPI, arredondamento).
8. Mostre a tabela, os avisos e a conferência do total. Pergunte **"Posso gravar?"**. Após o OK, rode com `--confirmar`. O arquivo vai para `entrada/processados/`.
9. **Fechar:** link do mapa (`/requisicoes/<id>/mapa`). Se todos os fornecedores já responderam, resuma quem está mais barato e quem chega a tempo.

## Unidade diferente da requisição (ex.: Frigelar cota cobre em kg)

O mapa compara **preço por unidade da requisição × quantidade pedida**. Quando o fornecedor cota em outra unidade
(tubo de cobre pedido em **15 m** e cotado em **5,10 kg × R$ 135,47/kg**, rolo × metro, caixa × unidade):
1. Use o **valor total da linha** do PDF e divida pela quantidade da requisição:
   `"precoUnitario": total_da_linha / quantidade_requisitada` (em reais) → R$ 690,90 / 15 m = 46,06 por m.
2. Registre a conversão em `marca`: `"Eluma · cotado 5,10 kg × R$ 135,47/kg"`, para quem olhar o mapa entender.
3. Mostre a conversão na tabela de conferência e avise se a quantidade do fornecedor parece não cobrir a pedida.

Itens que o fornecedor mandou a mais (não estão na requisição, ex.: tubo isolante, fita): liste à parte e pergunte se
devem entrar — se sim, primeiro adicione o item à requisição pela tela "Editar / adicionar itens" e depois importe.
Itens da requisição que ele não cotou: `"disponivel": false`.

Frete: use o "Total do frete" do PDF em `"frete"`. "Faturado 30/60/90 dias" → `"condicaoPagamento"` igual ao texto.
"Neste orçamento NÃO estão inclusos os impostos" → `"impostosInclusos": false`.

## Vários orçamentos de uma vez
Processe um por vez, com uma prévia e uma confirmação cada. No fim, dê o resumo comparativo.

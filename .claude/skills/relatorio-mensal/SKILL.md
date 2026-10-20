---
name: relatorio-mensal
description: Gera o relatório mensal de compras para a diretoria — KPIs (gasto, saving, economia na cotação, lead time, % urgentes, pontualidade), gasto por obra, fornecedores, variação de preços, curva ABC, destaques e alertas — em Excel e página imprimível (PDF), com um resumo executivo redigido. Use quando o usuário pedir "relatório do mês", "fechamento", "resultado para a diretoria" ou "quanto economizamos".
---

# Relatório mensal para a diretoria

Somente leitura. Nada é gravado no banco.

## Passo a passo
1. **Mês:** o informado (`AAAA-MM`). Sem informação, use o **mês anterior** se hoje for até o dia 5; senão, o mês corrente (parcial, avise).
2. **Gerar:** `npm run --silent relatorio -- --mes AAAA-MM` gera `saida/relatorio-compras-AAAA-MM.xlsx` e o link da página.
3. **Dados para o texto:** `npm run --silent relatorio -- --mes AAAA-MM --json`.
4. **Redigir o resumo executivo** (até 10 linhas, linguagem de diretoria, números em R$):
   - **Resultado:** gasto do mês, economia na cotação e saving, e o que cada um significa em uma frase.
   - **Onde foi o dinheiro:** obras e categorias principais, e a curva A.
   - **Eficiência:** lead time, % urgentes contra a meta de 5% e pontualidade.
   - **Alertas:** materiais em alta, fornecedores atrasando, não conformidades, com uma ação sugerida para cada.
   - **Próximos passos:** 2 a 3 ações concretas (negociar contrato de aço, cobrar o fornecedor X, antecipar o planejamento de cimento com a obra Y).
   Use **só os números do JSON**. Não invente; se um indicador vier `null`, diga "sem dados".
5. **Entregar:**
   - o resumo na conversa, pronto para colar em e-mail ou WhatsApp;
   - o arquivo Excel;
   - o link da página para imprimir ou salvar em PDF (`/imprimir/relatorio?mes=AAAA-MM`).
6. **Comparar** (se pedirem): rode também o mês anterior e destaque as variações.

## Fórmulas (para explicar se perguntarem)
Estão em `src/lib/kpis.ts` (`FORMULAS`). Saving compara com o último preço pago do mesmo material; economia na cotação compara com a maior proposta recebida.

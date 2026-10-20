/**
 * Relatório mensal para a diretoria (somente leitura).
 *
 *   npm run relatorio -- --mes 2026-10
 *
 * Gera saida/relatorio-compras-AAAA-MM.xlsx, imprime o resumo e o link da página imprimível.
 * Com --json, imprime os indicadores completos em JSON (usado pela skill para redigir o texto).
 */
import path from "node:path";
import { getDb } from "../src/db/client";
import { formatarMes, hojeISO } from "../src/lib/datas";
import { calcularIndicadores, periodoDoMes } from "../src/server/dados/indicadores";
import { planilhaRelatorio } from "../src/server/exportacoes";
import { argumentos, falhar, PASTA_SAIDA, reais, rodar, tabela, URL_APP } from "./_comum";

const { texto, tem } = argumentos();
const mes = texto("mes") ?? hojeISO().slice(0, 7);
if (!/^\d{4}-\d{2}$/.test(mes)) falhar("Use --mes AAAA-MM");

rodar(async () => {
  const db = getDb();
  const ind = calcularIndicadores(db, periodoDoMes(mes));
  if (tem("json")) {
    const { savingItens, ...resto } = ind;
    console.log(JSON.stringify({ ...resto, pedidos: ind.pedidos.length, topSaving: [...savingItens].sort((a, b) => b.valor - a.valor).slice(0, 10), abc: ind.abc.slice(0, 15) }, null, 2));
    return;
  }
  const pct = (f: number | null) => (f == null ? "—" : `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
  console.log(`\nRelatório de compras · ${formatarMes(mes)}\n`);
  tabela(
    ["Indicador", "Valor"],
    [
      ["Gasto (pedidos emitidos)", reais(ind.gasto)],
      ["Pedidos", ind.qtdPedidos],
      ["Economia na cotação", reais(ind.costAvoidance)],
      ["Saving vs último preço", reais(ind.saving)],
      ["Lead time médio", ind.leadTimeMedio == null ? "—" : `${ind.leadTimeMedio.toFixed(1)} dias`],
      ["% urgentes (meta < 5%)", pct(ind.pctUrgentes)],
      ["Pontualidade", pct(ind.pontualidade)],
      ["Não conformes", ind.naoConformes],
    ],
  );
  console.log("\nGasto por obra:");
  tabela(["Obra", "Gasto"], ind.gastoPorObra.map((g) => [g.nome, reais(g.total)]));
  console.log("\nDestaques:");
  for (const d of ind.destaques) console.log(`  + ${d}`);
  console.log("\nAlertas:");
  for (const a of ind.alertas) console.log(`  ! ${a}`);

  const arquivo = path.join(PASTA_SAIDA, `relatorio-compras-${mes}.xlsx`);
  await planilhaRelatorio(db, ind).xlsx.writeFile(arquivo);
  console.log(`\n✓ Excel: saida/relatorio-compras-${mes}.xlsx`);
  console.log(`✓ Página para imprimir/PDF: ${URL_APP}/imprimir/relatorio?mes=${mes}\n`);
});

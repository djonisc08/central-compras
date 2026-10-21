import { getDb } from "@/db/client";
import { respostaXlsx } from "@/lib/excel";
import { lerIds } from "@/server/dados/cotacao";
import { planilhaCotacaoFornecedor } from "@/server/exportacoes";

export async function GET(req: Request, ctx: RouteContext<"/api/exportar/cotacao/[id]">) {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const fornecedorId = Number(sp.get("fornecedor")) || null;
  const wb = await planilhaCotacaoFornecedor(getDb(), Number(id), fornecedorId, lerIds(sp.get("itens")));
  if (!wb) return new Response("Requisição não encontrada", { status: 404 });
  return respostaXlsx(wb, `cotacao-${id}${fornecedorId ? `-f${fornecedorId}` : ""}.xlsx`);
}

import { getDb } from "@/db/client";
import { respostaXlsx } from "@/lib/excel";
import { planilhaCotacaoFornecedor } from "@/server/exportacoes";

export async function GET(req: Request, ctx: RouteContext<"/api/exportar/cotacao/[id]">) {
  const { id } = await ctx.params;
  const fornecedorId = Number(new URL(req.url).searchParams.get("fornecedor")) || null;
  const wb = await planilhaCotacaoFornecedor(getDb(), Number(id), fornecedorId);
  if (!wb) return new Response("Requisição não encontrada", { status: 404 });
  return respostaXlsx(wb, `cotacao-${id}${fornecedorId ? `-f${fornecedorId}` : ""}.xlsx`);
}

import { getDb } from "@/db/client";
import { respostaXlsx } from "@/lib/excel";
import { planilhaMapa } from "@/server/exportacoes";

export async function GET(_req: Request, ctx: RouteContext<"/api/exportar/mapa/[id]">) {
  const { id } = await ctx.params;
  const wb = planilhaMapa(getDb(), Number(id));
  if (!wb) return new Response("Requisição não encontrada", { status: 404 });
  return respostaXlsx(wb, `mapa-cotacao-${id}.xlsx`);
}

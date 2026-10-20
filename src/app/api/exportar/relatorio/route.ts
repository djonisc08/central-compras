import { getDb } from "@/db/client";
import { hojeISO } from "@/lib/datas";
import { respostaXlsx } from "@/lib/excel";
import { calcularIndicadores, periodoDoMes } from "@/server/dados/indicadores";
import { planilhaRelatorio } from "@/server/exportacoes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const mes = new URL(req.url).searchParams.get("mes") ?? hojeISO().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Use ?mes=AAAA-MM", { status: 400 });
  const db = getDb();
  return respostaXlsx(planilhaRelatorio(db, calcularIndicadores(db, periodoDoMes(mes))), `relatorio-compras-${mes}.xlsx`);
}

import { getDb } from "@/db/client";
import { hojeISO } from "@/lib/datas";
import { respostaXlsx } from "@/lib/excel";
import { planilhaCadastros } from "@/server/exportacoes";

export const dynamic = "force-dynamic";

export async function GET() {
  return respostaXlsx(planilhaCadastros(getDb()), `cadastros-${hojeISO()}.xlsx`);
}

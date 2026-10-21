import { salvarAnexo } from "@/server/anexos";

/** Recebe os orçamentos arrastados na tela da requisição (multipart, campo "arquivos"). */
export async function POST(req: Request, ctx: RouteContext<"/api/anexos/[id]">) {
  const { id } = await ctx.params;
  const form = await req.formData();
  const salvos: string[] = [];
  const erros: string[] = [];
  for (const f of form.getAll("arquivos")) {
    if (!(f instanceof File)) continue;
    try {
      salvos.push(await salvarAnexo(Number(id), f));
    } catch (e) {
      erros.push(`${f.name}: ${(e as Error).message}`);
    }
  }
  return Response.json({ salvos, erros }, { status: salvos.length || !erros.length ? 200 : 400 });
}

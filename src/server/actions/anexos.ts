"use server";

import { refresh } from "next/cache";
import { removerAnexo } from "@/server/anexos";
import { executar } from "./resultado";

export async function removerAnexoAction(requisicaoId: number, arquivo: string) {
  const r = executar(() => removerAnexo(requisicaoId, arquivo));
  if (r.ok) refresh();
  return r;
}

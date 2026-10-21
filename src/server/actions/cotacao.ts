"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { mudarCategoriaMaterial, registrarCobranca, registrarEnvio } from "@/server/dados/cotacao";
import { executar } from "./resultado";

export async function registrarEnvioAction(requisicaoId: number, fornecedorId: number, qtdItens: number) {
  const r = executar(() => registrarEnvio(getDb(), requisicaoId, fornecedorId, qtdItens));
  if (r.ok) refresh();
  return r;
}

export async function registrarCobrancaAction(requisicaoId: number, fornecedorId: number) {
  const r = executar(() => registrarCobranca(getDb(), requisicaoId, fornecedorId));
  if (r.ok) refresh();
  return r;
}

export async function mudarCategoriaMaterialAction(materialId: number, categoriaId: number) {
  const r = executar(() => mudarCategoriaMaterial(getDb(), materialId, categoriaId));
  if (r.ok) refresh();
  return r;
}

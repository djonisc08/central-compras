"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import {
  criarCategoria,
  salvarFornecedor,
  salvarMaterial,
  salvarObra,
} from "@/server/dados/cadastros";
import { salvarEmpresa } from "@/server/dados/empresa";
import type { EmpresaInput, FornecedorInput, MaterialInput, ObraInput } from "@/lib/validacao";
import { executar } from "./resultado";

export async function salvarObraAction(dados: ObraInput, id?: number) {
  const r = executar(() => salvarObra(getDb(), dados, id));
  if (r.ok) refresh();
  return r;
}

export async function salvarFornecedorAction(dados: FornecedorInput, id?: number) {
  const r = executar(() => salvarFornecedor(getDb(), dados, id));
  if (r.ok) refresh();
  return r;
}

export async function salvarMaterialAction(dados: MaterialInput, id?: number) {
  const r = executar(() => salvarMaterial(getDb(), dados, id));
  if (r.ok) refresh();
  return r;
}

export async function criarCategoriaAction(nome: string) {
  const r = executar(() => criarCategoria(getDb(), nome));
  if (r.ok) refresh();
  return r;
}

export async function salvarEmpresaAction(dados: EmpresaInput) {
  const r = executar(() => salvarEmpresa(getDb(), dados));
  if (r.ok) refresh();
  return r;
}

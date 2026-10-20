"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import {
  atualizarCabecalhoRequisicao,
  cancelarRequisicao,
  criarRequisicao,
  excluirProposta,
  limparVencedores,
  marcarFornecedorVencedor,
  marcarMenoresPrecos,
  marcarVencedorItem,
  reabrirRequisicao,
  salvarProposta,
} from "@/server/dados/requisicoes";
import type { PropostaInput, RequisicaoInput } from "@/lib/validacao";
import {
  atualizarRequisicaoCompleta,
  gravarRequisicao,
  prepararRequisicao,
  type RequisicaoCompletaEntrada,
} from "@/server/dados/requisicao-completa";
import { executar } from "./resultado";

function comRefresh<T>(r: ReturnType<typeof executar<T>>) {
  if (r.ok) refresh();
  return r;
}

export async function criarRequisicaoAction(dados: RequisicaoInput) {
  return executar(() => criarRequisicao(getDb(), dados));
}

export async function atualizarRequisicaoAction(
  id: number,
  dados: Parameters<typeof atualizarCabecalhoRequisicao>[2],
) {
  return comRefresh(executar(() => atualizarCabecalhoRequisicao(getDb(), id, dados)));
}

export async function cancelarRequisicaoAction(id: number) {
  return comRefresh(executar(() => cancelarRequisicao(getDb(), id)));
}

export async function reabrirRequisicaoAction(id: number) {
  return comRefresh(executar(() => reabrirRequisicao(getDb(), id)));
}

export async function salvarPropostaAction(dados: PropostaInput) {
  return comRefresh(executar(() => salvarProposta(getDb(), dados)));
}

export async function excluirPropostaAction(propostaId: number) {
  return comRefresh(executar(() => excluirProposta(getDb(), propostaId)));
}

export async function marcarVencedorItemAction(requisicaoItemId: number, propostaId: number | null) {
  return comRefresh(executar(() => marcarVencedorItem(getDb(), requisicaoItemId, propostaId)));
}

export async function marcarMenoresPrecosAction(requisicaoId: number) {
  return comRefresh(executar(() => marcarMenoresPrecos(getDb(), requisicaoId)));
}

export async function marcarFornecedorVencedorAction(requisicaoId: number, propostaId: number) {
  return comRefresh(executar(() => marcarFornecedorVencedor(getDb(), requisicaoId, propostaId)));
}

export async function limparVencedoresAction(requisicaoId: number) {
  return comRefresh(executar(() => limparVencedores(getDb(), requisicaoId)));
}

export async function criarRequisicaoCompletaAction(dados: RequisicaoCompletaEntrada) {
  return executar(() => {
    const db = getDb();
    const preparada = prepararRequisicao(db, dados);
    const r = gravarRequisicao(db, preparada);
    return { ...r, avisos: preparada.avisos };
  });
}

export async function atualizarRequisicaoCompletaAction(id: number, dados: RequisicaoCompletaEntrada) {
  return comRefresh(
    executar(() => {
      const db = getDb();
      const preparada = prepararRequisicao(db, dados);
      const r = atualizarRequisicaoCompleta(db, id, preparada);
      return { ...r, avisos: preparada.avisos };
    }),
  );
}

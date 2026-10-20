"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import {
  aprovarEEmitir,
  aprovarPedido,
  avaliarFornecedor,
  cancelarPedido,
  emitirPedido,
  gerarPedidos,
  registrarEntrega,
} from "@/server/dados/pedidos";
import type { AprovacaoInput, AvaliacaoInput, EmissaoInput, EntregaInput, GerarPedidosInput } from "@/lib/validacao";
import { executar } from "./resultado";

function comRefresh<T>(r: ReturnType<typeof executar<T>>) {
  if (r.ok) refresh();
  return r;
}

export async function gerarPedidosAction(dados: GerarPedidosInput) {
  return comRefresh(executar(() => gerarPedidos(getDb(), dados)));
}

export async function aprovarPedidoAction(id: number, dados: AprovacaoInput, emitirJunto?: { prazoPrometido?: string }) {
  return comRefresh(
    executar(() => {
      if (emitirJunto) return aprovarEEmitir(getDb(), id, { ...dados, ...emitirJunto });
      aprovarPedido(getDb(), id, dados);
      return null;
    }),
  );
}

export async function emitirPedidoAction(id: number, dados: EmissaoInput) {
  return comRefresh(executar(() => emitirPedido(getDb(), id, dados)));
}

export async function cancelarPedidoAction(id: number, motivo: string) {
  return comRefresh(executar(() => cancelarPedido(getDb(), id, motivo)));
}

export async function registrarEntregaAction(id: number, dados: EntregaInput) {
  return comRefresh(executar(() => registrarEntrega(getDb(), id, dados)));
}

export async function avaliarFornecedorAction(pedidoId: number, dados: AvaliacaoInput) {
  return comRefresh(executar(() => avaliarFornecedor(getDb(), pedidoId, dados)));
}

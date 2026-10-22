// Casos encontrados na auditoria final: cada um reproduz um problema que já foi corrigido.
import { beforeEach, describe, expect, it } from "vitest";
import { abrirDb, type DB } from "@/db/client";
import { criarCategoria, salvarFornecedor, salvarMaterial, salvarObra } from "@/server/dados/cadastros";
import { cancelarPedido, fecharCotacao, gerarPedidos, obterPedido } from "@/server/dados/pedidos";
import { atualizarRequisicaoCompleta, prepararRequisicao } from "@/server/dados/requisicao-completa";
import {
  criarRequisicao,
  excluirProposta,
  marcarFornecedorVencedor,
  marcarMenoresPrecos,
  marcarVencedorItem,
  obterMapa,
  obterRequisicao,
  salvarProposta,
} from "@/server/dados/requisicoes";

let db: DB;
let reqId: number;
let obra: number;
let a: number;
let b: number;
let itens: { id: number; materialId: number }[];

beforeEach(() => {
  db = abrirDb(":memory:");
  const cat = criarCategoria(db, "Geral");
  obra = salvarObra(db, { nome: "MAX 94" });
  const m1 = salvarMaterial(db, { nomePadronizado: "Item um", unidade: "un", categoriaId: cat });
  const m2 = salvarMaterial(db, { nomePadronizado: "Item dois", unidade: "un", categoriaId: cat });
  a = salvarFornecedor(db, { nome: "Fornecedor A", categoriaIds: [cat] });
  b = salvarFornecedor(db, { nome: "Fornecedor B", categoriaIds: [cat] });
  reqId = criarRequisicao(db, {
    obraId: obra,
    solicitante: "Cris",
    dataPedido: "2026-10-21",
    dataNecessidade: "2026-10-30",
    itens: [
      { materialId: m1, quantidade: 10 },
      { materialId: m2, quantidade: 10 },
    ],
  });
  itens = obterRequisicao(db, reqId)!.itens;
});

const proposta = (fornecedorId: number, precos: (number | null)[], extra: Record<string, number> = {}) =>
  salvarProposta(db, {
    requisicaoId: reqId,
    fornecedorId,
    dataCotacao: "2026-10-21",
    ...extra,
    itens: precos.map((p, i) => (p == null ? { requisicaoItemId: itens[i].id, precoUnitarioCentavos: 0, disponivel: false } : { requisicaoItemId: itens[i].id, precoUnitarioCentavos: p })),
  });

describe("auditoria final", () => {
  it("mudar a quantidade descarta o total exato antigo da linha", () => {
    salvarProposta(db, {
      requisicaoId: reqId,
      fornecedorId: a,
      dataCotacao: "2026-10-21",
      itens: [{ requisicaoItemId: itens[0].id, precoUnitarioCentavos: 1000, totalCentavos: 10000 }],
    });
    const p = prepararRequisicao(db, {
      obra,
      solicitante: "Cris",
      dataPedido: "2026-10-21",
      dataNecessidade: "2026-10-30",
      urgente: false,
      itens: [
        { id: itens[0].id, materialId: itens[0].materialId, quantidade: 20 },
        { id: itens[1].id, materialId: itens[1].materialId, quantidade: 10 },
      ],
    });
    atualizarRequisicaoCompleta(db, reqId, p);
    expect(obterMapa(db, reqId)!.resumo.linhas[0].celulas[0].total).toBe(20000);
  });

  it("saldo: o desconto negociado fica proporcional ao que foi fechado", () => {
    const pid = proposta(a, [1000, 1000], { descontoNegociadoCentavos: 2000, freteCentavos: 500 });
    marcarVencedorItem(db, itens[0].id, pid); // A leva só o item um; o dois vai para o saldo
    const r = fecharCotacao(db, { requisicaoId: reqId, separarSaldo: true });
    const pedido = obterPedido(db, r.pedidos[0])!;
    expect(pedido.descontoNegociadoCentavos).toBe(1000);
    expect(pedido.valorTotalCentavos).toBe(10000 - 1000 + 500);
  });

  it("depois de cancelar o pedido dá para excluir proposta e tirar item", () => {
    const pid = proposta(a, [1000, 1000]);
    marcarFornecedorVencedor(db, reqId, pid);
    const [pedidoId] = gerarPedidos(db, { requisicaoId: reqId });
    cancelarPedido(db, pedidoId, "fornecedor sem estoque");
    expect(() => excluirProposta(db, pid)).not.toThrow();
    const p = prepararRequisicao(db, {
      obra,
      solicitante: "Cris",
      dataPedido: "2026-10-21",
      dataNecessidade: "2026-10-30",
      urgente: false,
      itens: [{ id: itens[0].id, materialId: itens[0].materialId, quantidade: 10 }],
    });
    expect(() => atualizarRequisicaoCompleta(db, reqId, p)).not.toThrow();
    expect(obterPedido(db, pedidoId)!.itens).toHaveLength(2); // histórico do pedido cancelado continua
  });

  it("menores preços considera o desconto negociado", () => {
    proposta(a, [1000, 1000], { descontoNegociadoCentavos: 2000 }); // 20.000 − 2.000 = 18.000
    proposta(b, [950, 950]); // 19.000
    marcarMenoresPrecos(db, reqId);
    const r = obterMapa(db, reqId)!.resumo;
    expect(r.linhas.every((l) => l.celulas[0].vencedora)).toBe(true);
    expect(r.totalEscolhido).toBe(18000);
  });

  it("fornecedor vencedor precisa ser desta requisição", () => {
    expect(() => marcarFornecedorVencedor(db, reqId, 9999)).toThrow(/não pertence/);
  });
});

describe("cancelar um de vários pedidos", () => {
  it("os itens do pedido cancelado vão para uma requisição de saldo", async () => {
    const { aprovarEEmitir, registrarEntrega } = await import("@/server/dados/pedidos");
    const pa = proposta(a, [1000, null]);
    const pb = proposta(b, [null, 1000]);
    marcarVencedorItem(db, itens[0].id, pa);
    marcarVencedorItem(db, itens[1].id, pb);
    const [pedA, pedB] = gerarPedidos(db, { requisicaoId: reqId });
    aprovarEEmitir(db, pedA, { aprovadoPor: "Diretoria", dataAprovacao: "2026-10-21" });
    registrarEntrega(db, pedA, { dataReal: "2026-10-22" });
    const { saldoId } = cancelarPedido(db, pedB, "sem estoque");
    expect(saldoId).toBeTruthy();
    expect(obterRequisicao(db, saldoId!)!.itens.map((i) => i.material)).toEqual(["Item dois"]);
    expect(obterRequisicao(db, saldoId!)!.status).toBe("aberta");
    expect(obterRequisicao(db, reqId)!.itens).toHaveLength(1);
    expect(obterRequisicao(db, reqId)!.status).toBe("entregue");
  });
});

describe("cancelar e excluir cotação", () => {
  it("cancela junto o pedido ainda não enviado e guarda o motivo", async () => {
    const { cancelarRequisicao } = await import("@/server/dados/requisicoes");
    const pid = proposta(a, [1000, 1000]);
    marcarFornecedorVencedor(db, reqId, pid);
    const [pedidoId] = gerarPedidos(db, { requisicaoId: reqId }); // aguardando aprovação
    expect(cancelarRequisicao(db, reqId, "A obra cancelou o pedido").pedidosCancelados).toBe(1);
    expect(obterPedido(db, pedidoId)!.status).toBe("cancelado");
    const r = obterRequisicao(db, reqId)!;
    expect(r.status).toBe("cancelada");
    expect(r.observacoes).toMatch(/CANCELADA em .*A obra cancelou/);
  });

  it("não cancela se o pedido já foi emitido ao fornecedor", async () => {
    const { cancelarRequisicao } = await import("@/server/dados/requisicoes");
    const { aprovarEEmitir } = await import("@/server/dados/pedidos");
    const pid = proposta(a, [1000, 1000]);
    marcarFornecedorVencedor(db, reqId, pid);
    const [pedidoId] = gerarPedidos(db, { requisicaoId: reqId });
    aprovarEEmitir(db, pedidoId, { aprovadoPor: "Diretoria", dataAprovacao: "2026-10-21" });
    expect(() => cancelarRequisicao(db, reqId, "x")).toThrow(/já foi emitido/);
  });

  it("exclui de vez só o que nunca virou pedido", async () => {
    const { excluirRequisicao, podeExcluirRequisicao } = await import("@/server/dados/requisicoes");
    proposta(a, [1000, 1000]);
    expect(podeExcluirRequisicao(db, reqId)).toBe(true);
    excluirRequisicao(db, reqId);
    expect(obterRequisicao(db, reqId)).toBeNull();
  });
});

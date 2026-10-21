import { describe, expect, it } from "vitest";
import { abrirDb } from "@/db/client";
import { criarCategoria, salvarFornecedor, salvarMaterial, salvarObra } from "@/server/dados/cadastros";
import { gerarPedidos, obterPedido } from "@/server/dados/pedidos";
import { criarRequisicao, marcarFornecedorVencedor, obterMapa, obterRequisicao, salvarProposta } from "@/server/dados/requisicoes";
import { prepararProposta } from "../scripts/_proposta";

// Orçamento real Frigelar 62542389-1: produtos R$ 1.265,03 + frete R$ 67,60 = R$ 1.332,63.
describe("orçamento da Frigelar centavo a centavo", () => {
  const db = abrirDb(":memory:");
  const cat = criarCategoria(db, "Refrigeração X");
  const obra = salvarObra(db, { nome: "MAX Studios 189" });
  const m = (nome: string, unidade: string) => salvarMaterial(db, { nomePadronizado: nome, unidade, categoriaId: cat });
  const reqId = criarRequisicao(db, {
    obraId: obra,
    solicitante: "Luana",
    dataPedido: "2026-10-20",
    dataNecessidade: "2026-10-22",
    itens: [
      { materialId: m("Tubo cobre 5/8", "m"), quantidade: 15 },
      { materialId: m("Tubo cobre 3/8", "m"), quantidade: 15 },
      { materialId: m("Tape fita", "un"), quantidade: 1 },
      { materialId: m("PVC preta", "un"), quantidade: 10 },
      { materialId: m("Tubo isolante blindado 3/8", "m"), quantidade: 15 },
      { materialId: m("Tubo isolante blindado 5/8", "m"), quantidade: 15 },
    ],
  });
  salvarFornecedor(db, { nome: "Frigelar Floripa", categoriaIds: [cat] });
  const [cobre58, cobre38, tape, pvc, iso38, iso58] = obterRequisicao(db, reqId)!.itens.map((i) => i.id);
  const rascunho = (totalDocumento: number) => ({
    requisicaoId: reqId,
    fornecedor: "Frigelar",
    dataCotacao: "2026-10-20",
    frete: 67.6,
    condicaoPagamento: "Faturado 30/60/90 dias",
    prazoEntregaDias: 2,
    totalDocumento,
    itens: [
      { requisicaoItemId: cobre58, total: 690.9, quantidadeCotada: 5.1, unidadeCotada: "kg", marca: "Eluma · 5,10 kg × R$ 135,47/kg" },
      { requisicaoItemId: cobre38, total: 407.7, quantidadeCotada: 3, unidadeCotada: "kg", marca: "TM · 3 kg × R$ 135,90/kg" },
      { requisicaoItemId: tape, precoUnitario: 49.53 },
      { requisicaoItemId: pvc, precoUnitario: 3.41 },
      { requisicaoItemId: iso38, total: 32.48, quantidadeCotada: 8, unidadeCotada: "pc", marca: "Armacell · 8 pc × R$ 4,06" },
      { requisicaoItemId: iso58, total: 50.32, quantidadeCotada: 8, unidadeCotada: "pc", marca: "Armacell · 8 pc × R$ 6,29" },
    ],
  });

  it("recusa quando a soma não bate com o documento", () => {
    expect(() => prepararProposta(db, rascunho(1367))).toThrow(/NÃO BATE/);
  });

  it("a tela também recusa total do documento divergente", () => {
    const p = prepararProposta(db, rascunho(1332.63));
    expect(() => salvarProposta(db, { ...p.entrada, fornecedorId: p.fornecedorId!, totalDocumentoCentavos: 136700 })).toThrow(/não bate/);
  });

  it("grava e mantém R$ 1.332,63 no mapa e no pedido", () => {
    const p = prepararProposta(db, rascunho(1332.63));
    expect(p.subtotal).toBe(126503);
    const propostaId = salvarProposta(db, { ...p.entrada, fornecedorId: p.fornecedorId! });
    const mapa = obterMapa(db, reqId)!;
    expect(mapa.resumo.colunas[0].total).toBe(133263);
    marcarFornecedorVencedor(db, reqId, propostaId);
    const [pedidoId] = gerarPedidos(db, { requisicaoId: reqId });
    const pedido = obterPedido(db, pedidoId)!;
    expect(pedido.valorTotalCentavos).toBe(133263);
    expect(pedido.itens.reduce((s, i) => s + i.totalCentavos, 0)).toBe(126503);
  });

});

describe("desconto negociado depois do orçamento", () => {
  it("total final negociado vale no mapa e no pedido", () => {
    const db = abrirDb(":memory:");
    const cat = criarCategoria(db, "Elétrica X");
    const obra = salvarObra(db, { nome: "MAX 94" });
    const fio = salvarMaterial(db, { nomePadronizado: "Fio 1,5mm azul", unidade: "rl", categoriaId: cat });
    const f = salvarFornecedor(db, { nome: "Capital", categoriaIds: [cat] });
    const reqId = criarRequisicao(db, { obraId: obra, solicitante: "Cris", dataPedido: "2026-10-22", dataNecessidade: "2026-10-24", itens: [{ materialId: fio, quantidade: 8 }] });
    const item = obterRequisicao(db, reqId)!.itens[0].id;
    // Orçamento 8 × R$ 140,00 + frete 25,00 = 1.145,00; fechado por 1.100,00.
    const pid = salvarProposta(db, {
      requisicaoId: reqId,
      fornecedorId: f,
      dataCotacao: "2026-10-22",
      freteCentavos: 2500,
      totalDocumentoCentavos: 114500,
      descontoNegociadoCentavos: 4500,
      itens: [{ requisicaoItemId: item, precoUnitarioCentavos: 14000 }],
    });
    expect(obterMapa(db, reqId)!.resumo.colunas[0].total).toBe(110000);
    marcarFornecedorVencedor(db, reqId, pid);
    const pedido = obterPedido(db, gerarPedidos(db, { requisicaoId: reqId })[0])!;
    expect(pedido.valorTotalCentavos).toBe(110000);
    expect(pedido.descontoNegociadoCentavos).toBe(4500);
  });
});

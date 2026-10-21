import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { abrirDb, type DB } from "@/db/client";
import { propostas, requisicoes } from "@/db/schema";
import { criarCategoria, salvarFornecedor, salvarMaterial, salvarObra } from "@/server/dados/cadastros";
import {
  aprovarEEmitir,
  aprovarPedido,
  cancelarPedido,
  editarPedido,
  emitirPedido,
  gerarPedidos,
  obterPedido,
  registrarEntrega,
} from "@/server/dados/pedidos";
import { criarRequisicao, marcarMenoresPrecos, marcarVencedorItem, obterRequisicao, salvarProposta } from "@/server/dados/requisicoes";

let db: DB;
let reqId: number;
let itens: number[];
let fornA: number;
let fornB: number;

const idProposta = (fornecedorId: number) =>
  db.select({ id: propostas.id }).from(propostas).where(eq(propostas.fornecedorId, fornecedorId)).get()!.id;
const statusReq = () => db.select().from(requisicoes).where(eq(requisicoes.id, reqId)).get()!.status;

beforeEach(() => {
  db = abrirDb(":memory:");
  const cat = criarCategoria(db, "Cimento e argamassa");
  const obra = salvarObra(db, { nome: "Obra Teste", cnpj: "11.249.827/0002-30" });
  const cimento = salvarMaterial(db, { nomePadronizado: "Cimento CPII 50kg", unidade: "sc", categoriaId: cat, sinonimos: ["cp2"] });
  const cal = salvarMaterial(db, { nomePadronizado: "Cal CH-III 20kg", unidade: "sc", categoriaId: cat });
  fornA = salvarFornecedor(db, { nome: "Fornecedor A", categoriaIds: [cat] });
  fornB = salvarFornecedor(db, { nome: "Fornecedor B", categoriaIds: [cat] });
  reqId = criarRequisicao(db, {
    obraId: obra,
    solicitante: "Mestre",
    dataPedido: "2026-10-20",
    dataNecessidade: "2026-10-30",
    itens: [
      { materialId: cimento, quantidade: 100 },
      { materialId: cal, quantidade: 20 },
    ],
  });
  itens = obterRequisicao(db, reqId)!.itens.map((i) => i.id);
  salvarProposta(db, {
    requisicaoId: reqId,
    fornecedorId: fornA,
    dataCotacao: "2026-10-20",
    prazoEntregaDias: 2,
    descontoAVistaBp: 500,
    itens: [
      { requisicaoItemId: itens[0], precoUnitarioCentavos: 3800 },
      { requisicaoItemId: itens[1], precoUnitarioCentavos: 2000 },
    ],
  });
  salvarProposta(db, {
    requisicaoId: reqId,
    fornecedorId: fornB,
    dataCotacao: "2026-10-20",
    freteCentavos: 5000,
    prazoEntregaDias: 1,
    itens: [
      { requisicaoItemId: itens[0], precoUnitarioCentavos: 3900 },
      { requisicaoItemId: itens[1], precoUnitarioCentavos: 1700 },
    ],
  });
});

describe("fluxo de pedido", () => {
  it("exige vencedor em todos os itens", () => {
    const propA = idProposta(fornA);
    marcarVencedorItem(db, itens[0], propA); // só o primeiro item
    expect(() => gerarPedidos(db, { requisicaoId: reqId })).toThrow(/vencedor de todos/);
  });

  it("gera um pedido por fornecedor, aplica desconto à vista e numera na emissão", () => {
    marcarMenoresPrecos(db, reqId); // cimento → A, cal → B
    expect(statusReq()).toBe("aguardando_aprovacao");
    const propA = idProposta(fornA);
    const ids = gerarPedidos(db, { requisicaoId: reqId, formas: { [propA]: "avista" } });
    expect(ids).toHaveLength(2);

    const [pA, pB] = ids.map((id) => obterPedido(db, id)!);
    const a = pA.fornecedorId === fornA ? pA : pB;
    const b = pA.fornecedorId === fornA ? pB : pA;
    // 100 × 38,00 com 5% = 3.610,00
    expect(a.valorTotalCentavos).toBe(361000);
    expect(a.itens[0].precoUnitarioCentavos).toBe(3800); // preço cotado; desconto vai no total
    expect(a.descontoBp).toBe(500);
    // 20 × 17,00 + frete 50,00
    expect(b.valorTotalCentavos).toBe(34000 + 5000);
    expect(a.numero).toBeNull();
    expect(statusReq()).toBe("aguardando_aprovacao");

    // Cotação travada depois de gerar pedidos.
    expect(() => marcarMenoresPrecos(db, reqId)).toThrow(/Já existem pedidos/);

    const n1 = aprovarEEmitir(db, a.id, { aprovadoPor: "Diretoria", dataAprovacao: "2026-10-21" });
    expect(n1).toBe("PC-2026-0001");
    expect(obterPedido(db, a.id)!.prazoPrometido).toBe("2026-10-23");
    expect(statusReq()).toBe("aguardando_aprovacao"); // B ainda aguardando

    aprovarPedido(db, b.id, { aprovadoPor: "Engenharia", dataAprovacao: "2026-10-21" });
    expect(() => registrarEntrega(db, b.id, { dataReal: "2026-10-22" })).toThrow(/emitido/);
    const n2 = emitirPedido(db, b.id, { dataEmissao: "2026-10-21", prazoPrometido: "2026-10-22" });
    expect(n2).toBe("PC-2026-0002");
    expect(statusReq()).toBe("pedido_emitido");

    registrarEntrega(db, a.id, { dataReal: "2026-10-22", parcial: true });
    expect(obterPedido(db, a.id)!.status).toBe("entregue_parcial");
    expect(() => cancelarPedido(db, a.id, "teste")).toThrow(/entrega registrada/);
    registrarEntrega(db, a.id, { dataReal: "2026-10-24" });
    registrarEntrega(db, b.id, { dataReal: "2026-10-22", conforme: false, observacao: "faltou 2 sc" });
    expect(statusReq()).toBe("entregue");
  });

  it("cancelar o pedido devolve a requisição para a cotação", () => {
    marcarMenoresPrecos(db, reqId);
    const ids = gerarPedidos(db, { requisicaoId: reqId });
    for (const id of ids) cancelarPedido(db, id, "fornecedor sem estoque");
    expect(statusReq()).toBe("aguardando_aprovacao");
    expect(() => marcarMenoresPrecos(db, reqId)).not.toThrow();
  });
});

describe("corrigir dados do pedido", () => {
  it("troca o CNPJ só no pedido, sem mexer na ficha da obra", () => {
    marcarMenoresPrecos(db, reqId);
    const [id] = gerarPedidos(db, { requisicaoId: reqId });
    aprovarEEmitir(db, id, { aprovadoPor: "Diretoria", dataAprovacao: "2026-10-21" });
    editarPedido(db, id, { fatCnpj: "11.249.827/0001-50", fatRazaoSocial: "MAX INCORPORAÇÕES LTDA", prazoPrometido: "2026-10-25", condicaoPagamento: "28 dias" });
    const p = obterPedido(db, id)!;
    expect(p.obraCnpj).toBe("11249827000150");
    expect(p.fichaCnpj).toBe("11249827000230");
    expect(p.prazoPrometido).toBe("2026-10-25");
    expect(p.condicaoPagamento).toBe("28 dias");
    expect(p.editadoEm).toBeTruthy();
    expect(() => editarPedido(db, id, { fatCnpj: "11.111.111/1111-11" })).toThrow(/CNPJ/);
  });
});

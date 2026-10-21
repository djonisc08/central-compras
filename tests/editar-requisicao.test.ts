import { beforeEach, describe, expect, it } from "vitest";
import { abrirDb, type DB } from "@/db/client";
import { criarCategoria, salvarFornecedor, salvarMaterial, salvarObra } from "@/server/dados/cadastros";
import { gerarPedidos } from "@/server/dados/pedidos";
import { atualizarRequisicaoCompleta, prepararRequisicao } from "@/server/dados/requisicao-completa";
import { criarRequisicao, listarPropostas, marcarMenoresPrecos, obterRequisicao, salvarProposta } from "@/server/dados/requisicoes";

let db: DB;
let reqId: number;
let obra: number;
let cimento: number;
let cal: number;
let areia: number;

const base = { obra: 0, solicitante: "Luana", dataPedido: "2026-10-20", dataNecessidade: "2026-10-30", urgente: false };
const editar = (itens: Parameters<typeof prepararRequisicao>[1]["itens"]) =>
  atualizarRequisicaoCompleta(db, reqId, prepararRequisicao(db, { ...base, obra, itens }));

beforeEach(() => {
  db = abrirDb(":memory:");
  const cat = criarCategoria(db, "Básicos");
  obra = salvarObra(db, { nome: "MAX Studios 189" });
  cimento = salvarMaterial(db, { nomePadronizado: "Cimento CPII 50kg", unidade: "sc", categoriaId: cat });
  cal = salvarMaterial(db, { nomePadronizado: "Cal CH-III 20kg", unidade: "sc", categoriaId: cat });
  areia = salvarMaterial(db, { nomePadronizado: "Areia média", unidade: "m3", categoriaId: cat });
  const forn = salvarFornecedor(db, { nome: "Fornecedor A", categoriaIds: [cat] });
  reqId = criarRequisicao(db, {
    obraId: obra,
    solicitante: "Luana",
    dataPedido: "2026-10-20",
    dataNecessidade: "2026-10-30",
    itens: [
      { materialId: cimento, quantidade: 10 },
      { materialId: cal, quantidade: 5 },
    ],
  });
  const [i1, i2] = obterRequisicao(db, reqId)!.itens.map((i) => i.id);
  salvarProposta(db, {
    requisicaoId: reqId,
    fornecedorId: forn,
    dataCotacao: "2026-10-20",
    itens: [
      { requisicaoItemId: i1, precoUnitarioCentavos: 3800 },
      { requisicaoItemId: i2, precoUnitarioCentavos: 2000 },
    ],
  });
});

describe("editar requisição antes dos pedidos", () => {
  it("altera quantidade, remove item, adiciona item e material novo — mantendo os preços do que ficou", () => {
    const [i1] = obterRequisicao(db, reqId)!.itens;
    const r = editar([
      { id: i1.id, materialId: cimento, quantidade: 12 },
      { materialId: areia, quantidade: 3 },
      { novoMaterial: { nome: "Chumbador parabolt 10mm", unidade: "un", categoria: "Básicos" }, quantidade: 100, textoOriginal: "100 parabolt 10" },
    ]);
    expect(r.removidos).toBe(1);
    expect(r.novos).toHaveLength(1);
    const itens = obterRequisicao(db, reqId)!.itens;
    expect(itens.map((i) => [i.material, i.quantidade])).toEqual([
      ["Cimento CPII 50kg", 12],
      ["Areia média", 3],
      ["Chumbador parabolt 10mm", 100],
    ]);
    const precos = listarPropostas(db, reqId)[0].itens;
    expect(precos.map((p) => p.requisicaoItemId)).toEqual([i1.id]); // cal saiu, cimento manteve o preço
  });

  it("bloqueia depois que os pedidos foram gerados", () => {
    marcarMenoresPrecos(db, reqId);
    gerarPedidos(db, { requisicaoId: reqId });
    expect(() => editar([{ materialId: cimento, quantidade: 1 }])).toThrow(/pedidos/);
  });
});

describe("fechar cotação com itens sem fornecedor", () => {
  it("gera o pedido do que fechou e manda o resto para uma requisição de saldo", async () => {
    const { fecharCotacao } = await import("@/server/dados/pedidos");
    const [i1, i2] = obterRequisicao(db, reqId)!.itens;
    // Fornecedor só tem o cimento: tira o preço da cal deixando-a sem vencedor.
    const prop = listarPropostas(db, reqId)[0];
    salvarProposta(db, {
      requisicaoId: reqId,
      fornecedorId: prop.fornecedorId,
      dataCotacao: "2026-10-20",
      itens: [
        { requisicaoItemId: i1.id, precoUnitarioCentavos: 3800 },
        { requisicaoItemId: i2.id, precoUnitarioCentavos: 0, disponivel: false },
      ],
    });
    marcarMenoresPrecos(db, reqId);
    const r = fecharCotacao(db, { requisicaoId: reqId, separarSaldo: true });
    expect(r.pedidos).toHaveLength(1);
    expect(r.saldoId).toBeTruthy();
    expect(obterRequisicao(db, reqId)!.itens.map((i) => i.material)).toEqual(["Cimento CPII 50kg"]);
    const saldo = obterRequisicao(db, r.saldoId!)!;
    expect(saldo.itens.map((i) => i.material)).toEqual(["Cal CH-III 20kg"]);
    expect(saldo.status).toBe("aberta");
    expect(saldo.observacoes).toMatch(/Saldo da requisição/);
  });
});

describe("material novo que já existe no catálogo", () => {
  it("usa o cadastro existente em vez de travar", async () => {
    const { gravarRequisicao } = await import("@/server/dados/requisicao-completa");
    const p = prepararRequisicao(db, {
      ...base,
      obra,
      itens: [{ novoMaterial: { nome: "cimento cpii 50kg", unidade: "sc", categoria: "Básicos" }, quantidade: 3, textoOriginal: "3 saco cimento" }],
    });
    expect(p.avisos.join(" ")).toMatch(/já estava no catálogo/);
    const r = gravarRequisicao(db, p);
    expect(r.novos).toHaveLength(0);
    expect(obterRequisicao(db, r.id)!.itens[0].material).toBe("Cimento CPII 50kg");
  });

  it("se a requisição falhar, o material novo não fica no catálogo", async () => {
    const { gravarRequisicao } = await import("@/server/dados/requisicao-completa");
    const { listarMateriais } = await import("@/server/dados/cadastros");
    const p = prepararRequisicao(db, {
      ...base,
      obra,
      itens: [{ novoMaterial: { nome: "Fio flexível 1,5mm azul", unidade: "rl", categoria: "Básicos" }, quantidade: 1 }],
    });
    p.entrada.solicitante = ""; // força erro na gravação da requisição
    expect(() => gravarRequisicao(db, p)).toThrow();
    expect(listarMateriais(db).some((m) => m.nomePadronizado === "Fio flexível 1,5mm azul")).toBe(false);
  });
});

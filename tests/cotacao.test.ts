import { describe, expect, it } from "vitest";
import { abrirDb } from "@/db/client";
import { criarCategoria, salvarFornecedor, salvarMaterial, salvarObra } from "@/server/dados/cadastros";
import { acompanhamentoCotacao, itensParaFornecedor, registrarEnvio } from "@/server/dados/cotacao";
import { criarRequisicao } from "@/server/dados/requisicoes";

describe("cotação por lote", () => {
  const db = abrirDb(":memory:");
  const refrig = criarCategoria(db, "Refrigeração Teste");
  const basicos = criarCategoria(db, "Básicos Teste");
  const obra = salvarObra(db, { nome: "MAX Studios 189" });
  const cobre = salvarMaterial(db, { nomePadronizado: "Tubo cobre 5/8", unidade: "m", categoriaId: refrig });
  const cimento = salvarMaterial(db, { nomePadronizado: "Cimento CPII 50kg", unidade: "sc", categoriaId: basicos });
  const frigelar = salvarFornecedor(db, { nome: "Frigelar", categoriaIds: [refrig] });
  const cassol = salvarFornecedor(db, { nome: "Cassol", categoriaIds: [basicos] });
  const reqId = criarRequisicao(db, {
    obraId: obra,
    solicitante: "Luana",
    dataPedido: "2026-10-21",
    dataNecessidade: "2026-10-22",
    itens: [
      { materialId: cobre, quantidade: 15 },
      { materialId: cimento, quantidade: 20 },
    ],
  });

  it("cada fornecedor recebe só os itens da categoria dele", () => {
    expect(itensParaFornecedor(db, reqId, frigelar).map((i) => i.material)).toEqual(["Tubo cobre 5/8"]);
    expect(itensParaFornecedor(db, reqId, cassol).map((i) => i.material)).toEqual(["Cimento CPII 50kg"]);
  });

  it("só os itens escolhidos na tela, quando houver", () => {
    const [, cim] = itensParaFornecedor(db, reqId, null);
    expect(itensParaFornecedor(db, reqId, frigelar, [cim.id]).map((i) => i.material)).toEqual(["Cimento CPII 50kg"]);
  });

  it("acompanha o envio por fornecedor", () => {
    registrarEnvio(db, reqId, frigelar, 1);
    const lista = acompanhamentoCotacao(db, reqId);
    const fr = lista.find((f) => f.nome === "Frigelar")!;
    expect(fr.enviadoEm).toBeTruthy();
    expect(fr.qtdEnviada).toBe(1);
    expect(fr.respondeuEm).toBeNull();
    expect(lista.find((f) => f.nome === "Cassol")!.enviadoEm).toBeNull();
  });
});

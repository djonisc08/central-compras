import { describe, expect, it } from "vitest";
import { abrirDb } from "@/db/client";
import { criarCategoria, salvarFornecedor, salvarMaterial, salvarObra } from "@/server/dados/cadastros";
import { itensParaFornecedor, quadroCotacao, registrarEnvio } from "@/server/dados/cotacao";
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

  it("separa em lotes e registra o envio", () => {
    registrarEnvio(db, reqId, frigelar, 1);
    const q = quadroCotacao(db, reqId)!;
    expect(q.lotes.map((l) => l.categoria).sort()).toEqual(["Básicos Teste", "Refrigeração Teste"]);
    const fr = q.lotes.find((l) => l.categoria === "Refrigeração Teste")!.fornecedores[0];
    expect(fr.nome).toBe("Frigelar");
    expect(fr.enviadoEm).toBeTruthy();
    expect(fr.respondeuEm).toBeNull();
  });
});

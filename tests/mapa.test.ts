import { describe, expect, it } from "vitest";
import { atendePrazo, calcularMapa, textoSugestao, type MapaItemEntrada, type MapaPropostaEntrada } from "@/lib/mapa";

const itens: MapaItemEntrada[] = [
  { id: 1, materialId: 10, material: "Cimento", unidade: "sc", quantidade: 100, especificacao: null },
  { id: 2, materialId: 11, material: "Areia", unidade: "m³", quantidade: 10, especificacao: null },
];

function proposta(id: number, frete: number, precos: [number, number | null][], vencedoras: number[] = []): MapaPropostaEntrada {
  return {
    id,
    fornecedorId: id,
    fornecedor: `F${id}`,
    freteCentavos: frete,
    condicaoPagamento: null,
    prazoEntregaDias: 1,
    validade: null,
    dataCotacao: "2026-10-01",
    itens: precos
      .filter(([, p]) => p != null)
      .map(([itemId, p]) => ({ requisicaoItemId: itemId, precoUnitarioCentavos: p!, disponivel: true, vencedora: vencedoras.includes(itemId), marca: null })),
  };
}

describe("mapa comparativo", () => {
  it("destaca menor preço, totaliza com frete e calcula economia", () => {
    const m = calcularMapa(itens, [
      proposta(1, 0, [[1, 4000], [2, 14000]], [1, 2]),
      proposta(2, 5000, [[1, 3800], [2, 13000]]),
    ]);
    const [cimento, areia] = m.linhas;
    expect(cimento.celulas[1].ehMenor).toBe(true);
    expect(cimento.celulas[0].ehMenor).toBe(false);
    expect(m.colunas[0].total).toBe(400000 + 140000);
    expect(m.colunas[1].total).toBe(380000 + 130000 + 5000);
    // Escolheu o mais caro em tudo: economia zero.
    expect(cimento.economia).toBe(0);
    expect(m.totalEscolhido).toBe(540000);
    expect(m.melhorUnico?.propostaId).toBe(2);
    expect(areia.qtdCotacoes).toBe(2);
  });

  it("economia = (maior − escolhida) × qtd e só soma frete de quem venceu", () => {
    const m = calcularMapa(itens, [
      proposta(1, 0, [[1, 4000], [2, 14000]], [2]),
      proposta(2, 5000, [[1, 3800], [2, 13000]], [1]),
    ]);
    expect(m.linhas[0].economia).toBe((4000 - 3800) * 100);
    expect(m.linhas[1].economia).toBe(0);
    expect(m.totalEscolhido).toBe(380000 + 5000 + 140000);
    expect(m.itensComVencedor).toBe(2);
  });

  it("menor por item soma fretes envolvidos e marca proposta incompleta", () => {
    const m = calcularMapa(itens, [proposta(1, 2000, [[1, 3900], [2, null]]), proposta(2, 3000, [[1, 4000], [2, 12000]])]);
    expect(m.colunas[0].completa).toBe(false);
    expect(m.melhorUnico?.propostaId).toBe(2);
    expect(m.menorPorItem.total).toBe(390000 + 120000 + 2000 + 3000);
    expect(m.menorPorItem.fornecedores).toBe(2);
  });
});

describe("caso real: 126 vasos (19/10/2026)", () => {
  const itensVasos: MapaItemEntrada[] = [
    { id: 1, materialId: 1, material: "Vaso padrão", unidade: "un", quantidade: 123, especificacao: null },
    { id: 2, materialId: 2, material: "Vaso PCD", unidade: "un", quantidade: 3, especificacao: null },
  ];
  const p = (id: number, nome: string, frete: number, desc: number, prazo: number, precos: [number, number], cond: string): MapaPropostaEntrada => ({
    ...proposta(id, frete, [
      [1, precos[0]],
      [2, precos[1]],
    ]),
    fornecedor: nome,
    descontoAVistaBp: desc,
    prazoEntregaDias: prazo,
    condicaoPagamento: cond,
  });
  const m = calcularMapa(itensVasos, [
    p(1, "Docol", 0, 430, 90, [42534, 150214], "2x (28/56 dias)"),
    p(2, "Roca / Celite", 0, 350, 20, [45377, 77851], "3x (28/42/56 dias)"),
    p(3, "Balaroti", 27986, 0, 15, [57050, 91196], "À vista"),
  ]);

  it("bate com os totais dos orçamentos", () => {
    expect(m.colunas[0].total).toBe(5682324);
    expect(m.colunas[0].totalAVista).toBe(5437984);
    expect(m.colunas[1].total).toBe(5814924);
    expect(m.colunas[1].totalAVista).toBe(5611402);
  });

  it("Docol não chega até 10/01; Roca e Balaroti chegam", () => {
    expect(atendePrazo(90, "2026-10-19", "2027-01-10")).toBe(false);
    expect(atendePrazo(20, "2026-10-19", "2027-01-10")).toBe(true);
  });

  it("recomenda Roca à vista, como na análise manual", () => {
    const t = textoSugestao(m, "2026-10-19", "2027-01-10");
    expect(t).toContain("Fechar com Roca / Celite");
    expect(t).toContain("56.114,02");
    expect(t).toContain("Docol é mais barata");
  });
});

import { describe, expect, it } from "vitest";
import {
  calcularCostAvoidance,
  calcularLeadTime,
  calcularSaving,
  curvaABC,
  entregueNoPrazo,
  percentualUrgentes,
  pontualidade,
  variacaoPreco,
} from "@/lib/kpis";

describe("saving", () => {
  it("(anterior − novo) × quantidade", () => {
    // R$ 40,00 → R$ 38,50 em 100 sacos = R$ 150,00
    expect(calcularSaving(4000, 3850, 100)).toBe(15000);
  });
  it("negativo quando o preço sobe", () => {
    expect(calcularSaving(3850, 4000, 10)).toBe(-1500);
  });
  it("sem compra anterior não entra (null)", () => {
    expect(calcularSaving(null, 3850, 100)).toBeNull();
  });
  it("arredonda quantidade fracionada para centavos", () => {
    expect(calcularSaving(13500, 13000, 2.5)).toBe(1250);
  });
});

describe("cost avoidance", () => {
  it("(maior cotação − fechada) × quantidade", () => {
    expect(calcularCostAvoidance([3890, 4100, 3990], 3890, 50)).toBe(10500);
  });
  it("zero com uma única cotação", () => {
    expect(calcularCostAvoidance([3890], 3890, 50)).toBe(0);
  });
});

describe("prazos", () => {
  it("lead time em dias corridos", () => {
    expect(calcularLeadTime("2026-10-01", "2026-10-03")).toBe(2);
    expect(calcularLeadTime("2026-10-31", "2026-11-02")).toBe(2);
  });
  it("entrega no prazo inclui o próprio dia", () => {
    expect(entregueNoPrazo("2026-10-10", "2026-10-10")).toBe(true);
    expect(entregueNoPrazo("2026-10-11", "2026-10-10")).toBe(false);
  });
  it("pontualidade e % urgentes", () => {
    expect(pontualidade(9, 10)).toBe(0.9);
    expect(pontualidade(0, 0)).toBeNull();
    expect(percentualUrgentes(1, 20)).toBe(0.05);
  });
});

describe("variação e curva ABC", () => {
  it("variação relativa", () => {
    expect(variacaoPreco(100, 105)).toBeCloseTo(0.05);
    expect(variacaoPreco(null, 105)).toBeNull();
  });
  it("classifica A/B/C pelo gasto acumulado", () => {
    const r = curvaABC([
      { id: 1, valor: 700 },
      { id: 2, valor: 150 },
      { id: 3, valor: 100 },
      { id: 4, valor: 50 },
    ]);
    expect(r.map((x) => [x.id, x.classe])).toEqual([
      [1, "A"],
      [2, "A"],
      [3, "B"],
      [4, "C"],
    ]);
  });
});

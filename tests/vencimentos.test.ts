import { describe, expect, it } from "vitest";
import { calcularVencimentos } from "@/lib/vencimentos";

describe("vencimentos", () => {
  it("Cassol: 3 boletos com datas explícitas, virando o ano", () => {
    expect(calcularVencimentos("3x boleto (29/11, 29/12, 29/01)", "2026-10-20", 243101)).toEqual([
      { data: "2026-11-29", valor: 81033 },
      { data: "2026-12-29", valor: 81033 },
      { data: "2027-01-29", valor: 81035 },
    ]);
  });
  it("boleto 28 dias", () => {
    expect(calcularVencimentos("Boleto 28 dias", "2026-10-20", 50098)).toEqual([{ data: "2026-11-17", valor: 50098 }]);
  });
  it("3x (28/42/56 dias)", () => {
    const p = calcularVencimentos("3x (28/42/56 dias)", "2026-10-20", 100);
    expect(p.map((x) => x.data)).toEqual(["2026-11-17", "2026-12-01", "2026-12-15"]);
    expect(p.reduce((s, x) => s + x.valor, 0)).toBe(100);
  });
  it("à vista e condição desconhecida", () => {
    expect(calcularVencimentos("À vista (−3,5%)", "2026-10-20", 5611402)).toEqual([{ data: "2026-10-20", valor: 5611402 }]);
    expect(calcularVencimentos("a combinar", "2026-10-20", 10)).toEqual([{ data: null, valor: 10 }]);
  });
});

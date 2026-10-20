// Todos os valores monetários circulam como inteiros em centavos.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function formatarReais(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  return brl.format(centavos / 100);
}

export function formatarReaisCompacto(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  return brlCompacto.format(centavos / 100);
}

export function formatarNumero(n: number | null | undefined): string {
  if (n == null) return "—";
  return numero.format(n);
}

export function formatarPercentual(fracao: number | null | undefined): string {
  if (fracao == null || !Number.isFinite(fracao)) return "—";
  return pct.format(fracao);
}

/** Converte reais (número) em centavos inteiros. */
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Interpreta texto digitado em formato brasileiro ("1.234,56", "38,9", "R$ 12")
 * ou internacional ("1234.56"). Retorna centavos ou null se inválido.
 */
export function textoParaCentavos(texto: string): number | null {
  let t = texto.trim().replace(/r\$\s?/i, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return reaisParaCentavos(n);
}

/** Valor do item (quantidade × preço unitário), arredondado para centavos. */
export function totalItem(quantidade: number, precoUnitarioCentavos: number): number {
  return Math.round(quantidade * precoUnitarioCentavos);
}

export function centavosParaTextoInput(centavos: number | null | undefined): string {
  if (centavos == null) return "";
  return (centavos / 100).toFixed(2).replace(".", ",");
}

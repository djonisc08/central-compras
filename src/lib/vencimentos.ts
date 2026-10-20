// Programação de pagamento a partir da condição negociada. Puro e testável.
import { somarDias } from "./datas";

export type Parcela = { data: string | null; valor: number };

/**
 * Entende as formas mais comuns:
 *  - datas explícitas: "3x boleto (29/11, 29/12, 29/01)"
 *  - prazos em dias:   "Boleto 28 dias", "28/56 dias", "3x (28/42/56 dias)"
 *  - à vista:          "À vista", "antecipado"
 * Divide o valor em parcelas iguais (centavos que sobram vão para a última).
 */
export function calcularVencimentos(condicao: string | null | undefined, base: string, totalCentavos: number): Parcela[] {
  const c = (condicao ?? "").toLowerCase();
  const dividir = (n: number) => {
    const p = Math.floor(totalCentavos / n);
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? totalCentavos - p * (n - 1) : p));
  };

  const datas = [...c.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)].filter((m) => Number(m[2]) <= 12 && Number(m[1]) <= 31);
  if (datas.length && !/dias?/.test(c.replace(/\(.*\)/, "").replace(/\d+\/\d+/g, ""))) {
    let ano = Number(base.slice(0, 4));
    let mesAnterior = Number(base.slice(5, 7));
    const valores = dividir(datas.length);
    return datas.map((m, i) => {
      const mes = Number(m[2]);
      if (m[3]) ano = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
      else if (mes < mesAnterior) ano += 1; // virou o ano (29/12 → 29/01)
      mesAnterior = mes;
      return { data: `${ano}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`, valor: valores[i] };
    });
  }

  const dias = (c.match(/\d+(?:\s*\/\s*\d+)*(?=\s*(?:dd|dias?)\b)/)?.[0] ?? "").split("/").map((x) => Number(x.trim())).filter((n) => n > 0);
  if (dias.length) {
    const valores = dividir(dias.length);
    return dias.map((d, i) => ({ data: somarDias(base, d), valor: valores[i] }));
  }
  if (/vista|antecipad|pix|dinheiro/.test(c)) return [{ data: base, valor: totalCentavos }];
  return [{ data: null, valor: totalCentavos }];
}

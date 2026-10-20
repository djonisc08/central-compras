// Datas trafegam como texto ISO "AAAA-MM-DD" no fuso local.

export function hojeISO(agora: Date = new Date()): string {
  return paraISO(agora);
}

export function paraISO(d: Date): string {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function somarDias(iso: string, dias: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

/** Diferença em dias corridos (b − a). */
export function diasEntre(a: string, b: string): number {
  const ms = deISO(b).getTime() - deISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "out/26" */
export function formatarMes(anoMes: string): string {
  const [a, m] = anoMes.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

/** Descrição relativa para prazos: "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function prazoRelativo(iso: string, hoje: string): string {
  const d = diasEntre(hoje, iso);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d > 1) return `em ${d} dias`;
  return `há ${-d} dias`;
}

export function inicioDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function fimDoMes(iso: string): string {
  const d = deISO(inicioDoMes(iso));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return paraISO(d);
}

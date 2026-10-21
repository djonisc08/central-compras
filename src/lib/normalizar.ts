// Normalização de textos e documentos para cadastros limpos e busca por sinônimos.

/** minúsculas, sem acento, sem pontuação supérflua, espaços simples. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9.\/²³\s-]/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

export function cnpjValido(cnpj: string): boolean {
  const c = somenteDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, d, i) => s + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const d1 = calc(c.slice(0, 12), p1);
  const d2 = calc(c.slice(0, 12) + d1, p2);
  return c.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(cnpj: string | null | undefined): string {
  const c = somenteDigitos(cnpj);
  if (c.length !== 14) return cnpj ?? "";
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** Normaliza WhatsApp brasileiro para dígitos com DDI 55. */
/**
 * Número no formato do WhatsApp (55 + DDD + número). Aceita "(48) 9 9999-0000", "+55 48…", "048…" e,
 * se houver mais de um número no campo ("48 99999-0000 / 48 3333-0000"), usa o primeiro.
 * Devolve null quando não dá um número brasileiro válido.
 */
export function normalizarWhatsapp(tel: string | null | undefined): string | null {
  if (!tel) return null;
  for (const parte of tel.split(/[\/,;|]|\s+ou\s+|\s+e\s+/i)) {
    let d = somenteDigitos(parte).replace(/^0+/, "");
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    if (/^55[1-9]\d(9\d{8}|[2-8]\d{7})$/.test(d)) return d;
  }
  return null;
}

export function formatarWhatsapp(tel: string | null | undefined): string {
  const d = normalizarWhatsapp(tel) ?? "";
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return tel ?? "";
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

/** Fixo (8 dígitos depois do DDD) normalmente não tem WhatsApp. */
export function ehCelular(tel: string | null | undefined) {
  const d = normalizarWhatsapp(tel);
  return !!d && d.length === 13;
}

export function linkWhatsapp(tel: string | null | undefined, mensagem?: string): string | null {
  const d = normalizarWhatsapp(tel);
  if (!d) return null;
  const q = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${d}${q}`;
}

// ---------------------------------------------------------------------------
// Casamento de texto livre com o catálogo de materiais
// ---------------------------------------------------------------------------

export type CandidatoMaterial = {
  id: number;
  nomePadronizado: string;
  unidade: string;
  sinonimos: string[];
};

export type ResultadoBusca = {
  id: number;
  nomePadronizado: string;
  unidade: string;
  pontuacao: number; // 0 a 1
  motivo: "sinonimo_exato" | "nome_exato" | "semelhanca";
};

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "para", "p", "c", "com", "e", "em"]);

function tokens(texto: string): string[] {
  return normalizarTexto(texto)
    .split(" ")
    .filter((t) => t && !PALAVRAS_VAZIAS.has(t));
}

function semelhanca(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  let comuns = 0;
  for (const t of a) {
    if (sb.has(t)) comuns += 1;
    else if (t.length >= 3 && b.some((x) => x.startsWith(t) || t.startsWith(x))) comuns += 0.6;
  }
  return (2 * comuns) / (a.length + b.length);
}

/** Retorna os melhores candidatos do catálogo para um texto livre. */
export function buscarMateriais(
  texto: string,
  catalogo: CandidatoMaterial[],
  limite = 5,
): ResultadoBusca[] {
  const alvo = normalizarTexto(texto);
  const tAlvo = tokens(texto);
  const resultados: ResultadoBusca[] = [];

  for (const m of catalogo) {
    if (normalizarTexto(m.nomePadronizado) === alvo) {
      resultados.push({ ...pick(m), pontuacao: 1, motivo: "nome_exato" });
      continue;
    }
    if (m.sinonimos.some((s) => normalizarTexto(s) === alvo)) {
      resultados.push({ ...pick(m), pontuacao: 1, motivo: "sinonimo_exato" });
      continue;
    }
    const nomes = [m.nomePadronizado, ...m.sinonimos];
    const melhor = Math.max(...nomes.map((n) => semelhanca(tAlvo, tokens(n))));
    if (melhor > 0.25) resultados.push({ ...pick(m), pontuacao: melhor, motivo: "semelhanca" });
  }

  return resultados.sort((a, b) => b.pontuacao - a.pontuacao).slice(0, limite);
}

function pick(m: CandidatoMaterial) {
  return { id: m.id, nomePadronizado: m.nomePadronizado, unidade: m.unidade };
}

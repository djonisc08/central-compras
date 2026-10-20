// Utilitários dos scripts usados pelas skills do Claude Code.
import fs from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { mensagemErro } from "../src/lib/validacao";

export const RAIZ = process.cwd();
export const PASTA_ENTRADA = path.join(RAIZ, "entrada");
export const PASTA_RASCUNHOS = path.join(PASTA_ENTRADA, "rascunhos");
export const PASTA_PROCESSADOS = path.join(PASTA_ENTRADA, "processados");
export const PASTA_SAIDA = path.join(RAIZ, "saida");
export const URL_APP = process.env.URL_CENTRAL ?? "http://localhost:3000";

export function argumentos() {
  const args = process.argv.slice(2);
  const flags = new Map<string, string | true>();
  const posicionais: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags.set(k, v);
      else if (args[i + 1] && !args[i + 1].startsWith("--")) flags.set(k, args[++i]);
      else flags.set(k, true);
    } else posicionais.push(a);
  }
  return {
    posicionais,
    flag: (k: string) => flags.get(k),
    texto: (k: string) => {
      const v = flags.get(k);
      return typeof v === "string" ? v : undefined;
    },
    tem: (k: string) => flags.has(k),
  };
}

export function lerJson<T = unknown>(arquivo: string): T {
  const caminho = path.resolve(RAIZ, arquivo);
  if (!fs.existsSync(caminho)) falhar(`Arquivo não encontrado: ${arquivo}`);
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8")) as T;
  } catch (e) {
    falhar(`JSON inválido em ${arquivo}: ${(e as Error).message}`);
  }
}

export function salvarJson(arquivo: string, dados: unknown) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2) + "\n");
  return path.relative(RAIZ, arquivo);
}

export function falhar(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/** Executa o corpo convertendo erros de validação em mensagem legível. */
export async function rodar(fn: () => void | Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ZodError) falhar(`Dados inválidos: ${mensagemErro(e)} (campo: ${e.issues[0]?.path.join(".")})`);
    falhar((e as Error).message);
  }
}

export const reais = (centavos: number | null | undefined) =>
  centavos == null ? "—" : (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Aceita reais (número ou "1.234,56") e devolve centavos. */
export function paraCentavos(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v * 100);
  let t = String(v).trim().replace(/r\$\s?/i, "").replace(/\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Tabela simples no terminal (alinhada, sem dependências). */
export function tabela(cabecalho: string[], linhas: (string | number)[][]) {
  const todas = [cabecalho, ...linhas.map((l) => l.map(String))];
  const larg = cabecalho.map((_, i) => Math.min(48, Math.max(...todas.map((l) => String(l[i] ?? "").length))));
  const fmt = (l: (string | number)[]) =>
    l
      .map((c, i) => {
        const s = String(c ?? "");
        const cortado = s.length > larg[i] ? s.slice(0, larg[i] - 1) + "…" : s;
        return /^[-−]?R\$|^[\d.,]+%?$|^-?\d/.test(s) ? cortado.padStart(larg[i]) : cortado.padEnd(larg[i]);
      })
      .join("  ");
  console.log(fmt(cabecalho));
  console.log(larg.map((n) => "─".repeat(n)).join("  "));
  for (const l of linhas) console.log(fmt(l));
}

export function avisar(avisos: string[]) {
  if (!avisos.length) return;
  console.log("\n⚠ Atenção:");
  for (const a of new Set(avisos)) console.log(`  • ${a}`);
}

/** Move o arquivo de origem para entrada/processados com data no nome. */
export function moverParaProcessados(arquivo: string | null | undefined, hoje: string) {
  if (!arquivo) return null;
  const origem = path.resolve(RAIZ, arquivo);
  if (!fs.existsSync(origem)) return null;
  fs.mkdirSync(PASTA_PROCESSADOS, { recursive: true });
  let destino = path.join(PASTA_PROCESSADOS, `${hoje}_${path.basename(origem)}`);
  let n = 2;
  while (fs.existsSync(destino)) destino = path.join(PASTA_PROCESSADOS, `${hoje}_${n++}_${path.basename(origem)}`);
  fs.renameSync(origem, destino);
  return path.relative(RAIZ, destino);
}

export function rodapePrevia(comando: string) {
  console.log(`\n→ PRÉVIA: nada foi gravado. Para gravar, rode de novo com --confirmar:\n  ${comando} --confirmar\n`);
}

/** Trava para scripts que APAGAM o banco: exige --apagar-meus-dados quando já existe banco em uso. */
export function exigirApagarMeusDados(caminho: string) {
  if (fs.existsSync(caminho) && !process.argv.includes("--apagar-meus-dados")) {
    console.error(
      "\n⛔ Já existe um banco com os seus dados em " + caminho + ".\n" +
        "   Este comando APAGA tudo e recria do zero. Se é isso mesmo, repita com --apagar-meus-dados\n" +
        "   (um backup é feito antes). Para atualizar o sistema use só: git pull · npm install · npm run dev\n",
    );
    process.exit(1);
  }
}

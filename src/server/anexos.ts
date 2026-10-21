// Orçamentos anexados pela tela: ficam em entrada/ como "req-<id>-<data>-<nome>" até o Claude importar
// (a skill importar-orcamento move para entrada/processados).
import fs from "node:fs";
import path from "node:path";

const PASTA = path.join(process.cwd(), "entrada");
export const EXTENSOES = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xlsx", ".xls", ".csv", ".txt", ".eml"];
const LIMITE_MB = 25;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

export function listarAnexosPendentes(requisicaoId: number) {
  if (!fs.existsSync(PASTA)) return [];
  const prefixo = `req-${requisicaoId}-`;
  return fs
    .readdirSync(PASTA)
    .filter((f) => f.startsWith(prefixo))
    .map((f) => {
      const st = fs.statSync(path.join(PASTA, f));
      return { arquivo: f, nome: f.slice(prefixo.length).replace(/^\d{8}-\d{4}-/, ""), kb: Math.round(st.size / 1024), em: st.mtime.toISOString() };
    })
    .sort((a, b) => a.em.localeCompare(b.em));
}

export async function salvarAnexo(requisicaoId: number, arquivo: File) {
  const ext = path.extname(arquivo.name).toLowerCase();
  if (!EXTENSOES.includes(ext)) throw new Error(`Tipo não aceito (${ext || "sem extensão"}). Use PDF, foto, planilha ou texto.`);
  if (arquivo.size > LIMITE_MB * 1024 * 1024) throw new Error(`Arquivo maior que ${LIMITE_MB} MB`);
  fs.mkdirSync(PASTA, { recursive: true });
  const d = new Date();
  const carimbo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const nome = `req-${requisicaoId}-${carimbo}-${slug(path.basename(arquivo.name, ext))}${ext}`;
  fs.writeFileSync(path.join(PASTA, nome), Buffer.from(await arquivo.arrayBuffer()));
  return nome;
}

export function removerAnexo(requisicaoId: number, arquivo: string) {
  const nome = path.basename(arquivo);
  if (!nome.startsWith(`req-${requisicaoId}-`)) throw new Error("Arquivo não pertence a esta requisição");
  fs.rmSync(path.join(PASTA, nome), { force: true });
}

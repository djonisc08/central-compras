/**
 * Lê a planilha de cotação devolvida pelo fornecedor (gerada pelo sistema) e cria o rascunho
 * da proposta automaticamente — sem digitação.
 *
 *   npm run ler:planilha -- entrada/cotacao-125-f10.xlsx              → cria rascunho + prévia
 *   npm run ler:planilha -- entrada/cotacao-125-f10.xlsx --confirmar  → grava direto
 *   (sem fornecedor na planilha? use --fornecedor <id ou nome>)
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { getDb } from "../src/db/client";
import { argumentos, falhar, PASTA_RASCUNHOS, paraCentavos, rodapePrevia, rodar, salvarJson } from "./_comum";
import { prepararProposta, type RascunhoProposta } from "./_proposta";
import { gravar, imprimirPrevia } from "./gravar-proposta";

const { posicionais, texto, tem } = argumentos();
const arquivo = posicionais[0] ?? falhar("Informe o caminho da planilha .xlsx");

function valor(c: ExcelJS.CellValue): string | number | Date | null {
  if (c == null) return null;
  if (typeof c === "object" && !(c instanceof Date)) {
    if ("result" in c) return (c.result as string | number) ?? null;
    if ("richText" in c) return c.richText.map((t) => t.text).join("");
    if ("text" in c) return String(c.text);
    return null;
  }
  return c as string | number | Date;
}

function data(v: string | number | Date | null): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null;
}

const numero = (v: string | number | Date | null) => {
  if (v == null || v === "" || v instanceof Date) return null;
  if (typeof v === "number") return v;
  const c = paraCentavos(String(v).replace("%", ""));
  return c == null ? null : c / 100;
};

rodar(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(arquivo));
  const meta = wb.getWorksheet("_central");
  if (!meta) falhar("Esta planilha não foi gerada pela Central de Compras (falta a aba _central). Use a skill importar-orcamento para ler o orçamento manualmente.");
  const m = new Map<string, string | number>();
  meta.eachRow((r) => m.set(String(valor(r.getCell(1).value)), valor(r.getCell(2).value) as string | number));
  const requisicaoId = Number(m.get("requisicao_id"));
  const linhaItens = Number(m.get("linha_itens"));
  const linhaCond = Number(m.get("linha_condicoes"));
  const chaves = String(m.get("chaves_condicoes")).split(",");
  const ws = wb.getWorksheet("Cotação") ?? wb.worksheets[0];

  const fornecedorArg = texto("fornecedor");
  const fornecedor: RascunhoProposta["fornecedor"] = fornecedorArg
    ? /^\d+$/.test(fornecedorArg)
      ? Number(fornecedorArg)
      : fornecedorArg
    : m.get("fornecedor_id")
      ? Number(m.get("fornecedor_id"))
      : (falhar("A planilha não tem fornecedor. Informe --fornecedor <id ou nome>") as never);

  const itens: RascunhoProposta["itens"] = [];
  for (let n = 1; m.has(`item_${n}`); n++) {
    const row = ws.getRow(linhaItens + n - 1);
    const preco = numero(valor(row.getCell(6).value));
    const marca = valor(row.getCell(5).value);
    itens.push({
      requisicaoItemId: Number(m.get(`item_${n}`)),
      precoUnitario: preco ?? undefined,
      disponivel: preco != null && preco > 0,
      marca: marca ? String(marca) : undefined,
    });
  }
  const cond = Object.fromEntries(chaves.map((k, i) => [k, valor(ws.getRow(linhaCond + i).getCell(3).value)]));
  const ipi = String(cond.ipi ?? "").trim().toLowerCase();

  const rascunho: RascunhoProposta = {
    requisicaoId,
    fornecedor,
    frete: numero(cond.frete) ?? undefined,
    impostosInclusos: ipi ? ipi.startsWith("s") : undefined,
    condicaoPagamento: cond.condicao ? String(cond.condicao) : undefined,
    descontoAVistaPct: numero(cond.desconto) ?? undefined,
    prazoEntregaDias: numero(cond.prazo) ?? undefined,
    prazoObservacao: cond.base_prazo ? String(cond.base_prazo) : undefined,
    validade: data(cond.validade),
    numeroOrcamento: cond.numero ? String(cond.numero) : undefined,
    vendedor: cond.vendedor ? String(cond.vendedor) : undefined,
    arquivoOrigem: path.relative(process.cwd(), path.resolve(arquivo)),
    itens,
  };
  const destino = salvarJson(path.join(PASTA_RASCUNHOS, `proposta-req${requisicaoId}-${String(fornecedor).replace(/\W+/g, "-")}.json`), rascunho);
  console.log(`Rascunho criado: ${destino}`);

  const p = prepararProposta(getDb(), rascunho);
  imprimirPrevia(p);
  if (!tem("confirmar")) return rodapePrevia(`npm run gravar:proposta -- --arquivo ${destino}`);
  gravar(p);
});

// Geração de planilhas .xlsx com visual consistente (exceljs). Uso só no servidor/scripts.
import ExcelJS from "exceljs";

export const FORMATO_REAIS = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
export const FORMATO_NUMERO = "#,##0.###";
export const FORMATO_PCT = "0.0%";
export const FORMATO_DATA = "dd/mm/yyyy";

const COR_PRIMARIA = "FF0F4C5C";
const COR_CABECALHO_TEXTO = "FFFFFFFF";
const COR_ZEBRA = "FFF6F8FA";
export const COR_MENOR = "FFE3F4EA";
export const COR_VENCEDOR = "FFD7E9EE";

export type Coluna<T> = {
  titulo: string;
  valor: (linha: T) => string | number | Date | null | undefined;
  largura?: number;
  formato?: string;
  /** Valores em centavos são convertidos para reais. */
  centavos?: boolean;
};

export function novoWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Central de Compras";
  wb.created = new Date();
  return wb;
}

export function dataExcel(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

export function estilizarCabecalho(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: COR_CABECALHO_TEXTO }, size: 10 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_PRIMARIA } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

/** Cria uma aba de tabela simples, com cabeçalho fixo e filtro. */
export function adicionarTabela<T>(
  wb: ExcelJS.Workbook,
  nome: string,
  colunas: Coluna<T>[],
  linhas: T[],
  opcoes: { titulo?: string } = {},
) {
  const ws = wb.addWorksheet(nome.slice(0, 31));
  let inicio = 1;
  if (opcoes.titulo) {
    ws.getCell("A1").value = opcoes.titulo;
    ws.getCell("A1").font = { bold: true, size: 13 };
    inicio = 3;
  }
  const cab = ws.getRow(inicio);
  colunas.forEach((c, i) => {
    cab.getCell(i + 1).value = c.titulo;
    ws.getColumn(i + 1).width = c.largura ?? Math.max(12, c.titulo.length + 4);
  });
  estilizarCabecalho(cab);

  linhas.forEach((l, idx) => {
    const row = ws.getRow(inicio + 1 + idx);
    colunas.forEach((c, i) => {
      let v = c.valor(l);
      if (c.centavos && typeof v === "number") v = v / 100;
      const cell = row.getCell(i + 1);
      cell.value = v ?? null;
      if (c.formato) cell.numFmt = c.formato;
      else if (c.centavos) cell.numFmt = FORMATO_REAIS;
      else if (v instanceof Date) cell.numFmt = FORMATO_DATA;
    });
    if (idx % 2 === 1) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_ZEBRA } };
    row.font = { size: 10 };
  });

  ws.views = [{ state: "frozen", ySplit: inicio }];
  if (linhas.length)
    ws.autoFilter = { from: { row: inicio, column: 1 }, to: { row: inicio + linhas.length, column: colunas.length } };
  return ws;
}

export async function respostaXlsx(wb: ExcelJS.Workbook, nomeArquivo: string) {
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Montagem das planilhas exportadas. Usado pelas rotas /api/exportar e pelos scripts.
import type ExcelJS from "exceljs";
import type { DB } from "@/db/client";
import { itensParaFornecedor } from "@/server/dados/cotacao";
import { formatarData, hojeISO } from "@/lib/datas";
import { FORMULAS } from "@/lib/kpis";
import type { Indicadores } from "./dados/indicadores";
import { atendePrazo, previsaoEntrega } from "@/lib/mapa";
import {
  adicionarTabela,
  COR_MENOR,
  COR_VENCEDOR,
  dataExcel,
  estilizarCabecalho,
  FORMATO_NUMERO,
  FORMATO_PCT,
  FORMATO_REAIS,
  novoWorkbook,
} from "@/lib/excel";
import { formatarCnpj, formatarWhatsapp } from "@/lib/normalizar";
import { listarCategorias, listarFornecedores, listarMateriais, listarObras } from "./dados/cadastros";
import { obterEmpresa } from "./dados/empresa";
import { obterMapa, obterRequisicao } from "./dados/requisicoes";

export function planilhaCadastros(db: DB) {
  const wb = novoWorkbook();
  adicionarTabela(
    wb,
    "Fornecedores",
    [
      { titulo: "Código", valor: (f) => f.id, largura: 9 },
      { titulo: "Razão social / Nome", valor: (f) => f.nome, largura: 36 },
      { titulo: "CNPJ", valor: (f) => formatarCnpj(f.cnpj), largura: 20 },
      { titulo: "Contato", valor: (f) => f.contato, largura: 16 },
      { titulo: "WhatsApp", valor: (f) => formatarWhatsapp(f.whatsapp), largura: 17 },
      { titulo: "E-mail", valor: (f) => f.email, largura: 32 },
      { titulo: "Cidade", valor: (f) => f.cidade, largura: 22 },
      { titulo: "Categorias", valor: (f) => f.categorias.join("; "), largura: 48 },
      { titulo: "Ativo", valor: (f) => (f.ativo ? "Sim" : "Não"), largura: 8 },
      { titulo: "Observações", valor: (f) => f.observacoes, largura: 40 },
    ],
    listarFornecedores(db),
  );
  adicionarTabela(
    wb,
    "Materiais",
    [
      { titulo: "Código", valor: (m) => m.id, largura: 9 },
      { titulo: "Descrição padronizada", valor: (m) => m.nomePadronizado, largura: 44 },
      { titulo: "Unidade", valor: (m) => m.unidade, largura: 9 },
      { titulo: "Grupo / Categoria", valor: (m) => m.categoria, largura: 24 },
      { titulo: "Sinônimos", valor: (m) => m.sinonimos.join("; "), largura: 50 },
      { titulo: "Último preço", valor: (m) => m.ultimoPreco, centavos: true, largura: 14 },
      { titulo: "Ativo", valor: (m) => (m.ativo ? "Sim" : "Não"), largura: 8 },
    ],
    listarMateriais(db),
  );
  adicionarTabela(
    wb,
    "Obras",
    [
      { titulo: "Código", valor: (o) => o.id, largura: 9 },
      { titulo: "Obra", valor: (o) => o.nome, largura: 36 },
      { titulo: "Endereço de entrega", valor: (o) => o.endereco, largura: 50 },
      { titulo: "CEP", valor: (o) => o.cep, largura: 11 },
      { titulo: "Razão social (faturamento)", valor: (o) => o.razaoSocial, largura: 30 },
      { titulo: "CNPJ", valor: (o) => formatarCnpj(o.cnpj), largura: 20 },
      { titulo: "CNO", valor: (o) => o.cno, largura: 17 },
      { titulo: "Engenheiro responsável", valor: (o) => o.engenheiroResponsavel, largura: 24 },
      { titulo: "Status", valor: (o) => o.status, largura: 12 },
      { titulo: "Gasto total", valor: (o) => o.gastoTotal, centavos: true, largura: 16 },
    ],
    listarObras(db),
  );
  adicionarTabela(
    wb,
    "Categorias",
    [
      { titulo: "Código", valor: (c) => c.id, largura: 9 },
      { titulo: "Categoria", valor: (c) => c.nome, largura: 30 },
    ],
    listarCategorias(db),
  );
  return wb;
}

/** Mapa comparativo: itens × fornecedores, com destaques de menor preço e vencedor. */
export function planilhaMapa(db: DB, requisicaoId: number): ExcelJS.Workbook | null {
  const mapa = obterMapa(db, requisicaoId);
  if (!mapa) return null;
  const { requisicao: r, resumo } = mapa;
  const empresa = obterEmpresa(db);
  const wb = novoWorkbook();
  const ws = wb.addWorksheet("Mapa comparativo", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  ws.getCell("A1").value = `${empresa.razaoSocial} — Mapa comparativo de cotação nº ${r.id}`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A2").value = `Obra: ${r.obra}   ·   Solicitante: ${r.solicitante}   ·   Pedido: ${formatarData(r.dataPedido)}   ·   Necessidade: ${formatarData(r.dataNecessidade)}${r.urgente ? "   ·   URGENTE" : ""}${r.cnpjObra ? `   ·   Faturar: ${r.razaoSocialObra ?? ""} CNPJ ${formatarCnpj(r.cnpjObra)}${r.cnoObra ? ` CNO ${r.cnoObra}` : ""}` : ""}`;
  const hoje = hojeISO();
  ws.getCell("A2").font = { size: 10, color: { argb: "FF555555" } };

  const L = 4; // linha do cabeçalho
  const cols = resumo.colunas;
  const cab1 = ws.getRow(L);
  const cab2 = ws.getRow(L + 1);
  cab1.getCell(1).value = "Item";
  cab1.getCell(2).value = "Qtd.";
  cab1.getCell(3).value = "Un.";
  ws.mergeCells(L, 1, L + 1, 1);
  ws.mergeCells(L, 2, L + 1, 2);
  ws.mergeCells(L, 3, L + 1, 3);
  cols.forEach((c, i) => {
    const col = 4 + i * 2;
    cab1.getCell(col).value = c.proposta.fornecedor;
    ws.mergeCells(L, col, L, col + 1);
    cab2.getCell(col).value = "Unitário";
    cab2.getCell(col + 1).value = "Total";
    ws.getColumn(col).width = 13;
    ws.getColumn(col + 1).width = 14;
  });
  const colEco = 4 + cols.length * 2;
  cab1.getCell(colEco).value = "Economia";
  ws.mergeCells(L, colEco, L + 1, colEco);
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 9;
  ws.getColumn(3).width = 6;
  ws.getColumn(colEco).width = 14;
  estilizarCabecalho(cab1);
  estilizarCabecalho(cab2);
  cab1.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cab2.alignment = { horizontal: "center" };

  let linha = L + 2;
  for (const l of resumo.linhas) {
    const row = ws.getRow(linha++);
    row.getCell(1).value = l.item.especificacao ? `${l.item.material} (${l.item.especificacao})` : l.item.material;
    row.getCell(2).value = l.item.quantidade;
    row.getCell(2).numFmt = FORMATO_NUMERO;
    row.getCell(3).value = l.item.unidade;
    l.celulas.forEach((c, i) => {
      const col = 4 + i * 2;
      const u = row.getCell(col);
      const t = row.getCell(col + 1);
      if (c.preco == null) {
        u.value = "—";
        u.alignment = { horizontal: "center" };
        return;
      }
      u.value = c.preco / 100;
      t.value = (c.total ?? 0) / 100;
      u.numFmt = FORMATO_REAIS;
      t.numFmt = FORMATO_REAIS;
      const cor = c.vencedora ? COR_VENCEDOR : c.ehMenor ? COR_MENOR : null;
      if (cor) for (const cell of [u, t]) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } };
      if (c.vencedora) for (const cell of [u, t]) cell.font = { bold: true };
    });
    const eco = row.getCell(colEco);
    eco.value = l.economia / 100;
    eco.numFmt = FORMATO_REAIS;
    row.font = { size: 10, ...(row.font ?? {}) };
  }

  const rodape: [string, (c: (typeof cols)[number]) => string | number | null, boolean][] = [
    ["Subtotal", (c) => c.subtotal / 100, true],
    ["Frete", (c) => c.proposta.freteCentavos / 100, true],
    ["Total com frete", (c) => c.total / 100, true],
    ["À vista / antecipado", (c) => (c.totalAVista != null ? c.totalAVista / 100 : null), true],
    ["Desconto à vista", (c) => (c.proposta.descontoAVistaBp ? `${((c.proposta.descontoAVistaBp ?? 0) / 100).toFixed(2).replace(".", ",")}%` : "—"), false],
    ["Prazo de entrega (dias)", (c) => c.proposta.prazoEntregaDias, false],
    ["Prazo conta a partir de", (c) => c.proposta.prazoObservacao ?? "", false],
    [
      `Chega até ${formatarData(r.dataNecessidade)}?`,
      (c) => {
        const ok = atendePrazo(c.proposta.prazoEntregaDias, hoje, r.dataNecessidade);
        return ok == null ? "—" : `${ok ? "Atende" : "NÃO atende"} (~${formatarData(previsaoEntrega(c.proposta.prazoEntregaDias, hoje))})`;
      },
      false,
    ],
    ["Impostos", (c) => (c.proposta.impostosInclusos === false ? "s/ IPI" : "inclusos"), false],
    ["Nº orçamento", (c) => c.proposta.numeroOrcamento ?? "", false],
    ["Vendedor / representante", (c) => c.proposta.vendedor ?? "", false],
    ["Condição de pagamento", (c) => c.proposta.condicaoPagamento, false],
    ["Validade", (c) => formatarData(c.proposta.validade), false],
    ["Itens cotados", (c) => `${c.itensCotados}/${resumo.totalItens}`, false],
    ["Valor vencido (com frete)", (c) => (c.itensVencidos ? (c.valorVencido + c.proposta.freteCentavos) / 100 : null), true],
  ];
  linha++;
  for (const [rotulo, f, dinheiro] of rodape) {
    const row = ws.getRow(linha++);
    row.getCell(1).value = rotulo;
    row.getCell(1).font = { bold: true, size: 10 };
    cols.forEach((c, i) => {
      const col = 4 + i * 2;
      ws.mergeCells(row.number, col, row.number, col + 1);
      const cell = row.getCell(col);
      cell.value = f(c);
      cell.alignment = { horizontal: "right" };
      if (dinheiro) cell.numFmt = FORMATO_REAIS;
      if (rotulo === "Total com frete") cell.font = { bold: true };
    });
  }

  linha++;
  const resumoLinhas: [string, number | string][] = [
    ["Total escolhido (com fretes)", resumo.totalEscolhido / 100],
    ["Economia na cotação (cost avoidance)", resumo.economiaTotal / 100],
    ["Itens com vencedor", `${resumo.itensComVencedor}/${resumo.totalItens}`],
  ];
  for (const [rotulo, valor] of resumoLinhas) {
    const row = ws.getRow(linha++);
    row.getCell(1).value = rotulo;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = valor;
    if (typeof valor === "number") row.getCell(2).numFmt = FORMATO_REAIS;
    ws.mergeCells(row.number, 2, row.number, 4);
  }
  ws.getRow(linha + 1).getCell(1).value = "Legenda: verde = menor preço do item · azul/negrito = vencedor escolhido";
  ws.getRow(linha + 1).getCell(1).font = { italic: true, size: 9, color: { argb: "FF777777" } };

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: L + 1 }];

  // Aba auxiliar em formato "longo" (uma linha por cotação), boa para tabela dinâmica.
  adicionarTabela(
    wb,
    "Cotações (dados)",
    [
      { titulo: "Requisição", valor: () => r.id, largura: 11 },
      { titulo: "Obra", valor: () => r.obra, largura: 30 },
      { titulo: "Material", valor: (x) => x.material, largura: 40 },
      { titulo: "Qtd.", valor: (x) => x.qtd, formato: FORMATO_NUMERO },
      { titulo: "Un.", valor: (x) => x.un, largura: 6 },
      { titulo: "Fornecedor", valor: (x) => x.fornecedor, largura: 30 },
      { titulo: "Preço unitário", valor: (x) => x.preco, centavos: true, largura: 14 },
      { titulo: "Total", valor: (x) => x.total, centavos: true, largura: 14 },
      { titulo: "Data cotação", valor: (x) => dataExcel(x.data), largura: 13 },
      { titulo: "Menor preço", valor: (x) => (x.menor ? "Sim" : ""), largura: 11 },
      { titulo: "Vencedor", valor: (x) => (x.vencedor ? "Sim" : ""), largura: 10 },
    ],
    resumo.linhas.flatMap((l) =>
      l.celulas
        .filter((c) => c.preco != null)
        .map((c) => {
          const p = cols.find((x) => x.proposta.id === c.propostaId)!.proposta;
          return {
            material: l.item.material,
            qtd: l.item.quantidade,
            un: l.item.unidade,
            fornecedor: p.fornecedor,
            preco: c.preco,
            total: c.total,
            data: p.dataCotacao,
            menor: c.ehMenor || l.qtdCotacoes === 1,
            vencedor: c.vencedora,
          };
        }),
    ),
  );
  return wb;
}

/**
 * Planilha de cotação para o fornecedor preencher e devolver.
 * Células amarelas = preencher. A aba oculta "_central" guarda os IDs para a
 * skill importar-orcamento ler a resposta sem digitação.
 */
export async function planilhaCotacaoFornecedor(db: DB, requisicaoId: number, fornecedorId?: number | null) {
  const r = obterRequisicao(db, requisicaoId);
  if (!r) return null;
  const itens = itensParaFornecedor(db, requisicaoId, fornecedorId ?? null);
  const empresa = obterEmpresa(db);
  const fornecedor = fornecedorId ? listarFornecedores(db).find((f) => f.id === fornecedorId) : undefined;
  const wb = novoWorkbook();
  const ws = wb.addWorksheet("Cotação", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ showGridLines: false }],
  });
  const AMARELO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7D6" } } as const;
  const borda = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
  const larguras = [5, 48, 10, 6, 24, 15, 16];
  larguras.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = `${empresa.razaoSocial} — Solicitação de cotação nº ${r.id}`;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0F4C5C" } };
  const info: [string, string][] = [
    ["Fornecedor", fornecedor?.nome ?? ""],
    ["Faturar para", `${r.razaoSocialObra ?? empresa.razaoSocial}${r.cnpjObra ? ` — CNPJ ${formatarCnpj(r.cnpjObra)}` : ""}${r.cnoObra ? ` — CNO ${r.cnoObra}` : ""}`],
    ["Obra / entrega", `${r.obra} — ${r.enderecoObra ?? ""}${r.cepObra ? ` — CEP ${r.cepObra}` : ""}`],
    ["Necessidade na obra", formatarData(r.dataNecessidade) + (r.urgente ? " (URGENTE)" : "")],
    ["Contato compras", `${empresa.comprador ?? ""} · ${empresa.telefone ?? ""} · ${empresa.email ?? ""}`],
  ];
  info.forEach(([k, v], i) => {
    const row = ws.getRow(3 + i);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true, size: 10 };
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(3).value = v;
    ws.mergeCells(row.number, 3, row.number, 7);
    row.getCell(3).font = { size: 10 };
  });

  const L = 9;
  const cab = ws.getRow(L);
  ["#", "Descrição / especificação", "Qtd.", "Un.", "Marca / modelo", "Preço unit. (R$)", "Total (R$)"].forEach((t, i) => (cab.getCell(i + 1).value = t));
  estilizarCabecalho(cab);
  itens.forEach((it, n) => {
    const row = ws.getRow(L + 1 + n);
    row.getCell(1).value = n + 1;
    row.getCell(2).value = it.especificacao ? `${it.material} — ${it.especificacao}` : it.material;
    row.getCell(2).alignment = { wrapText: true, vertical: "middle" };
    row.getCell(3).value = it.quantidade;
    row.getCell(3).numFmt = FORMATO_NUMERO;
    row.getCell(4).value = it.unidade;
    for (const c of [5, 6]) {
      row.getCell(c).fill = AMARELO;
      row.getCell(c).protection = { locked: false };
    }
    row.getCell(6).numFmt = FORMATO_REAIS;
    row.getCell(7).value = { formula: `IF(F${row.number}="","",C${row.number}*F${row.number})` };
    row.getCell(7).numFmt = FORMATO_REAIS;
    for (let c = 1; c <= 7; c++) row.getCell(c).border = borda;
    row.font = { size: 10 };
  });
  const fimItens = L + itens.length;
  const tot = ws.getRow(fimItens + 1);
  tot.getCell(6).value = "Total itens";
  tot.getCell(6).font = { bold: true };
  tot.getCell(7).value = { formula: `SUM(G${L + 1}:G${fimItens})` };
  tot.getCell(7).numFmt = FORMATO_REAIS;
  tot.getCell(7).font = { bold: true };

  const condicoes = [
    ["Frete (R$) — 0 se CIF", "frete"],
    ["Preços incluem IPI? (Sim/Não)", "ipi"],
    ["Condição de pagamento", "condicao"],
    ["Desconto à vista (%)", "desconto"],
    ["Prazo de entrega (dias)", "prazo"],
    ["Prazo conta a partir de", "base_prazo"],
    ["Validade da proposta (data)", "validade"],
    ["Nº do orçamento", "numero"],
    ["Vendedor / contato", "vendedor"],
  ];
  const C0 = fimItens + 3;
  ws.getRow(C0).getCell(1).value = "Condições comerciais (preencher as células amarelas)";
  ws.getRow(C0).getCell(1).font = { bold: true, size: 11, color: { argb: "FF0F4C5C" } };
  condicoes.forEach(([rotulo], i) => {
    const row = ws.getRow(C0 + 1 + i);
    row.getCell(1).value = rotulo;
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).font = { size: 10 };
    row.getCell(3).fill = AMARELO;
    row.getCell(3).protection = { locked: false };
    ws.mergeCells(row.number, 3, row.number, 5);
    for (const c of [1, 3]) row.getCell(c).border = borda;
  });
  ws.getCell(`C${C0 + 2}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sim,Não"'] };
  ws.getCell(`C${C0 + 6}`).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ['"após o pedido,após faturamento,após liberação do crédito,após pagamento antecipado"'],
  };
  const obs = ws.getRow(C0 + condicoes.length + 2);
  obs.getCell(1).value =
    "Entrega no endereço da obra (não no escritório). Faturar exatamente com razão social, CNPJ e CNO acima. Item não atendido: deixe o preço em branco.";
  obs.getCell(1).font = { italic: true, size: 9, color: { argb: "FF666666" } };
  ws.mergeCells(obs.number, 1, obs.number, 7);
  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true });

  // Metadados para importação automática da resposta.
  const meta = wb.addWorksheet("_central", { state: "veryHidden" });
  meta.addRow(["formato", "central-compras/cotacao@1"]);
  meta.addRow(["requisicao_id", r.id]);
  meta.addRow(["fornecedor_id", fornecedor?.id ?? ""]);
  meta.addRow(["linha_itens", L + 1]);
  meta.addRow(["linha_condicoes", C0 + 1]);
  meta.addRow(["chaves_condicoes", condicoes.map((c) => c[1]).join(",")]);
  r.itens.forEach((it, n) => meta.addRow([`item_${n + 1}`, it.id]));
  return wb;
}

/** Relatório mensal para a diretoria: resumo, gastos, saving, fornecedores, preços e curva ABC. */
export function planilhaRelatorio(db: DB, ind: Indicadores) {
  const empresa = obterEmpresa(db);
  const wb = novoWorkbook();
  const ws = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 46;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 60;
  ws.getCell("A1").value = `${empresa.razaoSocial} — Relatório de compras`;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0F4C5C" } };
  ws.getCell("A2").value = `Período: ${formatarData(ind.periodo.inicio)} a ${formatarData(ind.periodo.fim)} · comparado a ${formatarData(ind.periodoAnterior.inicio)}–${formatarData(ind.periodoAnterior.fim)}`;
  ws.getCell("A2").font = { size: 10, color: { argb: "FF555555" } };
  const linhas: [string, number | string | null, string, string?][] = [
    ["Gasto (pedidos emitidos)", ind.gasto / 100, FORMULAS.gasto, FORMATO_REAIS],
    ["Pedidos emitidos", ind.qtdPedidos, ""],
    ["Saving (vs último preço pago)", ind.saving / 100, FORMULAS.saving, FORMATO_REAIS],
    ["Economia na cotação (cost avoidance)", ind.costAvoidance / 100, FORMULAS.costAvoidance, FORMATO_REAIS],
    ["Lead time médio (dias)", ind.leadTimeMedio != null ? Number(ind.leadTimeMedio.toFixed(1)) : null, FORMULAS.leadTime],
    ["% compras urgentes (meta < 5%)", ind.pctUrgentes, FORMULAS.urgentes, FORMATO_PCT],
    ["Pontualidade dos fornecedores", ind.pontualidade, FORMULAS.pontualidade, FORMATO_PCT],
    ["Entregas não conformes", ind.naoConformes, ""],
  ];
  const cab = ws.getRow(4);
  ["Indicador", "Valor", "Como é calculado"].forEach((t, i) => (cab.getCell(i + 1).value = t));
  estilizarCabecalho(cab);
  linhas.forEach(([rot, v, formula, fmt], i) => {
    const row = ws.getRow(5 + i);
    row.getCell(1).value = rot;
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).value = v;
    if (fmt) row.getCell(2).numFmt = fmt;
    row.getCell(3).value = formula;
    row.getCell(3).font = { size: 9, color: { argb: "FF666666" } };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
  });
  let l = 5 + linhas.length + 1;
  for (const [titulo, itens] of [
    ["Destaques", ind.destaques],
    ["Alertas", ind.alertas],
  ] as const) {
    ws.getRow(l).getCell(1).value = titulo;
    ws.getRow(l).getCell(1).font = { bold: true, size: 11, color: { argb: titulo === "Alertas" ? "FFB42318" : "FF0F7B4A" } };
    l++;
    for (const t of itens.length ? itens : ["—"]) {
      ws.getRow(l).getCell(1).value = `• ${t}`;
      ws.mergeCells(l, 1, l, 3);
      ws.getRow(l).getCell(1).alignment = { wrapText: true };
      l++;
    }
    l++;
  }

  adicionarTabela(wb, "Gasto por obra", [
    { titulo: "Obra", valor: (x) => x.nome, largura: 32 },
    { titulo: "Gasto", valor: (x) => x.total, centavos: true, largura: 16 },
    { titulo: "% do total", valor: (x) => (ind.gasto ? x.total / ind.gasto : 0), formato: FORMATO_PCT },
  ], ind.gastoPorObra);
  adicionarTabela(wb, "Gasto por categoria", [
    { titulo: "Categoria", valor: (x) => x.nome, largura: 28 },
    { titulo: "Gasto (itens)", valor: (x) => x.total, centavos: true, largura: 16 },
  ], ind.gastoPorCategoria);
  adicionarTabela(wb, "Fornecedores", [
    { titulo: "Fornecedor", valor: (x) => x.fornecedor, largura: 32 },
    { titulo: "Gasto", valor: (x) => x.gasto, centavos: true, largura: 16 },
    { titulo: "Pedidos", valor: (x) => x.pedidos },
    { titulo: "Pontualidade", valor: (x) => x.pontualidade, formato: FORMATO_PCT },
    { titulo: "Nota média (1–5)", valor: (x) => (x.nota != null ? Number(x.nota.toFixed(1)) : null) },
  ], ind.fornecedores);
  adicionarTabela(wb, "Saving por item", [
    { titulo: "Material", valor: (x) => x.material, largura: 40 },
    { titulo: "Obra", valor: (x) => x.obra, largura: 22 },
    { titulo: "Fornecedor", valor: (x) => x.fornecedor, largura: 28 },
    { titulo: "Qtd.", valor: (x) => x.quantidade, formato: FORMATO_NUMERO },
    { titulo: "Preço anterior", valor: (x) => x.anterior, centavos: true, largura: 14 },
    { titulo: "Preço pago", valor: (x) => x.novo, centavos: true, largura: 14 },
    { titulo: "Saving", valor: (x) => x.valor, centavos: true, largura: 14 },
  ], [...ind.savingItens].sort((a, b) => b.valor - a.valor));
  adicionarTabela(wb, "Variação de preços", [
    { titulo: "Material", valor: (x) => x.material, largura: 40 },
    { titulo: "Un.", valor: (x) => x.unidade, largura: 6 },
    { titulo: "Preço médio anterior", valor: (x) => (x.precoAnterior != null ? Math.round(x.precoAnterior) : null), centavos: true, largura: 18 },
    { titulo: "Preço médio atual", valor: (x) => Math.round(x.precoAtual), centavos: true, largura: 18 },
    { titulo: "Variação", valor: (x) => x.variacao, formato: FORMATO_PCT },
  ], ind.variacoes);
  adicionarTabela(wb, "Curva ABC", [
    { titulo: "Material", valor: (x) => x.material, largura: 40 },
    { titulo: "Gasto", valor: (x) => x.valor, centavos: true, largura: 16 },
    { titulo: "% do gasto", valor: (x) => x.participacao, formato: FORMATO_PCT },
    { titulo: "% acumulado", valor: (x) => x.acumulado, formato: FORMATO_PCT },
    { titulo: "Classe", valor: (x) => x.classe, largura: 8 },
  ], ind.abc);
  adicionarTabela(wb, "Pedidos do período", [
    { titulo: "Pedido", valor: (x) => x.numero, largura: 15 },
    { titulo: "Emissão", valor: (x) => dataExcel(x.data_emissao), largura: 12 },
    { titulo: "Obra", valor: (x) => x.obra, largura: 24 },
    { titulo: "Fornecedor", valor: (x) => x.fornecedor, largura: 30 },
    { titulo: "Urgente", valor: (x) => (x.urgente ? "Sim" : ""), largura: 9 },
    { titulo: "Valor", valor: (x) => x.valor, centavos: true, largura: 15 },
  ], ind.pedidos);
  return wb;
}

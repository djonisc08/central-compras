/**
 * Grava uma proposta de fornecedor a partir de um rascunho JSON (skill importar-orcamento).
 *
 *   npm run gravar:proposta -- --arquivo entrada/rascunhos/prop-xxx.json             → prévia
 *   npm run gravar:proposta -- --arquivo entrada/rascunhos/prop-xxx.json --confirmar → grava
 *
 * Valores em REAIS no rascunho (ex.: "precoUnitario": 453.77, "frete": 279.86, "descontoAVistaPct": 3.5).
 * Veja o formato completo em scripts/_proposta.ts (tipo RascunhoProposta).
 */
import { getDb } from "../src/db/client";
import { formatarData, hojeISO } from "../src/lib/datas";
import { totalItem } from "../src/lib/dinheiro";
import { salvarFornecedor } from "../src/server/dados/cadastros";
import { salvarProposta } from "../src/server/dados/requisicoes";
import { argumentos, avisar, falhar, lerJson, moverParaProcessados, reais, rodapePrevia, rodar, tabela, URL_APP } from "./_comum";
import { prepararProposta, type PropostaPreparada, type RascunhoProposta } from "./_proposta";

export function imprimirPrevia(p: PropostaPreparada) {
  console.log(`\nProposta de ${p.fornecedorNome} para a requisição #${p.req.id} (${p.req.obra})`);
  const e = p.entrada;
  console.log(
    [
      `Cotação: ${formatarData(e.dataCotacao)}`,
      e.numeroOrcamento && `Nº ${e.numeroOrcamento}`,
      e.vendedor && `Vendedor: ${e.vendedor}`,
      `Pagamento: ${e.condicaoPagamento ?? "—"}`,
      p.descontoAVistaBp ? `À vista: −${(p.descontoAVistaBp / 100).toLocaleString("pt-BR")}%` : null,
      `Prazo: ${e.prazoEntregaDias ?? "—"} dia(s)${e.prazoObservacao ? ` ${e.prazoObservacao}` : ""}`,
      `Validade: ${formatarData(e.validade ?? null)}`,
      e.impostosInclusos === false ? "s/ IPI" : null,
    ]
      .filter(Boolean)
      .join(" · ") + "\n",
  );
  tabela(
    ["Item", "Qtd.", "Un.", "Unitário", "Total", "Último pago", "Marca/descrição"],
    p.linhas.map((l) => [
      l.it.material,
      l.it.quantidade.toLocaleString("pt-BR"),
      l.it.unidade,
      l.disponivel ? reais(l.preco) : "não tem",
      l.disponivel ? reais(totalItem(l.it.quantidade, l.preco)) : "",
      reais(l.ultimo),
      l.marca ?? "",
    ]),
  );
  const total = p.subtotal + p.freteCentavos;
  console.log(`\nItens ${reais(p.subtotal)} + frete ${p.freteCentavos ? reais(p.freteCentavos) : "CIF"} = ${reais(total)}`);
  if (p.descontoAVistaBp) console.log(`À vista: ${reais(Math.round((p.subtotal * (10000 - p.descontoAVistaBp)) / 10000) + p.freteCentavos)}`);
  avisar(p.avisos);
}

export function gravar(p: PropostaPreparada) {
  const db = getDb();
  let fornecedorId = p.fornecedorId;
  if (!fornecedorId && p.novoFornecedor) {
    fornecedorId = salvarFornecedor(db, { ...p.novoFornecedor, ativo: true });
    console.log(`+ Fornecedor cadastrado: ${p.novoFornecedor.nome} (id ${fornecedorId})`);
  }
  const id = salvarProposta(db, { ...p.entrada, fornecedorId: fornecedorId! });
  const movido = moverParaProcessados(p.entrada.arquivoOrigem, hojeISO());
  console.log(`\n✓ Proposta gravada (id ${id}).${movido ? ` Arquivo movido para ${movido}.` : ""}`);
  console.log(`  Mapa comparativo: ${URL_APP}/requisicoes/${p.req.id}/mapa\n`);
}

// Execução direta (não quando importado por outro script).
if (process.argv[1]?.includes("gravar-proposta")) {
  const { texto, tem } = argumentos();
  const arquivo = texto("arquivo") ?? falhar("Informe --arquivo entrada/rascunhos/<nome>.json");
  rodar(() => {
    const p = prepararProposta(getDb(), lerJson<RascunhoProposta>(arquivo));
    imprimirPrevia(p);
    if (!tem("confirmar")) return rodapePrevia(`npm run gravar:proposta -- --arquivo ${arquivo}`);
    gravar(p);
  });
}

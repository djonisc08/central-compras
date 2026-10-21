/**
 * Gera o kit de cotação de uma requisição (não grava nada no banco):
 * mensagem de WhatsApp por fornecedor, link wa.me, link do PDF e planilha para preencher.
 *
 *   npm run mensagem -- --requisicao 125
 *   npm run mensagem -- --requisicao 125 --fornecedores 8,10
 *
 * Saída em saida/cotacao-<id>/ : mensagens.md + cotacao-<id>-<fornecedor>.xlsx
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/db/client";
import { formatarData } from "../src/lib/datas";
import { mensagemCotacao } from "../src/lib/mensagens";
import { formatarWhatsapp, linkWhatsapp } from "../src/lib/normalizar";
import { fornecedoresPorCategoria, listarFornecedores } from "../src/server/dados/cadastros";
import { itensDoFornecedor } from "../src/server/dados/cotacao";
import { obterEmpresa } from "../src/server/dados/empresa";
import { listarPropostas, obterRequisicao } from "../src/server/dados/requisicoes";
import { planilhaCotacaoFornecedor } from "../src/server/exportacoes";
import { argumentos, falhar, PASTA_SAIDA, rodar, URL_APP } from "./_comum";

const { texto } = argumentos();
const id = Number(texto("requisicao")) || falhar("Informe --requisicao <id>");

rodar(async () => {
  const db = getDb();
  const r = obterRequisicao(db, id) ?? falhar(`Requisição ${id} não encontrada`);
  const empresa = obterEmpresa(db);
  const escolhidos = texto("fornecedores")?.split(",").map(Number).filter(Boolean);
  const fornecedores = escolhidos?.length
    ? listarFornecedores(db).filter((f) => escolhidos.includes(f.id))
    : fornecedoresPorCategoria(db, [...new Set(r.itens.map((i) => i.categoriaId))]);
  if (!fornecedores.length) falhar("Nenhum fornecedor ativo nas categorias destes itens. Cadastre ou informe --fornecedores.");
  const jaCotaram = new Set(listarPropostas(db, id).map((p) => p.fornecedorId));

  const pasta = path.join(PASTA_SAIDA, `cotacao-${id}`);
  fs.mkdirSync(pasta, { recursive: true });
  const md: string[] = [
    `# Cotação nº ${id} — ${r.obra}`,
    "",
    `Necessidade: ${formatarData(r.dataNecessidade)}${r.urgente ? " (URGENTE)" : ""} · ${r.itens.length} itens`,
    `PDF genérico: ${URL_APP}/imprimir/cotacao/${id}`,
    "",
  ];

  console.log(`\nKit de cotação · requisição #${id} · ${r.obra}\n`);
  for (const f of fornecedores) {
    const itensDele = itensDoFornecedor(r.itens, f.categoriaIds); // só o que ele vende
    const msg = mensagemCotacao({
      requisicaoId: id,
      obra: r.obra,
      enderecoObra: r.enderecoObra,
      dataNecessidade: r.dataNecessidade,
      urgente: r.urgente,
      itens: itensDele,
      empresa: empresa.nomeFantasia ?? empresa.razaoSocial,
      comprador: empresa.comprador,
      contato: f.contato,
      faturamento: { razaoSocial: r.razaoSocialObra, cnpj: r.cnpjObra, cno: r.cnoObra, cep: r.cepObra },
    });
    const wb = await planilhaCotacaoFornecedor(db, id, f.id);
    const nomeXlsx = `cotacao-${id}-${f.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}.xlsx`;
    await wb!.xlsx.writeFile(path.join(pasta, nomeXlsx));
    const wa = linkWhatsapp(f.whatsapp, msg);
    console.log(`── ${f.nome}${jaCotaram.has(f.id) ? "  (já cotou)" : ""} · ${itensDele.length}/${r.itens.length} itens`);
    console.log(`   WhatsApp: ${f.whatsapp ? formatarWhatsapp(f.whatsapp) : "não cadastrado"}`);
    console.log(`   PDF:      ${URL_APP}/imprimir/cotacao/${id}?fornecedor=${f.id}`);
    console.log(`   Planilha: saida/cotacao-${id}/${nomeXlsx}`);
    md.push(
      `## ${f.nome}${jaCotaram.has(f.id) ? " (já cotou)" : ""}`,
      "",
      `- WhatsApp: ${wa ?? "não cadastrado"}`,
      `- PDF: ${URL_APP}/imprimir/cotacao/${id}?fornecedor=${f.id}`,
      `- Planilha: ${nomeXlsx}`,
      "",
      "```",
      msg,
      "```",
      "",
    );
  }
  fs.writeFileSync(path.join(pasta, "mensagens.md"), md.join("\n"));
  console.log(`\n✓ Mensagens e planilhas em saida/cotacao-${id}/ (abra mensagens.md para copiar os textos).\n`);
});

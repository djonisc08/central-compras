/**
 * Começa a usar o sistema VALENDO: apaga os dados de exemplo e deixa só a operação real.
 *
 *   npm run iniciar:real                                   → mostra o que será feito (nada muda)
 *   npm run iniciar:real -- --confirmar                    → faz backup e recria o banco
 *   npm run iniciar:real -- --confirmar --prazo-94 2026-10-23   (data prometida pela Cassol)
 *
 * Fica no banco:
 *   • MAX Incorporações + as 4 obras (fichas cadastrais) e o catálogo padronizado (sem histórico fictício)
 *   • Fornecedores reais: Docol, Roca/Celite, Balaroti e Cassol Center Lar (os fictícios saem)
 *   • Requisição dos 126 vasos (MAX Studio 206) com as 3 propostas de 19/10/2026
 *   • MAX 94 (Christian, 20/10 08:55): 220 blocos siporex → pedido emitido Cassol nº 31798891
 *   • MAX Studios 177 (tabela aprovada 20/10): espaçadores, arame e grampo → 2 pedidos emitidos
 *     (Leandro Carvalho Repres. R$ 500,98 · Kn Distribuidora R$ 350,00)
 *   • MAX Studios 189 (Luana, 20/10 13:04): 6 itens de fixação/perfilado, urgente, em cotação
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { CAMINHO_DB, getDb } from "../src/db/client";
import { pedidos, requisicaoItens } from "../src/db/schema";
import { diasEntre, formatarData, somarDias } from "../src/lib/datas";
import { criarCategoria, listarCategorias, salvarFornecedor } from "../src/server/dados/cadastros";
import { aprovarEEmitir, gerarPedidos } from "../src/server/dados/pedidos";
import { gravarRequisicao, prepararRequisicao, type ItemRequisicaoEntrada } from "../src/server/dados/requisicao-completa";
import { marcarMenoresPrecos, salvarProposta } from "../src/server/dados/requisicoes";
import { argumentos, exigirApagarMeusDados, falhar, reais, rodar, URL_APP } from "./_comum";
import { inserirBase, inserirCotacaoVasos } from "./_base";

const { tem, texto } = argumentos();
const DATA = "2026-10-20";
const prazo94 = texto("prazo-94") ?? somarDias(DATA, 1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo94)) falhar("Use --prazo-94 AAAA-MM-DD");

const MENSAGEM_94 = `[08:55, 20/10/2026] Christian: Para MAX STUDIOS 94 LTDA
CNPJ 51.177.326.0002-00
CNO 90.024.39139/78
* OBRA: MAX 94
* E-mail: financeiro@maxincorporacoes.com.br
* Contato com Andressa: 48 9864-0014
* Endereço para entrega
Rua Maria Eduarda, 94
Bairro Pantanal, Florianópolis SC
CEP 88040-250
Vamos precisar dos seguintes Itens👇🏼
[08:56, 20/10/2026] Christian: 220 blocos de concreto celular (siporex) 07x30x60cm`;

const MENSAGEM_177 = `[20/10/2026, 13:04:55] Luana: 1000 espaçador tipo roseta 3cm
1000 espaçador tipo centopéia 3cm
30 kg arame recozido 12
05kg grampo cerca 19x11`;

const MENSAGEM_189 = `[20/10/2026, 13:04:56] Luana: Para OBRA: MAX Studio 189
MAX INCORPORAÇÕES LTDA
CNPJ 11.249.827.0001-50
CNO 90.022.17945/71
* E-mail: financeiro@maxincorporacoes.com.br
* Contato com Andressa: 48 9864-0014
* Endereço para entrega
Rua Vereador Frederico Veras, 189
Bairro Pantanal, Florianópolis SC
Cep 88040-200
vou precisar do seguinte item👇🏼
10- Barra perfilado aço perfurada 38x19 BR 6000MM CH-Leve Inbraell
5- Barra roscada de aço inox 8MM -6 Metros cada
500- Arruela de inox 8MM
500-Porca de inox 8MM
250-Chumbador parabolt Cb jaqueta 8MM
250-Cone chumbador CBV 8MM
Obs entrega imediato`;

const SIPOREX = "Bloco de concreto celular autoclavado (Siporex) 7x30x60cm";

rodar(() => {
  const existe = fs.existsSync(CAMINHO_DB);
  console.log("\nIniciar a Central de Compras VALENDO\n");
  console.log(existe ? `• O banco atual (${path.relative(process.cwd(), CAMINHO_DB)}) será copiado para data/backups/ e recriado.` : "• Banco novo será criado.");
  console.log("• Saem: dados de exemplo (histórico fictício, fornecedores fictícios, pedidos de teste).");
  console.log("• Ficam: MAX + 4 obras, catálogo padronizado e os fornecedores reais (Docol, Roca/Celite, Balaroti, Cassol, Leandro Carvalho Repres., Kn Distribuidora).");
  console.log("• Requisições: vasos 206 (3 propostas) · MAX 94 siporex (Cassol) · MAX Studios 177 (2 pedidos aprovados) · MAX Studios 189 (6 itens, urgente).");
  console.log(`• Entrega prometida pela Cassol (MAX 94): ${formatarData(prazo94)}${texto("prazo-94") ? "" : "  ← padrão (amanhã). Ajuste com --prazo-94 AAAA-MM-DD"}`);
  if (!tem("confirmar")) {
    console.log("\n→ PRÉVIA: nada foi alterado. Para executar: npm run iniciar:real -- --confirmar\n");
    return;
  }

  if (existe) {
    exigirApagarMeusDados(CAMINHO_DB);
    const pasta = path.join(path.dirname(CAMINHO_DB), "backups");
    fs.mkdirSync(pasta, { recursive: true });
    const destino = path.join(pasta, `antes-de-iniciar-real-${Date.now()}.db`);
    fs.copyFileSync(CAMINHO_DB, destino);
    for (const suf of ["", "-wal", "-shm"]) fs.rmSync(CAMINHO_DB + suf, { force: true });
    console.log(`\n✓ Backup: ${path.relative(process.cwd(), destino)}`);
  }

  const db = getDb();
  const base = inserirBase(db);
  inserirCotacaoVasos(db, base);
  for (const c of ["Fixação", "Cobertura"]) criarCategoria(db, c);
  const cat = (nome: string) => listarCategorias(db).find((c) => c.nome === nome)!.id;

  const cassol = salvarFornecedor(db, {
    nome: "Cassol Center Lar",
    contato: "Ramon (vendedor)",
    whatsapp: "48 98482-6299",
    cidade: "Florianópolis – SC",
    observacoes: "Filial Construtor Fpolis. Pedido no sistema deles + boletos parcelados.",
    categoriaIds: ["Blocos e tijolos", "Cimento e argamassa", "Aço e ferragens", "Hidráulica", "Elétrica", "Louças e metais", "Fixação", "EPI e ferramentas"].map(cat),
  });

  // ------------------------------------------------ MAX 94 · siporex · Cassol
  const p94 = prepararRequisicao(db, {
    obra: "MAX 94",
    solicitante: "Christian",
    dataPedido: DATA,
    dataNecessidade: prazo94,
    origemTexto: MENSAGEM_94,
    itens: [
      {
        novoMaterial: { nome: SIPOREX, unidade: "un", categoria: "Blocos e tijolos" },
        quantidade: 220,
        textoOriginal: "blocos de concreto celular (siporex) 07x30x60cm",
      },
    ],
  });
  const r94 = gravarRequisicao(db, p94).id;
  const item94 = db.select().from(requisicaoItens).where(eq(requisicaoItens.requisicaoId, r94)).get()!;
  salvarProposta(db, {
    requisicaoId: r94,
    fornecedorId: cassol,
    dataCotacao: DATA,
    freteCentavos: 1,
    condicaoPagamento: "3x boleto (29/11, 29/12, 29/01)",
    prazoEntregaDias: diasEntre(DATA, prazo94),
    numeroOrcamento: "31798891",
    vendedor: "Ramon (48) 98482-6299",
    observacoes:
      "Pedido Cassol 31798891 (filial Construtor Fpolis). Boletos: R$ 810,33 (29/11/2026) + R$ 810,33 (29/12/2026) + R$ 810,35 (29/01/2027). Bloco Celucon 30x60x7,5 cm — o pedido da obra pedia 7 cm.",
    itens: [{ requisicaoItemId: item94.id, precoUnitarioCentavos: 1105, marca: "Celucon 30x60x7,5cm" }],
  });
  marcarMenoresPrecos(db, r94);
  const [pedido94] = gerarPedidos(db, {
    requisicaoId: r94,
    formas: {},
    observacoes: "Compra fechada direto com o vendedor (Ramon). Pedido do fornecedor nº 31798891.",
  });
  const numero94 = aprovarEEmitir(db, pedido94, { aprovadoPor: "Compras", dataAprovacao: DATA, prazoPrometido: prazo94 });

  // ------------------------------------------------ MAX Studios 177 · tabela aprovada
  const leandro = salvarFornecedor(db, {
    nome: "Leandro Carvalho Representações",
    contato: "Juliana Carvalho",
    whatsapp: "48 99642-1767",
    cidade: "Florianópolis – SC",
    observacoes: "Representante. Boleto 28 dias.",
    categoriaIds: ["Aço e ferragens"].map(cat),
  });
  const kn = salvarFornecedor(db, {
    nome: "Kn Distribuidora",
    contato: "Luiz Fernando",
    whatsapp: "48 99168-5020",
    cidade: "Florianópolis – SC",
    observacoes: "Boleto 28 dias.",
    categoriaIds: ["Aço e ferragens", "Fixação"].map(cat),
  });
  const novo = (nome: string, unidade: string, categoria: string, quantidade: number, textoOriginal: string, sinonimos: string[] = [], especificacao?: string): ItemRequisicaoEntrada => ({
    novoMaterial: { nome, unidade, categoria, sinonimos },
    quantidade,
    textoOriginal,
    especificacao,
  });
  const p177 = prepararRequisicao(db, {
    obra: "MAX Studios 177",
    solicitante: "Luana",
    dataPedido: DATA,
    dataNecessidade: DATA,
    urgente: true,
    origemTexto: MENSAGEM_177,
    observacoes: "Itens do 1º bloco da mensagem da Luana (13:04). Obra confirmada pela tabela de cotação aprovada em 20/10 (Departamento Max Studios 177, CNPJ 11.249.827/0004-00).",
    itens: [
      novo("Espaçador plástico tipo centopeia 30mm", "mil", "Aço e ferragens", 1, "espaçador tipo centopéia 3cm", ["Centopéia Ct 30mm", "centopeia 3cm"], "Pacote com 500"),
      novo("Espaçador plástico circular (roseta) 30mm", "mil", "Aço e ferragens", 1, "espaçador tipo roseta 3cm", ["Espaçador Circular Es 30mm", "roseta 3cm"], "Pacote com 1000"),
      novo("Arame recozido 12 BWG", "kg", "Aço e ferragens", 30, "arame recozido 12", ["Arame recozido BWG 12"]),
      novo("Grampo para cerca galvanizado 1x9", "kg", "Aço e ferragens", 5, "grampo cerca 19x11", ["Grampo 1x9"]),
    ],
  });
  const r177 = gravarRequisicao(db, p177).id;
  const itens177 = db.select().from(requisicaoItens).where(eq(requisicaoItens.requisicaoId, r177)).all();
  const [centopeia, roseta, arame, grampo] = itens177;
  salvarProposta(db, {
    requisicaoId: r177,
    fornecedorId: leandro,
    dataCotacao: DATA,
    condicaoPagamento: "Boleto 28 dias",
    prazoEntregaDias: diasEntre(DATA, "2026-10-21"),
    vendedor: "Juliana Carvalho (48) 99642-1767",
    observacoes: "Tabela de cotação aprovada em 20/10/2026.",
    itens: [
      { requisicaoItemId: centopeia.id, precoUnitarioCentavos: 39611, marca: "Centopéia Ct 30mm (pacote 500)" },
      { requisicaoItemId: roseta.id, precoUnitarioCentavos: 10487, marca: "Espaçador Circular Es 30mm (pacote 1000)" },
    ],
  });
  salvarProposta(db, {
    requisicaoId: r177,
    fornecedorId: kn,
    dataCotacao: DATA,
    condicaoPagamento: "Boleto 28 dias",
    prazoEntregaDias: diasEntre(DATA, "2026-10-22"),
    prazoObservacao: "até o dia",
    vendedor: "Luiz Fernando (48) 99168-5020",
    observacoes: "Tabela de cotação aprovada em 20/10/2026.",
    itens: [
      { requisicaoItemId: arame.id, precoUnitarioCentavos: 900, marca: "Arame recozido BWG 12" },
      { requisicaoItemId: grampo.id, precoUnitarioCentavos: 1600, marca: "Grampo 1x9" },
    ],
  });
  marcarMenoresPrecos(db, r177);
  const pedidos177 = gerarPedidos(db, { requisicaoId: r177, formas: {}, observacoes: "Aprovado na tabela de cotação enviada ao financeiro (20/10/2026)." });
  const numeros177 = pedidos177.map((id) => {
    const p = db.select().from(pedidos).where(eq(pedidos.id, id)).get()!;
    return aprovarEEmitir(db, id, { aprovadoPor: "Compras", dataAprovacao: DATA, prazoPrometido: p.fornecedorId === leandro ? "2026-10-21" : "2026-10-22" });
  });

  // ------------------------------------------------ MAX Studios 189 · Luana (2º bloco)
  const p189 = prepararRequisicao(db, {
    obra: "MAX Studios 189",
    solicitante: "Luana",
    dataPedido: DATA,
    dataNecessidade: DATA,
    urgente: true,
    origemTexto: MENSAGEM_189,
    observacoes:
      "ENTREGA IMEDIATA. A mensagem veio com o CNPJ da matriz (11.249.827/0001-50) e o CNO da 189: a ficha da obra usa 11.249.827/0003-11 — confirmar o faturamento antes de fechar.",
    itens: [
      novo("Perfilado perfurado aço 38x19mm chapa leve barra 6m", "br", "Elétrica", 10, "Barra perfilado aço perfurada 38x19 BR 6000MM CH-Leve Inbraell", [], "Ref. Inbraell ou similar"),
      novo("Barra roscada aço inox 8mm 6m", "br", "Fixação", 5, "Barra roscada de aço inox 8MM -6 Metros", [], "Se não houver 6 m, consultar 3 m"),
      novo("Arruela lisa aço inox 8mm", "un", "Fixação", 500, "Arruela de inox 8MM"),
      novo("Porca sextavada aço inox 8mm", "un", "Fixação", 500, "Porca de inox 8MM"),
      novo("Chumbador parabolt CB com jaqueta 8mm", "un", "Fixação", 250, "Chumbador parabolt Cb jaqueta 8MM"),
      novo("Cone para chumbador CBV 8mm", "un", "Fixação", 250, "Cone chumbador CBV 8MM"),
    ],
  });
  const r189 = gravarRequisicao(db, p189).id;

  console.log(`✓ Banco recriado com a operação real.\n`);
  console.log(`  Vasos MAX Studio 206 ........ ${URL_APP}/requisicoes/1/mapa  (3 propostas, escolher vencedor)`);
  console.log(`  MAX 94 · 220 siporex ........ pedido ${numero94} emitido · Cassol · ${reais(243101)} · entrega ${formatarData(prazo94)}`);
  console.log(`                                ${URL_APP}/pedidos/${pedido94}`);
  console.log(`  MAX Studios 177 · 4 itens ... pedidos ${numeros177.join(" e ")} emitidos (Leandro Carvalho R$ 500,98 · Kn R$ 350,00)`);
  console.log(`                                ${URL_APP}/imprimir/financeiro/${r177}`);
  console.log(`  MAX Studios 189 · 6 itens ... ${URL_APP}/requisicoes/${r189}  (urgente, pedir cotação)\n`);
  console.log("  Próximo passo: cadastre seus fornecedores reais em Fornecedores (os de exemplo saíram).\n");
});

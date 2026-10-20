/**
 * Popula o banco com dados de exemplo realistas: obras reais da MAX Incorporações
 * (fichas cadastrais) + fornecedores de exemplo da Grande Florianópolis + a cotação
 * real de vasos sanitários de 19/10/2026.
 *
 *   npm run seed            → só popula se o banco estiver vazio
 *   npm run seed -- --reset → APAGA o banco e recria (faz backup antes)
 */
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { CAMINHO_DB, getDb } from "../src/db/client";
import * as s from "../src/db/schema";
import { hojeISO, somarDias } from "../src/lib/datas";
import { inserirBase, inserirCotacaoVasos, nomesCategorias, type Cat, type MatSeed } from "./_base";

const reset = process.argv.includes("--reset");

if (reset && fs.existsSync(CAMINHO_DB)) {
  const pasta = path.join(path.dirname(CAMINHO_DB), "backups");
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, `antes-do-seed-${Date.now()}.db`);
  fs.copyFileSync(CAMINHO_DB, destino);
  for (const suf of ["", "-wal", "-shm"]) fs.rmSync(CAMINHO_DB + suf, { force: true });
  console.log(`Backup salvo em ${destino}`);
}

const db = getDb();

const jaTem = db.select({ n: sql<number>`count(*)` }).from(s.obras).get()!.n;
if (jaTem > 0) {
  console.log("O banco já tem dados. Use `npm run seed -- --reset` para recriar do zero.");
  process.exit(0);
}

// ------------------------------------------------------------- utilidades
let semente = 20261020;
function rnd() {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => a + rnd() * (b - a);
const inteiro = (a: number, b: number) => Math.floor(entre(a, b + 1));
const sortear = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)];
const chance = (p: number) => rnd() < p;
function embaralhar<T>(lista: T[]) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

function gerarCnpj(base8: string, filial = "0001") {
  const b = base8 + filial;
  const dv = (str: string, pesos: number[]) => {
    const soma = str.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(b, p1);
  const d2 = dv(b + d1, [6, ...p1]);
  return `${b}${d1}${d2}`;
}

const HOJE = hojeISO();
const INICIO = somarDias(HOJE, -182);

const base = inserirBase(db);
const { APELIDOS, obrasAtivas, catId } = base;

// Tendência mensal de preço por categoria (aço e cobre sobem mais).
const tendencia: Record<Cat, number> = {
  "Cimento e argamassa": 0.007,
  Agregados: 0.003,
  "Aço e ferragens": 0.013,
  "Blocos e tijolos": 0.004,
  Madeiras: 0.005,
  Hidráulica: 0.004,
  Elétrica: 0.016,
  Impermeabilização: 0.005,
  "EPI e ferramentas": 0.002,
  "Louças e metais": 0.004,
};

// ------------------------------------------------------------- fornecedores
type Traco = { fator: number; atraso: number; prazo: number; frete: number; condicao: string; nota: number };
const fornecedoresSeed: {
  nome: string;
  base: string;
  contato: string;
  whatsapp: string;
  email: string;
  cidade: string;
  cats: Cat[];
  traco: Traco;
  obs?: string;
}[] = [
  {
    nome: "Casa do Construtor Continente",
    base: "11222333",
    contato: "Roberto",
    whatsapp: "5548991230011",
    email: "vendas@casaconstrutornorte.com.br",
    cidade: "São José – SC",
    cats: ["Cimento e argamassa", "Agregados", "Aço e ferragens", "Blocos e tijolos", "Madeiras", "Hidráulica", "EPI e ferramentas"],
    traco: { fator: 1.03, atraso: 0.12, prazo: 1, frete: 0, condicao: "28 dias", nota: 4.3 },
    obs: "Generalista. Entrega rápida no Pantanal; frete grátis acima de R$ 1.500.",
  },
  {
    nome: "Depósito São Jorge Materiais",
    base: "22333444",
    contato: "Marli",
    whatsapp: "5548992340022",
    email: "orcamento@depsaojorge.com.br",
    cidade: "Palhoça – SC",
    cats: ["Cimento e argamassa", "Agregados", "Blocos e tijolos"],
    traco: { fator: 0.97, atraso: 0.22, prazo: 2, frete: 9000, condicao: "28/56 dias", nota: 3.8 },
    obs: "Bom preço em cimento e bloco. Atrasa em semana de chuva.",
  },
  {
    nome: "Aço Forte Distribuidora",
    base: "33444555",
    contato: "Fábio",
    whatsapp: "5548993450033",
    email: "comercial@acoforte.com.br",
    cidade: "São José – SC",
    cats: ["Aço e ferragens"],
    traco: { fator: 0.95, atraso: 0.1, prazo: 3, frete: 18000, condicao: "30/60 dias", nota: 4.5 },
    obs: "Corta e dobra sob encomenda (prazo +3 dias).",
  },
  {
    nome: "Madeireira Pinheiral",
    base: "44555666",
    contato: "Seu Ivo",
    whatsapp: "5548994560044",
    email: "pinheiral.madeiras@gmail.com",
    cidade: "Rancho Queimado – SC",
    cats: ["Madeiras"],
    traco: { fator: 0.94, atraso: 0.3, prazo: 4, frete: 25000, condicao: "À vista (5% desc.)", nota: 3.6 },
  },
  {
    nome: "Hidroelétrica Litoral",
    base: "55666777",
    contato: "Patrícia",
    whatsapp: "5548995670055",
    email: "vendas@hidroeletricalitoral.com.br",
    cidade: "Florianópolis – SC",
    cats: ["Hidráulica", "Elétrica"],
    traco: { fator: 0.98, atraso: 0.08, prazo: 1, frete: 0, condicao: "28 dias", nota: 4.6 },
  },
  {
    nome: "Areial Rio Cubatão",
    base: "66777888",
    contato: "Deco",
    whatsapp: "5548996780066",
    email: "areialcubatao@hotmail.com",
    cidade: "Palhoça – SC",
    cats: ["Agregados"],
    traco: { fator: 0.93, atraso: 0.18, prazo: 1, frete: 0, condicao: "15 dias", nota: 4.0 },
    obs: "Preço do m³ já com frete (caminhão 6 m³).",
  },
  {
    nome: "Atacadão da Obra",
    base: "77888999",
    contato: "Leandro",
    whatsapp: "5548997890077",
    email: "corporativo@atacadaodaobra.com.br",
    cidade: "Biguaçu – SC",
    cats: ["Cimento e argamassa", "Aço e ferragens", "Hidráulica", "Elétrica", "Impermeabilização", "EPI e ferramentas"],
    traco: { fator: 1.0, atraso: 0.15, prazo: 3, frete: 15000, condicao: "30/60/90 dias", nota: 4.1 },
  },
  {
    nome: "Impercon Impermeabilizantes",
    base: "88999000",
    contato: "Gisele",
    whatsapp: "5548998900088",
    email: "gisele@impercon.com.br",
    cidade: "Florianópolis – SC",
    cats: ["Impermeabilização", "EPI e ferramentas"],
    traco: { fator: 0.96, atraso: 0.12, prazo: 3, frete: 12000, condicao: "28 dias", nota: 4.4 },
  },
];
const fornecedores = fornecedoresSeed.map((f) => {
  const id = db
    .insert(s.fornecedores)
    .values({
      nome: f.nome,
      cnpj: gerarCnpj(f.base),
      contato: f.contato,
      whatsapp: f.whatsapp,
      email: f.email,
      cidade: f.cidade,
      observacoes: f.obs ?? null,
    })
    .returning({ id: s.fornecedores.id })
    .get().id;
  db.insert(s.fornecedorCategorias).values(f.cats.map((c) => ({ fornecedorId: id, categoriaId: catId[c] }))).run();
  return { ...f, id };
});


// Cada material tem ruído próprio na tendência.
const materiais = base.materiais.map((m) => ({ ...m, desvio: entre(-0.004, 0.004) }));

function precoReferencia(m: (typeof materiais)[number], data: string) {
  const meses = (Date.parse(data) - Date.parse(INICIO)) / (30.4 * 86_400_000);
  const sazonal = 1 + 0.015 * Math.sin(meses / 1.3 + m.id);
  return m.preco * Math.pow(1 + tendencia[m.cat] + m.desvio, meses) * sazonal;
}

function arredondarQtd(m: MatSeed, q: number) {
  if (m.un === "un" && q >= 500) return Math.round(q / 100) * 100;
  if (m.un === "kg") return Math.max(5, Math.round(q / 5) * 5);
  if (m.un === "sc" || m.un === "br") return Math.max(5, Math.round(q / 5) * 5);
  return Math.max(1, Math.round(q));
}

// ------------------------------------------------------------- requisições
type Fase = "historico" | "aberta" | "cotando" | "aguardando" | "emitido";

const aprovadores = ["Diretoria", "Diretoria", "Engenharia", "Financeiro (Andressa)"];
const textosWhats = [
  "Bom dia! Preciso pra {data}: {itens}. Obra {obra}. Valeu",
  "Fulano, manda pra {obra} até {data}: {itens}",
  "{itens} — urgente, a laje é {data}!!",
];

const pedidosCriados: { id: number; emissao: string }[] = [];

function criarRequisicao(obra: (typeof obrasAtivas)[number], dataPedido: string, fase: Fase) {
  const urgente = chance(fase === "historico" ? 0.075 : 0.25);
  const dataNecessidade = urgente ? somarDias(dataPedido, inteiro(0, 1)) : somarDias(dataPedido, inteiro(3, 10));

  // Itens: uma categoria principal e, às vezes, um item de outra.
  const catPrincipal = sortear(nomesCategorias.filter((c) => c !== "Louças e metais" && (c !== "EPI e ferramentas" || chance(0.2))));
  const doCat = embaralhar(materiais.filter((m) => m.cat === catPrincipal));
  const escolhidos = doCat.slice(0, Math.min(doCat.length, inteiro(1, 4)));
  if (chance(0.3)) {
    const extra = sortear(materiais.filter((m) => m.cat !== catPrincipal && m.cat !== "Louças e metais"));
    escolhidos.push(extra);
  }

  const solicitante = sortear(obra.solicitantes);
  const itensTexto = escolhidos.map((m) => `${arredondarQtd(m, entre(...m.qtd))} ${m.un} ${sortear(m.sin)}`);
  const origemTexto =
    fase !== "historico" || chance(0.25)
      ? sortear(textosWhats)
          .replace("{data}", dataNecessidade.split("-").reverse().slice(0, 2).join("/"))
          .replace("{itens}", itensTexto.join(", "))
          .replace("{obra}", APELIDOS[obra.nome] ?? obra.nome)
      : null;

  const reqId = db
    .insert(s.requisicoes)
    .values({
      obraId: obra.id,
      solicitante,
      dataPedido,
      dataNecessidade,
      urgente,
      status: "aberta",
      origemTexto,
    })
    .returning({ id: s.requisicoes.id })
    .get().id;

  const itens = escolhidos.map((m) => {
    const quantidade = arredondarQtd(m, entre(...m.qtd));
    const id = db
      .insert(s.requisicaoItens)
      .values({
        requisicaoId: reqId,
        materialId: m.id,
        quantidade,
        especificacao: chance(0.15) ? sortear(["Entregar paletizado", "Marca Votorantim ou similar", "Com nota fiscal", "Descarregar no subsolo"]) : null,
      })
      .returning({ id: s.requisicaoItens.id })
      .get().id;
    return { id, m, quantidade };
  });

  if (fase === "aberta") return;

  // Propostas: fornecedores que atendem ao menos um item.
  const elegiveis = fornecedores.filter((f) => itens.some((i) => f.cats.includes(i.m.cat)));
  const qtdPropostas =
    fase === "cotando" ? inteiro(1, Math.min(2, elegiveis.length)) : inteiro(Math.min(2, elegiveis.length), Math.min(4, elegiveis.length));
  const participantes = embaralhar(elegiveis).slice(0, qtdPropostas);

  const diasCotacao = urgente ? 0 : inteiro(0, 2);
  const dataCotacao = somarDias(dataPedido, diasCotacao);

  const props = participantes.map((f) => {
    const prazoEntregaDias = urgente ? inteiro(0, 1) : Math.max(0, f.traco.prazo + inteiro(-1, 2));
    const precos = itens
      .filter((i) => f.cats.includes(i.m.cat))
      .map((i) => {
        const ref = precoReferencia(i.m, dataCotacao);
        const preco = Math.round(ref * f.traco.fator * entre(0.95, 1.06) * (urgente ? 1.03 : 1) * 100);
        return { item: i, preco, disponivel: !chance(0.04) };
      });
    const subtotal = precos.reduce((acc, p) => acc + p.preco * p.item.quantidade, 0);
    const frete = f.traco.frete && subtotal > 150000 && f.nome.startsWith("Casa") ? 0 : f.traco.frete;
    const propostaId = db
      .insert(s.propostas)
      .values({
        requisicaoId: reqId,
        fornecedorId: f.id,
        freteCentavos: frete,
        condicaoPagamento: f.traco.condicao,
        prazoEntregaDias,
        validade: somarDias(dataCotacao, inteiro(3, 10)),
        dataCotacao,
        arquivoOrigem: chance(0.4) ? `orcamento-${f.nome.split(" ")[0].toLowerCase()}-${reqId}.pdf` : null,
      })
      .returning({ id: s.propostas.id })
      .get().id;
    const linhas = precos.map((p) => {
      const id = db
        .insert(s.propostaItens)
        .values({
          propostaId,
          requisicaoItemId: p.item.id,
          precoUnitarioCentavos: p.preco,
          disponivel: p.disponivel,
          marca: chance(0.2) ? sortear(["Votorantim", "Gerdau", "Tigre", "Amanco", "Sil", "Cofermeta", "Vedacit"]) : null,
        })
        .returning({ id: s.propostaItens.id })
        .get().id;
      return { ...p, id };
    });
    return { f, propostaId, frete, prazoEntregaDias, linhas };
  });

  if (fase === "cotando") {
    db.update(s.requisicoes).set({ status: "cotando" }).where(sql`id = ${reqId}`).run();
    return;
  }

  // Escolha dos vencedores: em geral o menor preço; às vezes o menor prazo.
  const vencedorPorItem = new Map<number, (typeof props)[number]>();
  const priorizaPrazo = urgente && chance(0.5);
  for (const i of itens) {
    const ofertas = props
      .map((p) => ({ p, l: p.linhas.find((l) => l.item.id === i.id && l.disponivel) }))
      .filter((o): o is { p: (typeof props)[number]; l: NonNullable<typeof o.l> } => !!o.l);
    if (!ofertas.length) continue;
    ofertas.sort((a, b) =>
      priorizaPrazo ? a.p.prazoEntregaDias - b.p.prazoEntregaDias || a.l.preco - b.l.preco : a.l.preco - b.l.preco,
    );
    const esc = chance(0.88) ? ofertas[0] : ofertas[Math.min(1, ofertas.length - 1)];
    vencedorPorItem.set(i.id, esc.p);
    db.update(s.propostaItens).set({ vencedora: true }).where(sql`id = ${esc.l.id}`).run();
  }
  if (!vencedorPorItem.size) {
    db.update(s.requisicoes).set({ status: "cotando" }).where(sql`id = ${reqId}`).run();
    return;
  }

  // Um pedido por fornecedor vencedor.
  const porFornecedor = new Map<number, { p: (typeof props)[number]; itens: typeof itens }>();
  for (const i of itens) {
    const p = vencedorPorItem.get(i.id);
    if (!p) continue;
    const g = porFornecedor.get(p.propostaId) ?? { p, itens: [] };
    g.itens.push(i);
    porFornecedor.set(p.propostaId, g);
  }

  const dataEmissao = somarDias(dataCotacao, urgente ? 0 : inteiro(0, 1));
  const aprovado = fase !== "aguardando";

  for (const { p, itens: its } of porFornecedor.values()) {
    const linhas = its.map((i) => {
      const l = p.linhas.find((x) => x.item.id === i.id)!;
      return { i, preco: l.preco };
    });
    const valorItens = linhas.reduce((acc, l) => acc + Math.round(l.i.quantidade * l.preco), 0);
    const prazoPrometido = somarDias(dataEmissao, p.prazoEntregaDias);

    let status: s.StatusPedido = "aguardando_aprovacao";
    if (fase === "historico") status = "entregue";
    if (fase === "emitido") status = "emitido";

    const pedidoId = db
      .insert(s.pedidos)
      .values({
        requisicaoId: reqId,
        fornecedorId: p.f.id,
        propostaId: p.propostaId,
        valorTotalCentavos: valorItens + p.frete,
        freteCentavos: p.frete,
        condicaoPagamento: p.f.traco.condicao,
        aprovadoPor: aprovado ? sortear(aprovadores) : null,
        dataAprovacao: aprovado ? dataEmissao : null,
        dataEmissao: aprovado ? dataEmissao : null,
        prazoPrometido: aprovado ? prazoPrometido : null,
        status,
      })
      .returning({ id: s.pedidos.id })
      .get().id;
    db.insert(s.pedidoItens)
      .values(
        linhas.map((l) => ({
          pedidoId,
          requisicaoItemId: l.i.id,
          materialId: l.i.m.id,
          quantidade: l.i.quantidade,
          precoUnitarioCentavos: l.preco,
        })),
      )
      .run();
    if (aprovado) pedidosCriados.push({ id: pedidoId, emissao: dataEmissao });

    if (fase === "historico") {
      const atrasa = chance(p.f.traco.atraso);
      const dataReal = atrasa ? somarDias(prazoPrometido, inteiro(1, 4)) : somarDias(prazoPrometido, chance(0.15) ? -1 : 0);
      const conforme = !chance(0.05);
      if (chance(0.08)) {
        db.insert(s.entregas)
          .values({ pedidoId, dataReal: somarDias(dataReal, -1), conforme: true, parcial: true, observacao: "Entrega parcial: restante no dia seguinte" })
          .run();
      }
      db.insert(s.entregas)
        .values({
          pedidoId,
          dataReal: dataReal > HOJE ? HOJE : dataReal,
          conforme,
          observacao: conforme ? null : sortear(["Quantidade a menor, fornecedor repôs", "Sacos rasgados (3 un.)", "Bitola divergente em 5 barras"]),
        })
        .run();
      if (chance(0.85)) {
        const n = p.f.traco.nota;
        const nota = (d: number) => Math.max(1, Math.min(5, Math.round(n + d + entre(-0.8, 0.8))));
        db.insert(s.avaliacoesFornecedor)
          .values({
            pedidoId,
            preco: nota(p.f.traco.fator < 1 ? 0.4 : -0.3),
            prazo: nota(atrasa ? -1.5 : 0.3),
            qualidade: nota(conforme ? 0.2 : -1.5),
            atendimento: nota(0),
          })
          .run();
      }
    }
  }

  const statusReq: s.StatusRequisicao =
    fase === "historico" ? "entregue" : fase === "emitido" ? "pedido_emitido" : "aguardando_aprovacao";
  db.update(s.requisicoes).set({ status: statusReq }).where(sql`id = ${reqId}`).run();
}

db.transaction(() => {
  // Histórico: cada obra pede em média a cada ~4,5 dias úteis.
  for (const obra of obrasAtivas) {
    let d = somarDias(INICIO, inteiro(0, 3));
    while (d < somarDias(HOJE, -9)) {
      const dia = new Date(`${d}T12:00:00`).getDay();
      if (dia !== 0 && dia !== 6) criarRequisicao(obra, d, "historico");
      d = somarDias(d, inteiro(2, 7));
    }
  }

  // Situação atual (últimos dias), para o painel ter o que mostrar.
  const atuais: [number, number, Fase][] = [
    [0, -6, "emitido"],
    [1, -5, "emitido"],
    [2, -4, "emitido"],
    [3, -3, "emitido"],
    [0, -2, "aguardando"],
    [2, -1, "aguardando"],
    [1, -2, "cotando"],
    [3, -1, "cotando"],
    [0, -1, "cotando"],
    [1, 0, "aberta"],
    [2, 0, "aberta"],
    [3, 0, "aberta"],
  ];
  for (const [o, dias, fase] of atuais) criarRequisicao(obrasAtivas[o], somarDias(HOJE, dias), fase);
});

inserirCotacaoVasos(db, base);

// Numeração PC-AAAA-0001 pela ordem de emissão.
const porAno = new Map<string, number>();
for (const p of [...pedidosCriados].sort((a, b) => a.emissao.localeCompare(b.emissao) || a.id - b.id)) {
  const ano = p.emissao.slice(0, 4);
  const n = (porAno.get(ano) ?? 0) + 1;
  porAno.set(ano, n);
  db.update(s.pedidos).set({ numero: `PC-${ano}-${String(n).padStart(4, "0")}` }).where(sql`id = ${p.id}`).run();
}

const contar = (t: string) => db.get<{ n: number }>(sql.raw(`select count(*) as n from ${t}`))!.n;
console.log("Seed concluído:");
for (const t of ["obras", "fornecedores", "materiais", "requisicoes", "propostas", "pedidos", "entregas", "avaliacoes_fornecedor"])
  console.log(`  ${t.padEnd(22)} ${contar(t)}`);

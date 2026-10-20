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
import { normalizarTexto } from "../src/lib/normalizar";

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

// ------------------------------------------------------------- empresa
// Dados das fichas cadastrais da MAX Incorporações (contatos e endereços reais das obras).
db.insert(s.configEmpresa)
  .values({
    id: 1,
    razaoSocial: "MAX INCORPORAÇÕES LTDA",
    nomeFantasia: "MAX Incorporações",
    cnpj: "11249827000150",
    endereco: "R. Dr. Carlos Correa, 141 (escritório)",
    cidade: "Florianópolis – SC",
    telefone: "(48) 98448-5249",
    email: "compras@maxincorporacoes.com.br",
    comprador: "Luana Ferreira",
    rodapePedido:
      "Faturar exatamente com a razão social, CNPJ e CNO da obra indicados neste pedido. Entregar no endereço da obra (não no escritório). Mencionar o número do pedido na nota fiscal. Financeiro: financeiro@maxincorporacoes.com.br · Andressa (48) 9864-0014.",
  })
  .run();

// ------------------------------------------------------------- obras
// Como a equipe chama cada obra no WhatsApp.
const APELIDOS: Record<string, string> = {
  "MAX Studios 177": "177",
  "MAX Studios 189": "189",
  "MAX Studio 206": "206",
  "MAX 94": "94",
};

const obrasSeed = [
  {
    nome: "MAX Studios 177",
    endereco: "Rua Álvaro José Dias, 177 – Pantanal, Florianópolis/SC",
    cep: "88040-206",
    razaoSocial: "MAX INCORPORAÇÕES LTDA",
    cnpj: "11249827000400",
    cno: null,
    status: "ativa" as const,
    solicitantes: ["Mestre de obras · 177", "Engenharia · 177"],
  },
  {
    nome: "MAX Studios 189",
    endereco: "Rua Vereador Frederico Veras, 189 – Pantanal, Florianópolis/SC",
    cep: "88040-200",
    razaoSocial: "MAX INCORPORAÇÕES LTDA",
    cnpj: "11249827000311",
    cno: "90.022.17945/71",
    status: "ativa" as const,
    solicitantes: ["Mestre de obras · 189", "Engenharia · 189"],
  },
  {
    nome: "MAX Studio 206",
    endereco: "Rua Maria Eduarda, 206 – Pantanal, Florianópolis/SC",
    cep: "88040-250",
    razaoSocial: "MAX INCORPORAÇÕES LTDA",
    cnpj: "11249827000230",
    cno: "90.021.28665/76",
    status: "ativa" as const,
    solicitantes: ["Mestre de obras · 206", "Engenharia · 206"],
  },
  {
    nome: "MAX 94",
    endereco: "Rua Maria Eduarda, 94 – Pantanal, Florianópolis/SC",
    cep: "88040-250",
    razaoSocial: "MAX STUDIOS 94 LTDA",
    cnpj: "51177326000200",
    cno: "90.024.39139/78",
    status: "ativa" as const,
    solicitantes: ["Mestre de obras · 94", "Engenharia · 94"],
  },
];
const obraIds = obrasSeed.map(
  (o) =>
    db
      .insert(s.obras)
      .values({
        nome: o.nome,
        endereco: o.endereco,
        cep: o.cep,
        razaoSocial: o.razaoSocial,
        cnpj: o.cnpj,
        cno: o.cno,
        status: o.status,
      })
      .returning({ id: s.obras.id })
      .get().id,
);
const obrasAtivas = obrasSeed
  .map((o, i) => ({ ...o, id: obraIds[i] }))
  .filter((o) => o.status === "ativa");

// ------------------------------------------------------------- categorias
const nomesCategorias = [
  "Cimento e argamassa",
  "Agregados",
  "Aço e ferragens",
  "Blocos e tijolos",
  "Madeiras",
  "Hidráulica",
  "Elétrica",
  "Impermeabilização",
  "EPI e ferramentas",
  "Louças e metais",
] as const;
type Cat = (typeof nomesCategorias)[number];
const catId = Object.fromEntries(
  nomesCategorias.map((nome) => [nome, db.insert(s.categorias).values({ nome }).returning({ id: s.categorias.id }).get().id]),
) as Record<Cat, number>;

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


// Fornecedores reais da cotação de vasos (19/10/2026). Sem CNPJ/WhatsApp: complete no cadastro.
const fornecedoresLoucas = [
  { nome: "Docol", contato: "Vicentini Representação Com Ltda (rep.)", cidade: "Florianópolis – SC", obs: "Atende via representante. Prazo ~90 dias após liberação do crédito; no antecipado, conta após a quitação." },
  { nome: "Roca / Celite", contato: "ELP Representações (rep.)", cidade: "Florianópolis – SC", obs: "Linhas Celite LIKE e ACESSO. Garantia 10 anos na louça. Conferir endereço de entrega (costuma vir o do escritório)." },
  { nome: "Balaroti", contato: "Cristiano (vendedor)", cidade: "Florianópolis – SC", obs: "Loja Florianópolis. Somente à vista, sem desconto. Entrega em até 15 dias." },
].map((f) => {
  const id = db
    .insert(s.fornecedores)
    .values({ nome: f.nome, contato: f.contato, cidade: f.cidade, observacoes: f.obs })
    .returning({ id: s.fornecedores.id })
    .get().id;
  db.insert(s.fornecedorCategorias).values({ fornecedorId: id, categoriaId: catId["Louças e metais"] }).run();
  return { ...f, id };
});

// ------------------------------------------------------------- materiais
type MatSeed = { nome: string; un: string; cat: Cat; preco: number; qtd: [number, number]; sin: string[] };
const materiaisSeed: MatSeed[] = [
  { nome: "Cimento CPII-E 32 50kg", un: "sc", cat: "Cimento e argamassa", preco: 38.9, qtd: [20, 200], sin: ["CP2 50kg", "Cimento CP2", "Cimento CP II", "CPII 50kg", "cimento"] },
  { nome: "Cimento CPV-ARI 40kg", un: "sc", cat: "Cimento e argamassa", preco: 36.5, qtd: [10, 80], sin: ["CP5", "CPV ARI", "Cimento ARI"] },
  { nome: "Argamassa colante AC-II 20kg", un: "sc", cat: "Cimento e argamassa", preco: 19.9, qtd: [20, 150], sin: ["AC2", "AC-2", "Argamassa AC2", "Colante AC2"] },
  { nome: "Argamassa colante AC-III 20kg", un: "sc", cat: "Cimento e argamassa", preco: 34.9, qtd: [10, 60], sin: ["AC3", "AC-3", "Argamassa AC3"] },
  { nome: "Cal hidratada CH-III 20kg", un: "sc", cat: "Cimento e argamassa", preco: 17.5, qtd: [10, 80], sin: ["Cal", "Cal hidratada", "Cal CH3"] },
  { nome: "Areia média lavada", un: "m³", cat: "Agregados", preco: 135, qtd: [6, 24], sin: ["Areia média", "Areia lavada", "Areia"] },
  { nome: "Areia fina", un: "m³", cat: "Agregados", preco: 142, qtd: [3, 12], sin: ["Areia fina reboco"] },
  { nome: "Brita 1", un: "m³", cat: "Agregados", preco: 148, qtd: [6, 24], sin: ["Pedra 1", "Brita nº 1", "Brita n1"] },
  { nome: "Pedrisco (brita 0)", un: "m³", cat: "Agregados", preco: 152, qtd: [3, 12], sin: ["Brita 0", "Pedrisco"] },
  { nome: "Vergalhão CA-50 10,0mm barra 12m", un: "br", cat: "Aço e ferragens", preco: 58.9, qtd: [30, 300], sin: ["Ferro 3/8", "Aço 10mm", "CA50 10mm", "Ferro 10"] },
  { nome: "Vergalhão CA-50 8,0mm barra 12m", un: "br", cat: "Aço e ferragens", preco: 38.5, qtd: [30, 300], sin: ["Ferro 5/16", "Aço 8mm", "CA50 8mm", "Ferro 8"] },
  { nome: "Vergalhão CA-50 12,5mm barra 12m", un: "br", cat: "Aço e ferragens", preco: 92, qtd: [20, 200], sin: ["Ferro 1/2", "Aço 12,5mm", "CA50 12.5"] },
  { nome: "Vergalhão CA-60 5,0mm barra 12m", un: "br", cat: "Aço e ferragens", preco: 14.9, qtd: [50, 400], sin: ["Ferro 5mm", "CA60 5mm", "Aço 5mm"] },
  { nome: "Arame recozido 18 BWG", un: "kg", cat: "Aço e ferragens", preco: 18.9, qtd: [10, 60], sin: ["Arame recozido", "Arame 18"] },
  { nome: "Tela soldada Q-92 2x3m", un: "pc", cat: "Aço e ferragens", preco: 79, qtd: [10, 80], sin: ["Tela Q92", "Tela soldada"] },
  { nome: "Bloco cerâmico 14x19x29cm", un: "un", cat: "Blocos e tijolos", preco: 1.38, qtd: [1000, 8000], sin: ["Tijolo 14x19x29", "Bloco cerâmico 14", "Tijolo baiano 14"] },
  { nome: "Bloco de concreto estrutural 14x19x39cm", un: "un", cat: "Blocos e tijolos", preco: 4.2, qtd: [500, 3000], sin: ["Bloco concreto 14", "Bloco estrutural 14x19x39"] },
  { nome: "Tábua de pinus 2,5x30cm 3m", un: "pc", cat: "Madeiras", preco: 32, qtd: [20, 150], sin: ["Tábua 30", "Tábua pinus 30cm", "Tabua de 30"] },
  { nome: "Sarrafo de pinus 2,5x10cm 3m", un: "pc", cat: "Madeiras", preco: 9.9, qtd: [30, 200], sin: ["Sarrafo 10", "Sarrafo pinus"] },
  { nome: "Compensado resinado 14mm 1,10x2,20m", un: "pc", cat: "Madeiras", preco: 118, qtd: [10, 60], sin: ["Compensado 14mm", "Madeirite 14", "Chapa resinada 14"] },
  { nome: "Prego 17x27 com cabeça", un: "kg", cat: "Madeiras", preco: 19.5, qtd: [5, 40], sin: ["Prego 17x27", "Prego 17 x 27"] },
  { nome: "Tubo PVC soldável 25mm 6m", un: "br", cat: "Hidráulica", preco: 24.9, qtd: [10, 80], sin: ["Tubo 25 soldável", "Cano 3/4", "Tubo 25mm"] },
  { nome: "Tubo PVC esgoto 100mm 6m", un: "br", cat: "Hidráulica", preco: 72, qtd: [6, 40], sin: ["Tubo 100 esgoto", "Cano 4 pol", "Tubo esgoto 100"] },
  { nome: "Joelho PVC soldável 90° 25mm", un: "un", cat: "Hidráulica", preco: 1.1, qtd: [30, 200], sin: ["Joelho 25", "Joelho 90 25mm"] },
  { nome: "Cabo flexível 2,5mm² 750V rolo 100m", un: "rl", cat: "Elétrica", preco: 239, qtd: [2, 20], sin: ["Fio 2,5", "Cabo 2.5", "Fio 2,5mm"] },
  { nome: "Cabo flexível 4,0mm² 750V rolo 100m", un: "rl", cat: "Elétrica", preco: 389, qtd: [1, 10], sin: ["Fio 4mm", "Cabo 4.0", "Fio 4"] },
  { nome: "Eletroduto corrugado 25mm rolo 50m", un: "rl", cat: "Elétrica", preco: 69.9, qtd: [3, 20], sin: ["Conduíte 25", "Corrugado amarelo 25", "Eletroduto 25"] },
  { nome: "Aditivo impermeabilizante 18L", un: "bd", cat: "Impermeabilização", preco: 165, qtd: [2, 15], sin: ["Vedacit 18L", "Impermeabilizante 18 litros"] },
  { nome: "Manta asfáltica 3mm rolo 10m", un: "rl", cat: "Impermeabilização", preco: 289, qtd: [3, 30], sin: ["Manta 3mm", "Manta asfáltica"] },
  { nome: "Bacia sanitária c/ caixa acoplada 3/6L branca – padrão", un: "un", cat: "Louças e metais", preco: 450, qtd: [10, 130], sin: ["Vaso sanitário", "Vaso padrão", "Bacia acoplada", "Vaso c/ caixa acoplada"] },
  { nome: "Bacia sanitária c/ caixa acoplada PCD (acessível) branca", un: "un", cat: "Louças e metais", preco: 800, qtd: [1, 6], sin: ["Vaso PCD", "Vaso acessível", "Bacia PNE", "Vaso PNE"] },
  { nome: "Luva de raspa cano curto", un: "par", cat: "EPI e ferramentas", preco: 9.5, qtd: [20, 100], sin: ["Luva raspa", "Luva de couro"] },
];
const materiais = materiaisSeed.map((m) => {
  const id = db
    .insert(s.materiais)
    .values({ nomePadronizado: m.nome, unidade: m.un, categoriaId: catId[m.cat] })
    .returning({ id: s.materiais.id })
    .get().id;
  const vistos = new Set([normalizarTexto(m.nome)]);
  for (const texto of m.sin) {
    const n = normalizarTexto(texto);
    if (vistos.has(n)) continue;
    vistos.add(n);
    db.insert(s.materialSinonimos).values({ materialId: id, texto, textoNormalizado: n }).run();
  }
  // Cada material tem ruído próprio na tendência.
  return { ...m, id, desvio: entre(-0.004, 0.004) };
});

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

// Cotação real: 126 vasos para a MAX Studio 206 (orçamentos de 19/10/2026).
{
  const obra206 = obrasAtivas.find((o) => o.nome === "MAX Studio 206")!;
  const padrao = materiais.find((m) => m.nome.endsWith("– padrão"))!;
  const pcd = materiais.find((m) => m.nome.includes("PCD"))!;
  const reqId = db
    .insert(s.requisicoes)
    .values({
      obraId: obra206.id,
      solicitante: "Engenharia · 206",
      dataPedido: "2026-10-19",
      dataNecessidade: "2027-01-10",
      urgente: false,
      status: "cotando",
      observacoes: "Validar com a engenharia os modelos (padrão quadrado e PCD oval com furo de jato), Ecoflush 3/6 L, saída vertical, esgoto a 300 mm.",
    })
    .returning({ id: s.requisicoes.id })
    .get().id;
  const itemPadrao = db.insert(s.requisicaoItens).values({ requisicaoId: reqId, materialId: padrao.id, quantidade: 123, especificacao: "Ecoflush 3/6 L, saída vertical, esgoto 300 mm" }).returning({ id: s.requisicaoItens.id }).get().id;
  const itemPcd = db.insert(s.requisicaoItens).values({ requisicaoId: reqId, materialId: pcd.id, quantidade: 3, especificacao: "Acessível (PCD), oval com furo de jato" }).returning({ id: s.requisicaoItens.id }).get().id;
  const [docol, roca, balaroti] = fornecedoresLoucas;
  const propostasVasos = [
    { f: docol, frete: 0, cond: "2x (28/56 dias)", desc: 430, prazo: 90, base: "após liberação do crédito", ipi: false, num: "9000943669 / 9000944080", vend: "Vicentini Representação", precos: [[itemPadrao, 42534, "Docol SOL CP BACIA ACOP SV POP BR"], [itemPcd, 150214, "Docol SOL CP BACIA ACOP SV BENEFIT BR"]] },
    { f: roca, frete: 0, cond: "3x (28/42/56 dias)", desc: 350, prazo: 20, base: "após faturamento", ipi: true, num: "7158073", vend: "ELP Representações", precos: [[itemPadrao, 45377, "Celite LIKE (BACIA C/CX 3/6L+CP INST LIKE BR)"], [itemPcd, 77851, "Celite ACESSO COMF (BACIA C/CX+CP INST)"]] },
    { f: balaroti, frete: 27986, cond: "À vista", desc: 0, prazo: 15, base: "após o pedido", ipi: true, num: "241690", vend: "Cristiano", precos: [[itemPadrao, 57050, "Kit Incepa ART (bacia + caixa)"], [itemPcd, 91196, "Celite Acesso Confort + caixa e acessórios avulsos"]] },
  ] as const;
  for (const p of propostasVasos) {
    const pid = db
      .insert(s.propostas)
      .values({
        requisicaoId: reqId,
        fornecedorId: p.f.id,
        freteCentavos: p.frete,
        condicaoPagamento: p.cond,
        descontoAVistaBp: p.desc,
        prazoEntregaDias: p.prazo,
        prazoObservacao: p.base,
        impostosInclusos: p.ipi,
        numeroOrcamento: p.num,
        vendedor: p.vend,
        validade: "2026-10-29",
        dataCotacao: "2026-10-19",
        arquivoOrigem: "Cotacao_Vasos_Sanitarios.pdf",
      })
      .returning({ id: s.propostas.id })
      .get().id;
    for (const [itemId, preco, marca] of p.precos)
      db.insert(s.propostaItens).values({ propostaId: pid, requisicaoItemId: itemId, precoUnitarioCentavos: preco, marca }).run();
  }
}

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

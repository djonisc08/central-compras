// Dados REAIS da operação (empresa, obras das fichas cadastrais, catálogo padronizado,
// fornecedores e a cotação de vasos de 19/10/2026). Usado pelo seed de exemplo e pelo
// início "valendo" (scripts/iniciar-real.ts).
import type { DB } from "../src/db/client";
import * as s from "../src/db/schema";
import { normalizarTexto } from "../src/lib/normalizar";

export const nomesCategorias = [
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
export type Cat = (typeof nomesCategorias)[number];

export type MatSeed = { nome: string; un: string; cat: Cat; preco: number; qtd: [number, number]; sin: string[] };
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

export function inserirBase(db: DB) {
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

  const catId = Object.fromEntries(
    nomesCategorias.map((nome) => [nome, db.insert(s.categorias).values({ nome }).returning({ id: s.categorias.id }).get().id]),
  ) as Record<Cat, number>;

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
    return { ...m, id };
  });

  return { APELIDOS, obrasAtivas, catId, materiais, fornecedoresLoucas };
}

export type Base = ReturnType<typeof inserirBase>;

export function inserirCotacaoVasos(db: DB, { obrasAtivas, materiais, fornecedoresLoucas }: Base) {
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

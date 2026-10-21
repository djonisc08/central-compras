import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Convenções:
// - Valores em dinheiro: inteiros em centavos (sufixo _centavos).
// - Datas: texto ISO "AAAA-MM-DD"; carimbos de criação em "AAAA-MM-DD HH:MM:SS".
// - Booleanos: integer 0/1 (mode "boolean").

const criadoEm = () =>
  text("criado_em").notNull().default(sql`(datetime('now', 'localtime'))`);

export const STATUS_OBRA = ["ativa", "planejada", "concluida"] as const;

export const STATUS_REQUISICAO = [
  "aberta",
  "cotando",
  "aguardando_aprovacao",
  "aprovada",
  "pedido_emitido",
  "entregue",
  "cancelada",
] as const;

export const STATUS_PEDIDO = [
  "aguardando_aprovacao",
  "aprovado",
  "emitido",
  "entregue_parcial",
  "entregue",
  "cancelado",
] as const;

export const UNIDADES = [
  "un",
  "sc",
  "kg",
  "t",
  "m",
  "m²",
  "m³",
  "br",
  "cx",
  "pc",
  "l",
  "gl",
  "lt",
  "rl",
  "pct",
  "cj",
  "mil",
  "par",
  "bd",
] as const;

export const obras = sqliteTable("obras", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull().unique(),
  endereco: text("endereco"), // endereço de entrega
  cep: text("cep"),
  engenheiroResponsavel: text("engenheiro_responsavel"),
  status: text("status", { enum: STATUS_OBRA }).notNull().default("ativa"),
  // Dados de faturamento da obra (cada obra pode ter CNPJ/SPE próprio).
  razaoSocial: text("razao_social"),
  cnpj: text("cnpj"), // somente dígitos
  cno: text("cno"), // Cadastro Nacional de Obras
  criadoEm: criadoEm(),
});

export const categorias = sqliteTable("categorias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull().unique(),
});

export const fornecedores = sqliteTable("fornecedores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  cnpj: text("cnpj").unique(), // somente dígitos
  contato: text("contato"),
  whatsapp: text("whatsapp"), // somente dígitos com DDI, ex.: 5547999990000
  email: text("email"),
  cidade: text("cidade"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  observacoes: text("observacoes"),
  criadoEm: criadoEm(),
});

export const fornecedorCategorias = sqliteTable(
  "fornecedor_categorias",
  {
    fornecedorId: integer("fornecedor_id")
      .notNull()
      .references(() => fornecedores.id, { onDelete: "cascade" }),
    categoriaId: integer("categoria_id")
      .notNull()
      .references(() => categorias.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fornecedorId, t.categoriaId] })],
);

export const materiais = sqliteTable("materiais", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nomePadronizado: text("nome_padronizado").notNull().unique(),
  unidade: text("unidade").notNull(),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => categorias.id),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: criadoEm(),
});

export const materialSinonimos = sqliteTable(
  "material_sinonimos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    materialId: integer("material_id")
      .notNull()
      .references(() => materiais.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    textoNormalizado: text("texto_normalizado").notNull().unique(),
  },
  (t) => [index("sinonimos_material_idx").on(t.materialId)],
);

export const requisicoes = sqliteTable(
  "requisicoes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    obraId: integer("obra_id")
      .notNull()
      .references(() => obras.id),
    solicitante: text("solicitante").notNull(),
    dataPedido: text("data_pedido").notNull(),
    dataNecessidade: text("data_necessidade").notNull(),
    urgente: integer("urgente", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: STATUS_REQUISICAO }).notNull().default("aberta"),
    origemTexto: text("origem_texto"),
    observacoes: text("observacoes"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("requisicoes_status_idx").on(t.status),
    index("requisicoes_obra_idx").on(t.obraId),
  ],
);

export const requisicaoItens = sqliteTable(
  "requisicao_itens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requisicaoId: integer("requisicao_id")
      .notNull()
      .references(() => requisicoes.id, { onDelete: "cascade" }),
    materialId: integer("material_id")
      .notNull()
      .references(() => materiais.id),
    quantidade: real("quantidade").notNull(),
    especificacao: text("especificacao"),
  },
  (t) => [index("req_itens_req_idx").on(t.requisicaoId)],
);

export const propostas = sqliteTable(
  "propostas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requisicaoId: integer("requisicao_id")
      .notNull()
      .references(() => requisicoes.id, { onDelete: "cascade" }),
    fornecedorId: integer("fornecedor_id")
      .notNull()
      .references(() => fornecedores.id),
    freteCentavos: integer("frete_centavos").notNull().default(0),
    condicaoPagamento: text("condicao_pagamento"),
    /** Desconto para pagamento à vista/antecipado, em centésimos de % (430 = 4,30%). */
    descontoAVistaBp: integer("desconto_a_vista_bp").notNull().default(0),
    prazoEntregaDias: integer("prazo_entrega_dias"),
    /** Ex.: "após liberação do crédito", "após faturamento". */
    prazoObservacao: text("prazo_observacao"),
    /** Preços incluem IPI/impostos? Orçamentos "s/ IPI" não são comparáveis direto. */
    impostosInclusos: integer("impostos_inclusos", { mode: "boolean" }).notNull().default(true),
    numeroOrcamento: text("numero_orcamento"),
    vendedor: text("vendedor"), // vendedor ou representante
    validade: text("validade"),
    dataCotacao: text("data_cotacao").notNull(),
    /** Total impresso no orçamento (produtos + frete + impostos), para conferir centavo a centavo. */
    totalDocumentoCentavos: integer("total_documento_centavos"),
    /** Desconto conseguido depois do orçamento, sobre o total (centavos). */
    descontoNegociadoCentavos: integer("desconto_negociado_centavos").notNull().default(0),
    arquivoOrigem: text("arquivo_origem"),
    observacoes: text("observacoes"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("propostas_req_forn_uq").on(t.requisicaoId, t.fornecedorId)],
);

export const propostaItens = sqliteTable(
  "proposta_itens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propostaId: integer("proposta_id")
      .notNull()
      .references(() => propostas.id, { onDelete: "cascade" }),
    requisicaoItemId: integer("requisicao_item_id")
      .notNull()
      .references(() => requisicaoItens.id, { onDelete: "cascade" }),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    /** Valor da linha exatamente como no orçamento (quando a unidade/quantidade dele difere da requisição). */
    totalCentavos: integer("total_centavos"),
    quantidadeCotada: real("quantidade_cotada"),
    unidadeCotada: text("unidade_cotada"),
    marca: text("marca"),
    disponivel: integer("disponivel", { mode: "boolean" }).notNull().default(true),
    vencedora: integer("vencedora", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("proposta_itens_uq").on(t.propostaId, t.requisicaoItemId),
    index("proposta_itens_item_idx").on(t.requisicaoItemId),
  ],
);

export const pedidos = sqliteTable(
  "pedidos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    numero: text("numero").unique(), // PC-AAAA-0001, atribuído na emissão
    requisicaoId: integer("requisicao_id")
      .notNull()
      .references(() => requisicoes.id),
    fornecedorId: integer("fornecedor_id")
      .notNull()
      .references(() => fornecedores.id),
    propostaId: integer("proposta_id").references(() => propostas.id),
    valorTotalCentavos: integer("valor_total_centavos").notNull(),
    freteCentavos: integer("frete_centavos").notNull().default(0),
    condicaoPagamento: text("condicao_pagamento"),
    aprovadoPor: text("aprovado_por"),
    dataAprovacao: text("data_aprovacao"),
    dataEmissao: text("data_emissao"),
    prazoPrometido: text("prazo_prometido"),
    status: text("status", { enum: STATUS_PEDIDO }).notNull().default("aguardando_aprovacao"),
    /** "prazo" ou "avista". À vista aplica o desconto da proposta nos itens. */
    formaPagamento: text("forma_pagamento", { enum: ["prazo", "avista"] }).notNull().default("prazo"),
    descontoBp: integer("desconto_bp").notNull().default(0),
    descontoNegociadoCentavos: integer("desconto_negociado_centavos").notNull().default(0),
    prazoEntregaDias: integer("prazo_entrega_dias"),
    motivoCancelamento: text("motivo_cancelamento"),
    observacoes: text("observacoes"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("pedidos_status_idx").on(t.status),
    index("pedidos_fornecedor_idx").on(t.fornecedorId),
  ],
);

export const pedidoItens = sqliteTable(
  "pedido_itens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pedidoId: integer("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    requisicaoItemId: integer("requisicao_item_id").references(() => requisicaoItens.id),
    materialId: integer("material_id")
      .notNull()
      .references(() => materiais.id),
    quantidade: real("quantidade").notNull(),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    totalCentavos: integer("total_centavos"),
  },
  (t) => [index("pedido_itens_material_idx").on(t.materialId)],
);

export const entregas = sqliteTable("entregas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedidoId: integer("pedido_id")
    .notNull()
    .references(() => pedidos.id, { onDelete: "cascade" }),
  dataReal: text("data_real").notNull(),
  conforme: integer("conforme", { mode: "boolean" }).notNull().default(true),
  parcial: integer("parcial", { mode: "boolean" }).notNull().default(false),
  observacao: text("observacao"),
  criadoEm: criadoEm(),
});

export const avaliacoesFornecedor = sqliteTable("avaliacoes_fornecedor", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedidoId: integer("pedido_id")
    .notNull()
    .unique()
    .references(() => pedidos.id, { onDelete: "cascade" }),
  preco: integer("preco").notNull(),
  prazo: integer("prazo").notNull(),
  qualidade: integer("qualidade").notNull(),
  atendimento: integer("atendimento").notNull(),
  comentario: text("comentario"),
  criadoEm: criadoEm(),
});

/** Cada envio de pedido de cotação a um fornecedor (WhatsApp/PDF), para acompanhar quem respondeu. */
export const cotacaoEnvios = sqliteTable(
  "cotacao_envios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requisicaoId: integer("requisicao_id")
      .notNull()
      .references(() => requisicoes.id, { onDelete: "cascade" }),
    fornecedorId: integer("fornecedor_id")
      .notNull()
      .references(() => fornecedores.id),
    enviadoEm: text("enviado_em").notNull().default(sql`(datetime('now', 'localtime'))`),
    cobradoEm: text("cobrado_em"),
    qtdItens: integer("qtd_itens").notNull().default(0),
  },
  (t) => [uniqueIndex("cotacao_envios_req_forn_idx").on(t.requisicaoId, t.fornecedorId)],
);

export const configEmpresa = sqliteTable("config_empresa", {
  id: integer("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnpj: text("cnpj"),
  endereco: text("endereco"),
  cidade: text("cidade"),
  telefone: text("telefone"),
  email: text("email"),
  comprador: text("comprador"),
  logoPath: text("logo_path"),
  rodapePedido: text("rodape_pedido"),
});

export type Obra = typeof obras.$inferSelect;
export type Categoria = typeof categorias.$inferSelect;
export type Fornecedor = typeof fornecedores.$inferSelect;
export type Material = typeof materiais.$inferSelect;
export type Requisicao = typeof requisicoes.$inferSelect;
export type RequisicaoItem = typeof requisicaoItens.$inferSelect;
export type Proposta = typeof propostas.$inferSelect;
export type PropostaItem = typeof propostaItens.$inferSelect;
export type Pedido = typeof pedidos.$inferSelect;
export type ConfigEmpresa = typeof configEmpresa.$inferSelect;
export type StatusRequisicao = (typeof STATUS_REQUISICAO)[number];
export type StatusPedido = (typeof STATUS_PEDIDO)[number];
export type StatusObra = (typeof STATUS_OBRA)[number];

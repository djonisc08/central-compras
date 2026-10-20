// Validadores compartilhados entre telas (Server Actions) e scripts das skills.
import { z } from "zod";
import { STATUS_OBRA } from "@/db/schema";
import { cnpjValido, somenteDigitos } from "./normalizar";

const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const centavos = z.number().int("Valor em centavos deve ser inteiro").min(0);

const cnpjOpcional = textoOpcional
  .transform((v) => (v ? somenteDigitos(v) : null))
  .refine((v) => !v || cnpjValido(v), "CNPJ inválido");

export const obraSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da obra"),
  endereco: textoOpcional,
  cep: textoOpcional,
  engenheiroResponsavel: textoOpcional,
  status: z.enum(STATUS_OBRA).default("ativa"),
  razaoSocial: textoOpcional,
  cnpj: cnpjOpcional,
  cno: textoOpcional,
});
export type ObraInput = z.input<typeof obraSchema>;

export const fornecedorSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do fornecedor"),
  cnpj: cnpjOpcional,
  contato: textoOpcional,
  whatsapp: textoOpcional,
  email: textoOpcional.refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "E-mail inválido"),
  cidade: textoOpcional,
  ativo: z.boolean().default(true),
  observacoes: textoOpcional,
  categoriaIds: z.array(z.number().int()).default([]),
});
export type FornecedorInput = z.input<typeof fornecedorSchema>;

export const materialSchema = z.object({
  nomePadronizado: z.string().trim().min(2, "Informe o nome padronizado"),
  unidade: z.string().trim().min(1, "Informe a unidade"),
  categoriaId: z.number().int({ message: "Escolha a categoria" }),
  ativo: z.boolean().default(true),
  sinonimos: z.array(z.string().trim().min(1)).default([]),
});
export type MaterialInput = z.input<typeof materialSchema>;

export const requisicaoItemSchema = z.object({
  materialId: z.number().int({ message: "Escolha o material" }),
  quantidade: z.number().positive("Quantidade deve ser maior que zero"),
  especificacao: textoOpcional,
});

export const requisicaoSchema = z
  .object({
    obraId: z.number().int({ message: "Escolha a obra" }),
    solicitante: z.string().trim().min(2, "Informe o solicitante"),
    dataPedido: dataISO,
    dataNecessidade: dataISO,
    urgente: z.boolean().default(false),
    origemTexto: textoOpcional,
    observacoes: textoOpcional,
    itens: z.array(requisicaoItemSchema).min(1, "Inclua pelo menos um item"),
  })
  .refine((r) => r.dataNecessidade >= r.dataPedido, {
    message: "A data de necessidade não pode ser anterior à data do pedido",
    path: ["dataNecessidade"],
  });
export type RequisicaoInput = z.input<typeof requisicaoSchema>;

export const propostaItemSchema = z.object({
  requisicaoItemId: z.number().int(),
  precoUnitarioCentavos: centavos,
  marca: textoOpcional,
  disponivel: z.boolean().default(true),
});

export const propostaSchema = z.object({
  requisicaoId: z.number().int(),
  fornecedorId: z.number().int({ message: "Escolha o fornecedor" }),
  freteCentavos: centavos.default(0),
  condicaoPagamento: textoOpcional,
  descontoAVistaBp: z.number().int().min(0).max(5000, "Desconto acima de 50%? Confira.").default(0),
  prazoEntregaDias: z.number().int().min(0).nullable().optional(),
  prazoObservacao: textoOpcional,
  impostosInclusos: z.boolean().default(true),
  numeroOrcamento: textoOpcional,
  vendedor: textoOpcional,
  validade: dataISO.nullable().optional(),
  dataCotacao: dataISO,
  arquivoOrigem: textoOpcional,
  observacoes: textoOpcional,
  itens: z.array(propostaItemSchema).min(1, "Informe o preço de pelo menos um item"),
});
export type PropostaInput = z.input<typeof propostaSchema>;

export const empresaSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  nomeFantasia: textoOpcional,
  cnpj: textoOpcional.transform((v) => (v ? somenteDigitos(v) : null)),
  endereco: textoOpcional,
  cidade: textoOpcional,
  telefone: textoOpcional,
  email: textoOpcional,
  comprador: textoOpcional,
  logoPath: textoOpcional,
  rodapePedido: textoOpcional,
});
export type EmpresaInput = z.input<typeof empresaSchema>;

/** Primeira mensagem de erro legível de um ZodError. */
export function mensagemErro(e: z.ZodError): string {
  const p = e.issues[0];
  return p ? p.message : "Dados inválidos";
}

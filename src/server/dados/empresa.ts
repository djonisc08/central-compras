import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { configEmpresa, type ConfigEmpresa } from "@/db/schema";
import { empresaSchema, type EmpresaInput } from "@/lib/validacao";

const PADRAO: ConfigEmpresa = {
  id: 1,
  razaoSocial: "Sua Construtora Ltda.",
  nomeFantasia: "Sua Construtora",
  cnpj: null,
  endereco: null,
  cidade: null,
  telefone: null,
  email: null,
  comprador: null,
  logoPath: null,
  rodapePedido: null,
};

export function obterEmpresa(db: DB): ConfigEmpresa {
  return db.select().from(configEmpresa).where(eq(configEmpresa.id, 1)).get() ?? PADRAO;
}

export function salvarEmpresa(db: DB, entrada: EmpresaInput) {
  const dados = empresaSchema.parse(entrada);
  db.insert(configEmpresa)
    .values({ id: 1, ...dados })
    .onConflictDoUpdate({ target: configEmpresa.id, set: dados })
    .run();
}

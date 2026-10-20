import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { obterEmpresa } from "@/server/dados/empresa";
import { PageHeader } from "@/components/page-header";
import { FormEmpresa } from "./form-empresa";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await connection();
  const empresa = obterEmpresa(getDb());
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader titulo="Configurações" descricao="Dados da empresa usados no cabeçalho do mapa e do pedido de compra." />
      <FormEmpresa empresa={empresa} />
    </div>
  );
}

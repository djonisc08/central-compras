import type { Metadata } from "next";
import { connection } from "next/server";
import { PlusIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarCategorias, listarFornecedores } from "@/server/dados/cadastros";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FornecedorDialog } from "./fornecedor-dialog";
import { ListaFornecedores } from "./lista-fornecedores";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  await connection();
  const db = getDb();
  const fornecedores = listarFornecedores(db);
  const categorias = listarCategorias(db);

  return (
    <>
      <PageHeader
        titulo="Fornecedores"
        descricao={`${fornecedores.filter((f) => f.ativo).length} ativos · cadastro pronto para exportar ao Sienge`}
        acoes={
          <>
            <Button variant="outline" asChild>
              <a href="/api/exportar/cadastros">Exportar cadastros</a>
            </Button>
            <FornecedorDialog categorias={categorias}>
              <Button>
                <PlusIcon /> Novo fornecedor
              </Button>
            </FornecedorDialog>
          </>
        }
      />
      <ListaFornecedores fornecedores={fornecedores} categorias={categorias} />
    </>
  );
}

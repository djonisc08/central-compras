import type { Metadata } from "next";
import { connection } from "next/server";
import { PlusIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarCategorias, listarMateriais } from "@/server/dados/cadastros";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CategoriaDialog } from "./categoria-dialog";
import { ListaMateriais } from "./lista-materiais";
import { MaterialDialog } from "./material-dialog";

export const metadata: Metadata = { title: "Materiais" };

export default async function MateriaisPage() {
  await connection();
  const db = getDb();
  const materiais = listarMateriais(db);
  const categorias = listarCategorias(db);

  return (
    <>
      <PageHeader
        titulo="Materiais"
        descricao={`${materiais.length} materiais padronizados em ${categorias.length} categorias. Sinônimos ajudam a reconhecer pedidos do WhatsApp.`}
        acoes={
          <>
            <CategoriaDialog>
              <Button variant="outline">Nova categoria</Button>
            </CategoriaDialog>
            <MaterialDialog categorias={categorias}>
              <Button>
                <PlusIcon /> Novo material
              </Button>
            </MaterialDialog>
          </>
        }
      />
      <ListaMateriais materiais={materiais} categorias={categorias} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeftIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarCategorias, listarMateriais, listarObras } from "@/server/dados/cadastros";
import { PageHeader } from "@/components/page-header";
import { hojeISO } from "@/lib/datas";
import { FormRequisicao } from "./form-requisicao";

export const metadata: Metadata = { title: "Nova requisição" };

export default async function NovaRequisicaoPage() {
  await connection();
  const db = getDb();
  const obras = listarObras(db).filter((o) => o.status !== "concluida");
  const materiais = listarMateriais(db, { somenteAtivos: true });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        antes={
          <Link href="/requisicoes" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Requisições
          </Link>
        }
        titulo="Nova requisição"
        descricao="Lance os itens como chegaram da obra. Enter na quantidade adiciona a próxima linha."
      />
      <FormRequisicao
        hoje={hojeISO()}
        obras={obras.map((o) => ({ id: o.id, nome: o.nome, status: o.status }))}
        materiais={materiais.map((m) => ({
          id: m.id,
          nomePadronizado: m.nomePadronizado,
          unidade: m.unidade,
          sinonimos: m.sinonimos,
          categoria: m.categoria,
        }))}
        categorias={listarCategorias(db)}
      />
    </div>
  );
}

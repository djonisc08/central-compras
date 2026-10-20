import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeftIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarCategorias, listarMateriais, listarObras } from "@/server/dados/cadastros";
import { listarPropostas, obterRequisicao, temPedidosAtivos } from "@/server/dados/requisicoes";
import { PageHeader } from "@/components/page-header";
import { hojeISO } from "@/lib/datas";
import { FormRequisicao } from "../../nova/form-requisicao";

export async function generateMetadata({ params }: PageProps<"/requisicoes/[id]/editar">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Editar requisição #${id}` };
}

export default async function EditarRequisicaoPage({ params }: PageProps<"/requisicoes/[id]/editar">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const r = obterRequisicao(db, Number(id));
  if (!r) notFound();
  if (["cancelada", "entregue"].includes(r.status) || temPedidosAtivos(db, r.id)) redirect(`/requisicoes/${r.id}`);
  const obras = listarObras(db).filter((o) => o.status !== "concluida" || o.id === r.obraId);
  const materiais = listarMateriais(db, { somenteAtivos: true });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        antes={
          <Link href={`/requisicoes/${r.id}`} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Requisição #{r.id}
          </Link>
        }
        titulo={`Editar requisição #${r.id}`}
        descricao={`${r.obra} · altere quantidades, remova itens ou cole os itens adicionais que a obra mandou.`}
      />
      <FormRequisicao
        hoje={hojeISO()}
        obras={obras.map((o) => ({ id: o.id, nome: o.nome, status: o.status, cnpj: o.cnpj, cno: o.cno, endereco: o.endereco }))}
        materiais={materiais.map((m) => ({
          id: m.id,
          nomePadronizado: m.nomePadronizado,
          unidade: m.unidade,
          sinonimos: m.sinonimos,
          categoria: m.categoria,
        }))}
        categorias={listarCategorias(db)}
        editar={{
          id: r.id,
          obraId: r.obraId,
          solicitante: r.solicitante,
          dataPedido: r.dataPedido,
          dataNecessidade: r.dataNecessidade,
          urgente: r.urgente,
          origemTexto: r.origemTexto,
          observacoes: r.observacoes,
          itens: r.itens.map((i) => ({ id: i.id, materialId: i.materialId, quantidade: i.quantidade, especificacao: i.especificacao })),
          qtdPropostas: listarPropostas(db, r.id).length,
        }}
      />
    </div>
  );
}

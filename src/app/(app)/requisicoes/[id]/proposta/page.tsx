import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { ChevronLeftIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { propostas } from "@/db/schema";
import { fornecedoresPorCategoria, listarFornecedores } from "@/server/dados/cadastros";
import { obterProposta, obterRequisicao, ultimosPrecosPagos } from "@/server/dados/requisicoes";
import { PageHeader } from "@/components/page-header";
import { hojeISO } from "@/lib/datas";
import { FormProposta } from "./form-proposta";

export const metadata: Metadata = { title: "Lançar proposta" };

export default async function PropostaPage({ params, searchParams }: PageProps<"/requisicoes/[id]/proposta">) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const req = obterRequisicao(db, Number(id));
  if (!req) notFound();

  const fornecedorId = Number(sp.fornecedor) || null;
  const existente = fornecedorId
    ? db
        .select({ id: propostas.id })
        .from(propostas)
        .where(and(eq(propostas.requisicaoId, req.id), eq(propostas.fornecedorId, fornecedorId)))
        .get()
    : undefined;
  const proposta = existente ? obterProposta(db, existente.id) : null;

  const daCategoria = new Set(fornecedoresPorCategoria(db, [...new Set(req.itens.map((i) => i.categoriaId))]).map((f) => f.id));
  const fornecedores = listarFornecedores(db, { somenteAtivos: true }).map((f) => ({
    id: f.id,
    nome: f.nome,
    sugerido: daCategoria.has(f.id),
  }));
  const ultimos = ultimosPrecosPagos(db, req.itens.map((i) => i.materialId));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        antes={
          <Link href={`/requisicoes/${req.id}`} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Requisição #{req.id}
          </Link>
        }
        titulo={proposta ? "Editar proposta" : "Lançar proposta"}
        descricao={`${req.obra} · ${req.itens.length} itens`}
      />
      <FormProposta
        key={fornecedorId ?? "novo"}
        hoje={hojeISO()}
        requisicao={{ id: req.id, itens: req.itens.map((i) => ({ ...i, ultimoPago: ultimos.get(i.materialId)?.preco ?? null })) }}
        fornecedores={fornecedores}
        fornecedorId={fornecedorId}
        proposta={proposta}
      />
    </div>
  );
}

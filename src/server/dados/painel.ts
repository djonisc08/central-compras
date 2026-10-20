import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { somarDias } from "@/lib/datas";

/** Contadores operacionais do painel (o que precisa de ação hoje). */
export function resumoOperacional(db: DB, hoje: string) {
  const amanha = somarDias(hoje, 1);
  const n = (q: ReturnType<typeof sql>) => db.get<{ n: number }>(q)?.n ?? 0;
  return {
    emCotacao: n(sql`select count(*) n from requisicoes where status in ('aberta','cotando')`),
    semProposta: n(sql`select count(*) n from requisicoes where status = 'aberta'`),
    urgentesHoje: n(
      sql`select count(*) n from requisicoes where status in ('aberta','cotando','aguardando_aprovacao','aprovada') and (urgente = 1 or data_necessidade <= ${amanha})`,
    ),
    aguardandoAprovacao: n(sql`select count(*) n from requisicoes where status = 'aguardando_aprovacao'`),
    entregasAtrasadas: n(
      sql`select count(*) n from pedidos p where p.status in ('emitido','entregue_parcial') and p.prazo_prometido < ${hoje}`,
    ),
    entregasHoje: n(sql`select count(*) n from pedidos p where p.status in ('emitido','entregue_parcial') and p.prazo_prometido = ${hoje}`),
  };
}

export function entregasPendentes(db: DB) {
  return db.all<{
    id: number;
    numero: string | null;
    fornecedor: string;
    obra: string;
    requisicao_id: number;
    prazo_prometido: string;
    valor_total_centavos: number;
  }>(sql`
    select p.id, p.numero, f.nome as fornecedor, o.nome as obra, p.requisicao_id, p.prazo_prometido, p.valor_total_centavos
    from pedidos p
    join fornecedores f on f.id = p.fornecedor_id
    join requisicoes r on r.id = p.requisicao_id
    join obras o on o.id = r.obra_id
    where p.status in ('emitido','entregue_parcial')
    order by p.prazo_prometido
  `);
}

/** Gasto por obra no mês corrente (pedidos emitidos). */
export function gastoPorObraNoPeriodo(db: DB, inicio: string, fim: string) {
  return db.all<{ obra: string; total: number }>(sql`
    select o.nome as obra, coalesce(sum(p.valor_total_centavos), 0) as total
    from obras o
    left join requisicoes r on r.obra_id = o.id
    left join pedidos p on p.requisicao_id = r.id and p.status not in ('cancelado','aguardando_aprovacao')
      and p.data_emissao between ${inicio} and ${fim}
    where o.status = 'ativa'
    group by o.id
    order by total desc
  `);
}

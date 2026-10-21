import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";

export type TipoAtividade = "requisicao" | "proposta" | "pedido" | "aprovacao" | "entrega" | "avaliacao" | "cancelamento";

export type Atividade = {
  tipo: TipoAtividade;
  data: string;
  /** HH:MM do lançamento, só quando foi lançado no próprio dia. */
  hora: string | null;
  titulo: string;
  detalhe: string;
  obra: string;
  valor: number | null;
  link: string;
  alerta: boolean;
};

type Linha = Omit<Atividade, "hora" | "alerta"> & { criado: string; alerta: number };

/** Tudo o que aconteceu entre `inicio` e `fim` (datas AAAA-MM-DD, inclusive), em ordem cronológica. */
export function atividadesNoPeriodo(db: DB, inicio: string, fim: string): Atividade[] {
  const linhas = db.all<Linha>(sql`
    select 'requisicao' tipo, r.data_pedido data, r.criado_em criado,
      'Requisição #' || r.id || case when r.urgente = 1 then ' · URGENTE' else '' end titulo,
      r.solicitante || ' · ' || (select count(*) from requisicao_itens i where i.requisicao_id = r.id) || ' itens: ' ||
        coalesce((select group_concat(m.nome_padronizado, ', ') from (select * from requisicao_itens i where i.requisicao_id = r.id limit 3) i join materiais m on m.id = i.material_id), '') detalhe,
      o.nome obra, null valor, '/requisicoes/' || r.id link, r.urgente alerta
    from requisicoes r join obras o on o.id = r.obra_id
    where r.data_pedido between ${inicio} and ${fim}

    union all
    select 'proposta', p.data_cotacao, p.criado_em,
      'Orçamento · ' || f.nome,
      'Requisição #' || r.id || coalesce(' · ' || p.condicao_pagamento, ''),
      o.nome,
      p.frete_centavos + coalesce((select sum(coalesce(pi.total_centavos, round(pi.preco_unitario_centavos * ri.quantidade))) from proposta_itens pi
        join requisicao_itens ri on ri.id = pi.requisicao_item_id where pi.proposta_id = p.id and pi.disponivel = 1), 0) - min(p.desconto_negociado_centavos, coalesce((select sum(coalesce(pi.total_centavos, round(pi.preco_unitario_centavos * ri.quantidade))) from proposta_itens pi
        join requisicao_itens ri on ri.id = pi.requisicao_item_id where pi.proposta_id = p.id and pi.disponivel = 1), 0)),
      '/requisicoes/' || r.id || '/mapa', 0
    from propostas p join fornecedores f on f.id = p.fornecedor_id
      join requisicoes r on r.id = p.requisicao_id join obras o on o.id = r.obra_id
    where p.data_cotacao between ${inicio} and ${fim}

    union all
    select 'pedido', pe.data_emissao, pe.criado_em,
      'Pedido ' || coalesce(pe.numero, '#' || pe.id) || ' · ' || f.nome,
      coalesce(pe.condicao_pagamento, '') || coalesce(' · entrega ' || strftime('%d/%m', pe.prazo_prometido), ''),
      o.nome, pe.valor_total_centavos, '/pedidos/' || pe.id, 0
    from pedidos pe join fornecedores f on f.id = pe.fornecedor_id
      join requisicoes r on r.id = pe.requisicao_id join obras o on o.id = r.obra_id
    where pe.data_emissao between ${inicio} and ${fim} and pe.status <> 'cancelado'

    union all
    select 'aprovacao', pe.data_aprovacao, pe.criado_em,
      'Aprovado · ' || f.nome, 'por ' || coalesce(pe.aprovado_por, '—') || ' · aguardando emissão',
      o.nome, pe.valor_total_centavos, '/pedidos/' || pe.id, 0
    from pedidos pe join fornecedores f on f.id = pe.fornecedor_id
      join requisicoes r on r.id = pe.requisicao_id join obras o on o.id = r.obra_id
    where pe.data_aprovacao between ${inicio} and ${fim} and pe.status <> 'cancelado'
      and (pe.data_emissao is null or pe.data_emissao <> pe.data_aprovacao)

    union all
    select 'entrega', e.data_real, e.criado_em,
      'Entrega · ' || f.nome,
      coalesce(pe.numero, '') ||
        case when e.parcial = 1 then ' · parcial' else ' · completa' end ||
        case when e.conforme = 0 then ' · NÃO CONFORME' else '' end ||
        case when e.data_real > pe.prazo_prometido then ' · ' || cast(julianday(e.data_real) - julianday(pe.prazo_prometido) as integer) || 'd de atraso' else ' · no prazo' end,
      o.nome, null, '/pedidos/' || pe.id,
      case when e.conforme = 0 or e.data_real > pe.prazo_prometido then 1 else 0 end
    from entregas e join pedidos pe on pe.id = e.pedido_id join fornecedores f on f.id = pe.fornecedor_id
      join requisicoes r on r.id = pe.requisicao_id join obras o on o.id = r.obra_id
    where e.data_real between ${inicio} and ${fim}

    union all
    select 'avaliacao', date(a.criado_em), a.criado_em,
      'Avaliação · ' || f.nome,
      'preço ' || a.preco || ' · prazo ' || a.prazo || ' · qualidade ' || a.qualidade || ' · atendimento ' || a.atendimento,
      o.nome, null, '/pedidos/' || pe.id, 0
    from avaliacoes_fornecedor a join pedidos pe on pe.id = a.pedido_id join fornecedores f on f.id = pe.fornecedor_id
      join requisicoes r on r.id = pe.requisicao_id join obras o on o.id = r.obra_id
    where date(a.criado_em) between ${inicio} and ${fim}

    order by data, criado
  `);
  return linhas.map(({ criado, alerta, ...l }) => ({
    ...l,
    hora: criado?.slice(0, 10) === l.data ? criado.slice(11, 16) : null,
    alerta: !!alerta,
  }));
}

export function resumirAtividades(lista: Atividade[]) {
  const de = (t: TipoAtividade) => lista.filter((a) => a.tipo === t);
  const pedidos = de("pedido");
  return {
    requisicoes: de("requisicao").length,
    orcamentos: de("proposta").length,
    pedidos: pedidos.length,
    totalComprado: pedidos.reduce((s, p) => s + (p.valor ?? 0), 0),
    entregas: de("entrega").length,
    alertas: lista.filter((a) => a.alerta && a.tipo === "entrega").length,
  };
}

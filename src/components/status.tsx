import { Badge } from "@/components/ui/badge";
import type { StatusObra, StatusPedido, StatusRequisicao } from "@/db/schema";
import { cn } from "@/lib/utils";
import { FlameIcon } from "lucide-react";

type Tom = "neutro" | "info" | "atencao" | "urgente" | "ok" | "roxo" | "contorno";

export const ROTULO_REQUISICAO: Record<StatusRequisicao, { rotulo: string; tom: Tom }> = {
  aberta: { rotulo: "Aberta", tom: "neutro" },
  cotando: { rotulo: "Cotando", tom: "info" },
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", tom: "atencao" },
  aprovada: { rotulo: "Aprovada", tom: "roxo" },
  pedido_emitido: { rotulo: "Pedido emitido", tom: "roxo" },
  entregue: { rotulo: "Entregue", tom: "ok" },
  cancelada: { rotulo: "Cancelada", tom: "contorno" },
};

export const ROTULO_PEDIDO: Record<StatusPedido, { rotulo: string; tom: Tom }> = {
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", tom: "atencao" },
  aprovado: { rotulo: "Aprovado", tom: "info" },
  emitido: { rotulo: "Emitido", tom: "roxo" },
  entregue_parcial: { rotulo: "Entrega parcial", tom: "info" },
  entregue: { rotulo: "Entregue", tom: "ok" },
  cancelado: { rotulo: "Cancelado", tom: "contorno" },
};

export const ROTULO_OBRA: Record<StatusObra, { rotulo: string; tom: Tom }> = {
  ativa: { rotulo: "Ativa", tom: "ok" },
  planejada: { rotulo: "Planejada", tom: "info" },
  concluida: { rotulo: "Concluída", tom: "contorno" },
};

function Ponto({ tom }: { tom: Tom }) {
  const cor: Record<Tom, string> = {
    neutro: "bg-st-neutro",
    info: "bg-st-info",
    atencao: "bg-st-atencao",
    urgente: "bg-st-urgente",
    ok: "bg-st-ok",
    roxo: "bg-st-roxo",
    contorno: "bg-muted-foreground/50",
  };
  return <span className={cn("size-1.5 rounded-full", cor[tom])} aria-hidden />;
}

export function StatusRequisicaoBadge({ status }: { status: StatusRequisicao }) {
  const s = ROTULO_REQUISICAO[status];
  return (
    <Badge tom={s.tom}>
      <Ponto tom={s.tom} />
      {s.rotulo}
    </Badge>
  );
}

export function StatusPedidoBadge({ status }: { status: StatusPedido }) {
  const s = ROTULO_PEDIDO[status];
  return (
    <Badge tom={s.tom}>
      <Ponto tom={s.tom} />
      {s.rotulo}
    </Badge>
  );
}

export function StatusObraBadge({ status }: { status: StatusObra }) {
  const s = ROTULO_OBRA[status];
  return (
    <Badge tom={s.tom}>
      <Ponto tom={s.tom} />
      {s.rotulo}
    </Badge>
  );
}

export function UrgenteBadge({ className }: { className?: string }) {
  return (
    <Badge tom="urgente" className={className}>
      <FlameIcon />
      Urgente
    </Badge>
  );
}

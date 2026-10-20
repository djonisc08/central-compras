import { cn } from "@/lib/utils";
import { FormulaTip } from "./formula-tip";

export function KpiCard({
  rotulo,
  valor,
  detalhe,
  formula,
  icone,
  tom = "neutro",
  className,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  formula?: string;
  icone?: React.ReactNode;
  tom?: "neutro" | "ok" | "atencao" | "urgente" | "info";
  className?: string;
}) {
  const corIcone = {
    neutro: "bg-muted text-muted-foreground",
    ok: "bg-st-ok-bg text-st-ok",
    atencao: "bg-st-atencao-bg text-st-atencao",
    urgente: "bg-st-urgente-bg text-st-urgente",
    info: "bg-st-info-bg text-st-info",
  }[tom];
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          {rotulo}
          {formula && <FormulaTip formula={formula} />}
        </div>
        {icone && <div className={cn("flex size-7 items-center justify-center rounded-lg [&_svg]:size-3.5", corIcone)}>{icone}</div>}
      </div>
      <div className="tabular mt-2 text-[22px] leading-none font-semibold tracking-tight">{valor}</div>
      {detalhe && <div className="mt-1.5 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

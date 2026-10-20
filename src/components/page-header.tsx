import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descricao,
  acoes,
  antes,
  className,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  antes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {antes}
        <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-[22px]">{titulo}</h1>
        {descricao && <p className="mt-1 text-[13px] text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

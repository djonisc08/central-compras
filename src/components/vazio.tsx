import { cn } from "@/lib/utils";

export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      {icone && <div className="mb-1 text-muted-foreground/60 [&_svg]:size-8">{icone}</div>}
      <p className="text-sm font-medium">{titulo}</p>
      {descricao && <p className="max-w-sm text-[13px] text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

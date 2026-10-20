import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Campo({
  rotulo,
  htmlFor,
  dica,
  className,
  children,
}: {
  rotulo: string;
  htmlFor?: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{rotulo}</Label>
      {children}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

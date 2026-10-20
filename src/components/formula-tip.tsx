import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function FormulaTip({ formula }: { formula: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help items-center text-muted-foreground/70 transition-colors hover:text-foreground"
          aria-label="Ver fórmula"
        >
          <InfoIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{formula}</TooltipContent>
    </Tooltip>
  );
}

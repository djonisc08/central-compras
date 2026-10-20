import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      tom: {
        neutro: "bg-st-neutro-bg text-st-neutro",
        info: "bg-st-info-bg text-st-info",
        atencao: "bg-st-atencao-bg text-st-atencao",
        urgente: "bg-st-urgente-bg text-st-urgente",
        ok: "bg-st-ok-bg text-st-ok",
        roxo: "bg-st-roxo-bg text-st-roxo",
        contorno: "border text-muted-foreground",
      },
    },
    defaultVariants: { tom: "neutro" },
  },
);

function Badge({ className, tom, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tom }), className)} {...props} />;
}

export { Badge, badgeVariants };

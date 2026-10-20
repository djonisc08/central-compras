"use client";

import { forwardRef, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buscarMateriais, type CandidatoMaterial } from "@/lib/normalizar";
import { cn } from "@/lib/utils";

export type OpcaoMaterial = CandidatoMaterial & { categoria: string };

export const MaterialCombobox = forwardRef<
  HTMLButtonElement,
  {
    materiais: OpcaoMaterial[];
    valor: number | null;
    aoMudar: (id: number) => void;
    aoCriar?: (texto: string) => void;
    className?: string;
  }
>(function MaterialCombobox({ materiais, valor, aoMudar, aoCriar, className }, ref) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  // Após escolher, quem chamou move o foco (ex.: para a quantidade); o popover não deve devolvê-lo ao botão.
  const escolheu = useRef(false);
  const selecionado = materiais.find((m) => m.id === valor);

  const resultados = useMemo(() => {
    if (!busca.trim()) return materiais.slice(0, 60).map((m) => ({ m, motivo: null as string | null }));
    return buscarMateriais(busca, materiais, 12).map((r) => ({
      m: materiais.find((m) => m.id === r.id)!,
      motivo: r.motivo === "sinonimo_exato" ? "sinônimo" : null,
    }));
  }, [busca, materiais]);

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) setBusca("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          role="combobox"
          aria-expanded={aberto}
          aria-controls="lista-materiais"
          aria-haspopup="listbox"
          className={cn(
            "flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25",
            !selecionado && "text-muted-foreground/80",
            className,
          )}
        >
          <span className="truncate">{selecionado ? selecionado.nomePadronizado : "Buscar material…"}</span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(30rem,calc(100vw-2rem))] p-0"
        onCloseAutoFocus={(e) => {
          if (escolheu.current) e.preventDefault();
          escolheu.current = false;
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder='Digite como na obra: "cp2", "ferro 3/8"…' value={busca} onValueChange={setBusca} />
          <CommandList id="lista-materiais">
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {resultados.map(({ m, motivo }) => (
                <CommandItem
                  key={m.id}
                  value={String(m.id)}
                  onSelect={() => {
                    escolheu.current = true;
                    aoMudar(m.id);
                    setAberto(false);
                    setBusca("");
                  }}
                >
                  <CheckIcon className={cn("size-3.5", m.id === valor ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{m.nomePadronizado}</span>
                  {motivo && <span className="text-[11px] text-st-ok">{motivo}</span>}
                  <span className="text-xs text-muted-foreground">{m.unidade}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {aoCriar && busca.trim().length > 2 && (
              <CommandGroup heading="Não achou?">
                <CommandItem
                  value="__novo__"
                  onSelect={() => {
                    aoCriar(busca.trim());
                    setAberto(false);
                    setBusca("");
                  }}
                >
                  <PlusIcon className="size-3.5" />
                  Cadastrar “{busca.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

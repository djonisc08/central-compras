"use client";

import { aoEnviar } from "@/lib/form";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { criarCategoriaAction } from "@/server/actions/cadastros";

export function CategoriaDialog({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  function enviar(form: FormData) {
    iniciar(async () => {
      const r = await criarCategoriaAction(String(form.get("nome") ?? ""));
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Categoria criada");
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
        </DialogHeader>
        <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
          <Campo rotulo="Nome" htmlFor="nome-cat">
            <Input id="nome-cat" name="nome" required autoFocus placeholder="ex.: Tintas e acabamento" />
          </Campo>
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

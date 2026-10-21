"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, FileIcon, PaperclipIcon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { removerAnexoAction } from "@/server/actions/anexos";

type Anexo = { arquivo: string; nome: string; kb: number };

/** Arrastar os PDFs de orçamento para dentro da requisição; o Claude importa a partir daqui. */
export function AnexarOrcamento({ requisicaoId, pendentes }: { requisicaoId: number; pendentes: Anexo[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [, iniciar] = useTransition();
  const frase = `chegou orçamento, importa os anexos da requisição #${requisicaoId}`;

  async function enviar(arquivos: FileList | File[]) {
    const lista = [...arquivos];
    if (!lista.length) return;
    const form = new FormData();
    for (const f of lista) form.append("arquivos", f);
    setEnviando(true);
    try {
      const r = await fetch(`/api/anexos/${requisicaoId}`, { method: "POST", body: form });
      const { salvos, erros } = (await r.json()) as { salvos: string[]; erros: string[] };
      if (salvos.length) toast.success(`${salvos.length} orçamento(s) anexado(s)`);
      for (const e of erros) toast.error(e);
      router.refresh();
    } catch {
      toast.error("Não foi possível anexar. O sistema está ligado?");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  async function copiarFrase() {
    try {
      await navigator.clipboard.writeText(frase);
      toast.success("Frase copiada. Cole no Claude.");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="grid gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void enviar(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors",
          arrastando ? "border-primary bg-accent/50" : "border-border hover:border-primary/50 hover:bg-muted/40",
        )}
      >
        <UploadCloudIcon className="size-6 text-primary" />
        <div className="text-[13px] font-medium">{enviando ? "Anexando…" : "Anexar orçamento do fornecedor"}</div>
        <div className="text-xs text-muted-foreground">Arraste o PDF, foto ou planilha aqui, ou clique para escolher. Pode ser vários.</div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.eml"
          className="hidden"
          onChange={(e) => e.target.files && void enviar(e.target.files)}
        />
      </div>

      {pendentes.length > 0 && (
        <div className="rounded-xl border border-st-atencao/40 bg-st-atencao-bg/50 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
            <PaperclipIcon className="size-4" /> {pendentes.length} aguardando importação
          </div>
          <ul className="mb-2.5 grid gap-1">
            {pendentes.map((a) => (
              <li key={a.arquivo} className="flex items-center gap-2 rounded-md bg-card px-2 py-1 text-xs">
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                <span className="shrink-0 text-muted-foreground">{a.kb} KB</span>
                <button
                  type="button"
                  aria-label={`Remover ${a.nome}`}
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    iniciar(async () => {
                      const r = await removerAnexoAction(requisicaoId, a.arquivo);
                      if (!r.ok) toast.error(r.erro);
                    })
                  }
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="text-xs">
            Agora peça ao Claude (app, aba Code, ou PowerShell na pasta do sistema):
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1">{frase}</code>
              <Button type="button" size="xs" variant="outline" onClick={copiarFrase}>
                <CopyIcon /> Copiar
              </Button>
            </div>
            <div className="mt-1 text-muted-foreground">Ele lê, monta a proposta, mostra a conferência e só grava com o seu OK.</div>
          </div>
        </div>
      )}
    </div>
  );
}

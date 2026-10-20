"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, FileSpreadsheetIcon, FileTextIcon, MessageCircleIcon, MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { linkWhatsapp } from "@/lib/normalizar";

type Sugerido = { id: number; nome: string; contato: string | null; whatsapp: string | null; jaCotou: boolean; mensagem: string };

export function PedirCotacao({ requisicaoId, fornecedores }: { requisicaoId: number; fornecedores: Sugerido[] }) {
  const [copiado, setCopiado] = useState<number | null>(null);

  async function copiar(f: Sugerido) {
    try {
      await navigator.clipboard.writeText(f.mensagem);
      setCopiado(f.id);
      toast.success("Mensagem copiada");
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  const pdf = (fid?: number) => `/imprimir/cotacao/${requisicaoId}${fid ? `?fornecedor=${fid}` : ""}`;
  const xlsx = (fid?: number) => `/api/exportar/cotacao/${requisicaoId}${fid ? `?fornecedor=${fid}` : ""}`;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pedir cotação</CardTitle>
          <CardDescription>
            Mensagem pronta no WhatsApp, PDF com os dados de faturamento da obra e planilha para o fornecedor preencher.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        <div className="mb-1 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={pdf()} target="_blank" rel="noreferrer">
              <FileTextIcon /> PDF da solicitação
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={xlsx()}>
              <FileSpreadsheetIcon /> Planilha p/ preencher
            </a>
          </Button>
        </div>
        {fornecedores.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum fornecedor cadastrado para estas categorias.</p>}
        {fornecedores.map((f) => {
          const wa = linkWhatsapp(f.whatsapp, f.mensagem);
          return (
            <div key={f.id} className="flex items-center gap-1.5 rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{f.nome}</div>
                <div className="truncate text-xs text-muted-foreground">{f.contato ?? "—"}</div>
              </div>
              {f.jaCotou && <Badge tom="ok">Cotou</Badge>}
              <Button variant="ghost" size="icon-sm" onClick={() => copiar(f)} aria-label="Copiar mensagem">
                {copiado === f.id ? <CheckIcon className="text-st-ok" /> : <CopyIcon />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Arquivos para ${f.nome}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <a href={pdf(f.id)} target="_blank" rel="noreferrer">
                      <FileTextIcon /> PDF para {f.nome}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={xlsx(f.id)}>
                      <FileSpreadsheetIcon /> Planilha para {f.nome}
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {wa && (
                <Button variant="outline" size="icon-sm" asChild>
                  <a href={wa} target="_blank" rel="noreferrer" aria-label={`Enviar para ${f.nome} no WhatsApp`}>
                    <MessageCircleIcon className="text-st-ok" />
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

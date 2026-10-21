"use client";

import { useState, useTransition } from "react";
import { BanIcon, CheckCircle2Icon, MessageCircleIcon, MoreHorizontalIcon, PrinterIcon, SendIcon, StarIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { StatusPedido } from "@/db/schema";
import { somarDias } from "@/lib/datas";
import { cn } from "@/lib/utils";
import {
  aprovarPedidoAction,
  avaliarFornecedorAction,
  cancelarPedidoAction,
  emitirPedidoAction,
  registrarEntregaAction,
} from "@/server/actions/pedidos";

type Dialogo = "aprovar" | "emitir" | "entrega" | "avaliar" | "cancelar" | null;

export function AcoesPedido({
  pedido,
  hoje,
  whatsapp,
}: {
  pedido: { id: number; status: StatusPedido; numero: string | null; prazoEntregaDias: number | null; avaliado: boolean };
  hoje: string;
  whatsapp: string | null;
}) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendente, iniciar] = useTransition();
  const prazoPadrao = somarDias(hoje, pedido.prazoEntregaDias ?? 0);
  const fechar = () => setDialogo(null);

  function rodar(fn: () => Promise<{ ok: boolean; erro?: string; dados?: unknown }>, sucesso: (dados: unknown) => string, depois?: () => void) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro ?? "Erro");
      toast.success(sucesso(r.dados));
      fechar();
      depois?.();
    });
  }

  // ------------------------------------------------------------ aprovar
  const [aprovadoPor, setAprovadoPor] = useState("Diretoria");
  const [dataAprov, setDataAprov] = useState(hoje);
  const [emitirJunto, setEmitirJunto] = useState(true);
  const [prazo, setPrazo] = useState(prazoPadrao);

  // ------------------------------------------------------------ entrega
  const [dataEntrega, setDataEntrega] = useState(hoje);
  const [parcial, setParcial] = useState(false);
  const [conforme, setConforme] = useState(true);
  const [obsEntrega, setObsEntrega] = useState("");

  // ------------------------------------------------------------ avaliação
  const [notas, setNotas] = useState({ preco: 0, prazo: 0, qualidade: 0, atendimento: 0 });
  const [comentario, setComentario] = useState("");

  const [motivo, setMotivo] = useState("");

  const podeCancelar = ["aguardando_aprovacao", "aprovado", "emitido"].includes(pedido.status);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <a href={`/imprimir/pedido/${pedido.id}`} target="_blank" rel="noreferrer">
            <PrinterIcon /> {pedido.numero ? "PDF do pedido" : "Prévia"}
          </a>
        </Button>
        {whatsapp && ["emitido", "entregue_parcial"].includes(pedido.status) && (
          <Button variant="outline" asChild>
            <a href={whatsapp} target="_blank" rel="noreferrer">
              <MessageCircleIcon className="text-st-ok" /> Enviar ao fornecedor
            </a>
          </Button>
        )}
        {pedido.status === "aguardando_aprovacao" && (
          <Button variant="sucesso" onClick={() => setDialogo("aprovar")}>
            <CheckCircle2Icon /> Aprovar
          </Button>
        )}
        {pedido.status === "aprovado" && (
          <Button onClick={() => setDialogo("emitir")}>
            <SendIcon /> Emitir pedido
          </Button>
        )}
        {["emitido", "entregue_parcial"].includes(pedido.status) && (
          <Button onClick={() => setDialogo("entrega")}>
            <TruckIcon /> Registrar entrega
          </Button>
        )}
        {pedido.status === "entregue" && !pedido.avaliado && (
          <Button onClick={() => setDialogo("avaliar")}>
            <StarIcon /> Avaliar fornecedor
          </Button>
        )}
        {(podeCancelar || (pedido.status === "entregue" && pedido.avaliado)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais ações">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {pedido.status === "entregue" && (
                <DropdownMenuItem onSelect={() => setDialogo("avaliar")}>
                  <StarIcon /> Refazer avaliação
                </DropdownMenuItem>
              )}
              {podeCancelar && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destrutivo onSelect={() => setDialogo("cancelar")}>
                    <BanIcon /> Cancelar pedido
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Aprovar */}
      <Dialog open={dialogo === "aprovar"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar pedido</DialogTitle>
            <DialogDescription>Fica registrado quem aprovou e quando.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_150px] gap-3">
              <Campo rotulo="Aprovado por" htmlFor="aprovadoPor">
                <Input id="aprovadoPor" list="aprovadores" value={aprovadoPor} onChange={(e) => setAprovadoPor(e.target.value)} />
                <datalist id="aprovadores">
                  {["Diretoria", "Engenharia", "Financeiro", "Compras"].map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Campo>
              <Campo rotulo="Data" htmlFor="dataAprov">
                <Input id="dataAprov" type="date" value={dataAprov} onChange={(e) => setDataAprov(e.target.value)} />
              </Campo>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-[13px]">
              <Switch checked={emitirJunto} onCheckedChange={setEmitirJunto} />
              <span>
                <span className="font-medium">Emitir agora</span>
                <span className="block text-xs text-muted-foreground">Gera o número PC e libera o envio ao fornecedor.</span>
              </span>
            </label>
            {emitirJunto && (
              <Campo rotulo="Entrega prometida para" htmlFor="prazoAprov" dica={`Proposta: ${pedido.prazoEntregaDias ?? "—"} dia(s). Ajuste se o fornecedor confirmou outra data.`}>
                <Input id="prazoAprov" type="date" value={prazo} min={dataAprov} onChange={(e) => setPrazo(e.target.value)} />
              </Campo>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              variant="sucesso"
              disabled={pendente}
              onClick={() =>
                rodar(
                  () => aprovarPedidoAction(pedido.id, { aprovadoPor, dataAprovacao: dataAprov }, emitirJunto ? { prazoPrometido: prazo } : undefined),
                  (n) => (emitirJunto ? `Pedido ${n} aprovado e emitido` : "Pedido aprovado"),
                )
              }
            >
              {emitirJunto ? "Aprovar e emitir" : "Aprovar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emitir */}
      <Dialog open={dialogo === "emitir"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir pedido</DialogTitle>
            <DialogDescription>O número PC-AAAA-0000 é gerado agora.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Data de emissão" htmlFor="dataEm">
              <Input id="dataEm" type="date" value={dataAprov} onChange={(e) => setDataAprov(e.target.value)} />
            </Campo>
            <Campo rotulo="Entrega prometida" htmlFor="prazoEm">
              <Input id="prazoEm" type="date" value={prazo} min={dataAprov} onChange={(e) => setPrazo(e.target.value)} />
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button disabled={pendente} onClick={() => rodar(() => emitirPedidoAction(pedido.id, { dataEmissao: dataAprov, prazoPrometido: prazo }), (n) => `Pedido ${n} emitido`)}>
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entrega */}
      <Dialog open={dialogo === "entrega"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
            <DialogDescription>A data real define a pontualidade do fornecedor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Campo rotulo="Data em que chegou na obra" htmlFor="dataEnt">
              <Input id="dataEnt" type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
            </Campo>
            <div className="grid gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <Checkbox checked={parcial} onCheckedChange={(v) => setParcial(!!v)} /> Entrega parcial (ainda falta material)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <Checkbox checked={!conforme} onCheckedChange={(v) => setConforme(!v)} /> Não conforme (avaria, faltou, errado)
              </label>
            </div>
            <Campo rotulo="Observação" htmlFor="obsEnt">
              <Textarea id="obsEnt" rows={2} value={obsEntrega} onChange={(e) => setObsEntrega(e.target.value)} placeholder="Ex.: 3 sacos rasgados, NF 12345" />
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              disabled={pendente}
              onClick={() =>
                rodar(
                  () => registrarEntregaAction(pedido.id, { dataReal: dataEntrega, parcial, conforme, observacao: obsEntrega }),
                  () => (parcial ? "Entrega parcial registrada" : "Entrega concluída"),
                  () => !parcial && setTimeout(() => setDialogo("avaliar"), 250),
                )
              }
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avaliar */}
      <Dialog open={dialogo === "avaliar"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Como foi este fornecedor?</DialogTitle>
            <DialogDescription>Leva 10 segundos e alimenta o ranking de fornecedores.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(
              [
                ["preco", "Preço"],
                ["prazo", "Prazo"],
                ["qualidade", "Qualidade"],
                ["atendimento", "Atendimento"],
              ] as const
            ).map(([k, rot]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium">{rot}</span>
                <div className="flex gap-1" role="radiogroup" aria-label={rot}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={notas[k] === n}
                      aria-label={`${n} de 5`}
                      onClick={() => setNotas((s) => ({ ...s, [k]: n }))}
                      className="cursor-pointer rounded p-0.5 transition-transform hover:scale-110"
                    >
                      <StarIcon className={cn("size-6", n <= notas[k] ? "fill-st-atencao text-st-atencao" : "text-muted-foreground/30")} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentário (opcional)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fechar}>
              Depois
            </Button>
            <Button disabled={pendente || Object.values(notas).some((n) => n === 0)} onClick={() => rodar(() => avaliarFornecedorAction(pedido.id, { ...notas, comentario }), () => "Avaliação salva")}>
              Salvar avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={dialogo === "cancelar"} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>A requisição volta para a fase de cotação, e você pode escolher outro vencedor.</DialogDescription>
          </DialogHeader>
          <Campo rotulo="Motivo" htmlFor="motivo">
            <Textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: fornecedor não confirmou o prazo" />
          </Campo>
          <DialogFooter>
            <Button variant="outline" onClick={fechar}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={pendente} onClick={() => rodar(
                  () => cancelarPedidoAction(pedido.id, motivo),
                  (d) => {
                    const saldo = (d as { saldoId: number | null } | undefined)?.saldoId;
                    return saldo ? `Pedido cancelado. Os itens foram para a requisição #${saldo}, para cotar de novo.` : "Pedido cancelado";
                  },
                )}>
              Cancelar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

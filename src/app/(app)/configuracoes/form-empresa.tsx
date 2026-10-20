"use client";

import { aoEnviar } from "@/lib/form";
import { useTransition } from "react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigEmpresa } from "@/db/schema";
import { formatarCnpj } from "@/lib/normalizar";
import { salvarEmpresaAction } from "@/server/actions/cadastros";

export function FormEmpresa({ empresa }: { empresa: ConfigEmpresa }) {
  const [pendente, iniciar] = useTransition();

  function enviar(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "");
    iniciar(async () => {
      const r = await salvarEmpresaAction({
        razaoSocial: v("razaoSocial"),
        nomeFantasia: v("nomeFantasia"),
        cnpj: v("cnpj"),
        endereco: v("endereco"),
        cidade: v("cidade"),
        telefone: v("telefone"),
        email: v("email"),
        comprador: v("comprador"),
        logoPath: v("logoPath"),
        rodapePedido: v("rodapePedido"),
      });
      if (r.ok) toast.success("Configurações salvas");
      else toast.error(r.erro);
    });
  }

  return (
    <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>Aparece no topo das impressões.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Razão social" htmlFor="razaoSocial">
              <Input id="razaoSocial" name="razaoSocial" defaultValue={empresa.razaoSocial} required />
            </Campo>
            <Campo rotulo="Nome fantasia" htmlFor="nomeFantasia">
              <Input id="nomeFantasia" name="nomeFantasia" defaultValue={empresa.nomeFantasia ?? ""} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <Campo rotulo="CNPJ" htmlFor="cnpj">
              <Input id="cnpj" name="cnpj" defaultValue={formatarCnpj(empresa.cnpj)} />
            </Campo>
            <Campo rotulo="Endereço" htmlFor="endereco">
              <Input id="endereco" name="endereco" defaultValue={empresa.endereco ?? ""} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Cidade – UF" htmlFor="cidade">
              <Input id="cidade" name="cidade" defaultValue={empresa.cidade ?? ""} />
            </Campo>
            <Campo rotulo="Telefone" htmlFor="telefone">
              <Input id="telefone" name="telefone" defaultValue={empresa.telefone ?? ""} />
            </Campo>
            <Campo rotulo="E-mail de compras" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={empresa.email ?? ""} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Comprador (assinatura)" htmlFor="comprador" dica="Usado nas mensagens de cotação e na assinatura do pedido.">
              <Input id="comprador" name="comprador" defaultValue={empresa.comprador ?? ""} />
            </Campo>
            <Campo rotulo="Logo (caminho)" htmlFor="logoPath" dica="Coloque o arquivo em ./public e informe /nome-do-arquivo.png">
              <Input id="logoPath" name="logoPath" defaultValue={empresa.logoPath ?? ""} placeholder="/logo.png" />
            </Campo>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pedido de compra</CardTitle>
            <CardDescription>Texto padrão no rodapé do pedido impresso.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea name="rodapePedido" rows={4} defaultValue={empresa.rodapePedido ?? ""} />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}

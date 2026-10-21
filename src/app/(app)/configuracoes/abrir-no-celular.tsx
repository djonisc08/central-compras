import QRCode from "qrcode";
import { SmartphoneIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { enderecosNaRede } from "@/server/rede";

/** QR Code para abrir o sistema no celular conectado no mesmo Wi-Fi. */
export async function AbrirNoCelular({ porta }: { porta: number }) {
  const enderecos = enderecosNaRede(porta);
  const principal = enderecos[0];
  const svg = principal ? await QRCode.toString(principal, { type: "svg", margin: 1, color: { dark: "#141414", light: "#ffffff" } }) : null;
  return (
    <Card className="mb-4">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <SmartphoneIcon className="size-4 text-marca-verde-escuro" /> Abrir no celular
          </CardTitle>
          <CardDescription>Com o celular no mesmo Wi-Fi deste computador, aponte a câmera para o código.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
        {svg ? (
          <div className="size-44 rounded-lg border bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p className="text-[13px] text-st-atencao">Este computador não está conectado a uma rede.</p>
        )}
        <div className="grid gap-2 text-[13px]">
          {principal && (
            <div>
              Endereço: <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">{principal}</code>
              {enderecos.length > 1 && <span className="text-xs text-muted-foreground"> (outros: {enderecos.slice(1).join(", ")})</span>}
            </div>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Abra a câmera do celular e toque no link que aparecer.</li>
            <li>
              Para virar app: no Chrome (Android), menu ⋮ → <strong>Adicionar à tela inicial</strong>; no iPhone (Safari), Compartilhar →{" "}
              <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>Funciona tudo: colar pedido, cotar e enviar no WhatsApp (abre o app direto), aprovar, ver PDFs e anexar foto do orçamento.</li>
            <li>O notebook precisa estar ligado e no mesmo Wi-Fi. Se não abrir, libere o acesso no Windows (veja a ajuda abaixo).</li>
          </ol>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Não abriu no celular?</summary>
            <p className="mt-1">
              O Windows pode estar bloqueando. Peça ao Claude no PC: <em>“libera a Central de Compras no firewall para o celular”</em>, ou abra o
              PowerShell como administrador e rode:
            </p>
            <code className="mt-1 block rounded bg-muted p-2 break-all">
              New-NetFirewallRule -DisplayName &quot;Central de Compras&quot; -Direction Inbound -LocalPort {porta} -Protocol TCP -Action Allow -Profile Private
            </code>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

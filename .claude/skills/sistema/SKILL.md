---
name: sistema
description: Liga, reinicia, atualiza ou diagnostica a Central de Compras no Windows do usuário. Use quando disserem "reinicia o sistema", "não abre o localhost", "atualiza o sistema", "deu erro na tela", "pega a versão nova".
---

# Manutenção da Central de Compras (Windows)

O servidor roda **escondido** (sem janela), ligado por `Central de Compras.vbs` na inicialização do Windows. Porta 3000.

| Pedido | Comando (PowerShell, na pasta do projeto) |
|---|---|
| Reiniciar / "não abre" | `powershell -ExecutionPolicy Bypass -File .\reiniciar.ps1` |
| Atualizar (versão nova do GitHub) | `powershell -ExecutionPolicy Bypass -File .\atualizar.ps1` |
| Recriar atalhos | `powershell -ExecutionPolicy Bypass -File .\instalar-atalhos.ps1` |
| Liberar acesso pelo celular (firewall) | `powershell -ExecutionPolicy Bypass -File .\liberar-celular.ps1` (pede administrador) |
| Ver erro do servidor | `Get-Content data\servidor.log -Tail 60` |

Diagnóstico, nesta ordem:
1. `reiniciar.ps1` — resolve quase tudo. Ele termina dizendo "no ar" ou aponta o log.
2. Se falhar, leia `data\servidor.log`. Erro de módulo/dependência → `npm install` e reinicie. Erro de banco → **não apague nada**; faça `npm run backup` e explique ao usuário.
3. Porta 3000 ocupada por outro programa → `Get-NetTCPConnection -LocalPort 3000` para identificar e pergunte antes de encerrar.

Celular: mesmo Wi-Fi, endereço e QR Code em Configurações → Abrir no celular. Se a rede do Windows estiver como "Pública", peça ao usuário para mudar para "Privada" (Configurações do Windows → Rede → Propriedades).

Nunca rode `seed --reset` nem `iniciar:real` (apagam os dados). Atualizar o programa nunca mexe em `data/compras.db`.
Responda em português simples: quem usa não é técnico.

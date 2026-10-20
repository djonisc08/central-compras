# Central de Compras

Sistema pessoal do comprador da construtora: **requisições das obras → cotação → mapa comparativo → pedido → entrega → indicadores**.
Roda 100% no seu computador, sem mensalidade e sem chave de API. A "IA" é o Claude Code, por meio das skills do projeto.

> **Status:** Sprints 1 e 2 concluídas (cadastros, cotação, mapa, pedidos, aprovação, entregas, avaliação, relatório mensal e as 4 skills do Claude Code).
> Sprint 3 (painel de KPIs com gráficos, histórico de preço por material e ranking de fornecedores) vem a seguir.

---

## 1. Instalação (uma vez só)

Pré-requisito: **Node.js 20 ou maior** ([nodejs.org](https://nodejs.org)). Confira com `node -v`.

```bash
cd central-compras
npm install
npm run seed      # opcional: obras da MAX + fornecedores de exemplo + 6 meses de histórico + a cotação real dos vasos
npm run dev
```

Abra **http://localhost:3000**.

O banco fica em `data/compras.db` e é criado sozinho na primeira execução.

### Windows: passo a passo

Use o **PowerShell normal** (não precisa ser administrador):

```powershell
cd $HOME
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   # só na primeira vez; responda S
git clone https://github.com/djonisc08/central-compras.git
cd central-compras
npm install
npm run seed
npm run dev
```

- Não rode dentro de `C:\Windows\System32` (pasta protegida): por isso o `cd $HOME`.
- Para atualizar com as novidades: `cd $HOME\central-compras` e depois `git pull` e `npm install`.

### Abrir no celular (mesma rede Wi-Fi)

```bash
npm run dev:rede
```

Descubra o IP do computador (Windows: `ipconfig`; Mac/Linux: `ip a` ou Preferências de Rede) e abra no celular `http://SEU-IP:3000`, por exemplo `http://192.168.0.15:3000`.
Se o Windows perguntar, **permita o Node.js no firewall** para redes privadas.

> Para uso diário mais rápido: `npm run build` uma vez e depois `npm start` (já escuta na rede).

---

## 2. Rotina diária (fluxo recomendado)

### a) Chegou pedido da obra no WhatsApp
1. **Requisições → Nova requisição** (ou o botão no Painel).
2. Escolha a obra, quem pediu e **até quando precisa**. Se a data for hoje ou amanhã, o sistema já marca **Urgente**.
3. Nos itens, digite **como a obra escreve** ("cp2", "ferro 3/8", "fio 2,5"): a busca entende os **sinônimos** do catálogo.
   - **Enter** na quantidade abre a próxima linha.
   - Não achou? Use **Cadastrar "…"** direto da busca.
4. Opcional: cole a mensagem original do WhatsApp (fica guardada para consulta).

### b) Pedir cotação
Na página da requisição, o card **Pedir cotação** lista os fornecedores das categorias dos itens.
- **PDF da solicitação**: documento A4 com os **dados de faturamento da obra** (razão social, CNPJ, CNO, endereço de entrega e CEP), os itens e campos para o fornecedor preencher (preço, marca, frete, IPI, desconto à vista, prazo e a partir de quando conta, validade). No menu **⋯** de cada fornecedor sai a versão personalizada ("Para: Roca / Celite").
- **Planilha p/ preencher**: Excel com células amarelas para o fornecedor preencher e devolver. Ela carrega os IDs ocultos para a skill `importar-orcamento` (Sprint 2) ler a resposta **sem digitar nada**.
- Ícone verde: abre o WhatsApp do fornecedor **com a mensagem pronta**, já com os dados de faturamento.
- Ícone de copiar: copia o texto para colar onde quiser.

### c) Lançar as respostas
**Lançar proposta** → escolha o fornecedor → preencha frete, prazo, pagamento, validade e o **preço unitário** de cada item.
- **Enter** pula para o próximo preço.
- O sistema mostra o total na hora e quanto o preço **variou em relação à última compra**.
- Item que o fornecedor não tem: marque **Não tem**.
- Lançar de novo para o mesmo fornecedor substitui a proposta anterior.

### d) Decidir no mapa comparativo
**Mapa comparativo** mostra itens × fornecedores:
- **Verde** = menor preço do item. **Contorno + ✓** = vencedor escolhido.
- **Toque no preço** para marcar/desmarcar o vencedor do item.
- **Marcar menores preços**: escolhe o menor de cada item (desempate pelo menor frete).
- **Vencer tudo**: dá todos os itens a um fornecedor (útil quando o frete único compensa).
- Os cards do topo comparam **"Melhor fornecedor único"** × **"Menor preço por item"** (já com fretes), para você ver se vale dividir a compra.
- **Economia na cotação** = maior cotação − escolhida. Passe o mouse no ⓘ para ver a fórmula.
- **À vista / antecipado**: total com o desconto informado pelo fornecedor.
- **Chega até a data?**: previsão de entrega (hoje + prazo) comparada com a necessidade da obra. Se o mais barato não chega a tempo, um aviso vermelho mostra a melhor opção que chega, com botão para escolher.
- Proposta **sem IPI** ganha selo amarelo: confira antes de comparar.
- Validade vencida aparece em vermelho.

Quando todos os itens têm vencedor, a requisição vai para **Aguardando aprovação**.

### e) Imprimir / PDF / Excel
- **Imprimir**: abre o mapa em A4 com os dados de faturamento, a **sugestão de compra** escrita pelo sistema e o bloco de **aprovação** (Compras, Engenharia, Financeiro, Diretoria). Use **Salvar como PDF** na janela de impressão.
- **Excel**: baixa o mapa com destaques e uma aba de dados "longa" (boa para tabela dinâmica).
- **Fornecedores → Exportar cadastros**: planilha com fornecedores, materiais, obras e categorias (base limpa para importar no Sienge).

### f) Gerar o pedido
Com todos os itens com vencedor, aparece no mapa o botão verde **Gerar pedido**:
- Um pedido por fornecedor vencedor. Escolha **à vista** (aplica o desconto da proposta) ou **a prazo**; o sistema mostra quanto economiza.
- O pedido nasce **aguardando aprovação** (sem número).

### g) Aprovar e emitir
Em **Pedidos → abrir o pedido → Aprovar**:
- Registre **quem aprovou** (Diretoria, Engenharia, Financeiro…) e a data.
- Com **Emitir agora** ligado, o número **PC-AAAA-0001** é gerado na hora e a data de entrega prometida é calculada pelo prazo da proposta (ajustável).
- **PDF do pedido**: A4 com faturamento da obra (razão social, CNPJ, CNO), local de entrega, itens, desconto, frete, condições e rodapé padrão.
- **Enviar ao fornecedor**: abre o WhatsApp com o resumo do pedido (anexe o PDF).

### h) Entrega e avaliação
- **Registrar entrega**: data real, parcial ou final, conforme ou não conforme, observação (ex.: "3 sacos rasgados").
- Pedido atrasado ganha alerta vermelho no pedido, na lista e no painel.
- Ao concluir a entrega, o sistema pede a **avaliação** do fornecedor (preço, prazo, qualidade, atendimento — 1 a 5). Leva 10 segundos e alimenta o ranking.
- Cancelou um pedido? A requisição volta para a cotação e você pode escolher outro vencedor.

### i) Relatório do mês
**Painel → Relatório do mês** abre a página para imprimir/PDF com KPIs, destaques, alertas, gasto por obra, curva ABC, fornecedores e variação de preços. Excel completo em `/api/exportar/relatorio?mes=AAAA-MM` (ou peça ao Claude: skill `relatorio-mensal`).

---

## 3. Usando o Claude Code (skills)

Abra o Claude Code dentro da pasta do projeto (`cd central-compras` e depois `claude`) e fale normalmente. As skills cuidam do resto e **sempre mostram uma prévia e pedem seu OK antes de gravar**.

| Você diz | Skill | O que acontece |
|---|---|---|
| "Chegou pedido da 189: *(cola a mensagem)*" ou deixa o print em `./entrada` | **nova-requisicao** | Identifica obra, itens, quantidades e prazo; casa com o catálogo (sugere material novo se precisar); mostra a tabela; grava após o OK |
| "Manda cotação da requisição 126" | **mensagem-cotacao** | Mensagem de WhatsApp por fornecedor da categoria (com dados de faturamento), link wa.me, PDF e planilha para o fornecedor preencher |
| "Chegou o orçamento da Roca" (PDF/foto/texto em `./entrada`) | **importar-orcamento** | Lê o orçamento, confere item a item (quantidade, unidade, IPI, prazo, validade), mostra o total para bater com o documento e grava após o OK |
| "Importa a planilha que o fornecedor devolveu" | **importar-orcamento** | Lê a planilha da Central automaticamente, sem digitação |
| "Relatório de outubro para a diretoria" | **relatorio-mensal** | Excel + PDF + resumo executivo pronto para e-mail |

Pastas:
- `entrada/` — onde você joga prints, PDFs e planilhas recebidas. Depois de importados, vão para `entrada/processados/`.
- `entrada/rascunhos/` — rascunhos que o Claude monta para você conferir.
- `saida/` — mensagens, planilhas de cotação e relatórios gerados.
- `entrada/exemplos/` — exemplos de pedido de obra e orçamento para testar.

Comandos usados pelas skills (você também pode rodar):

| Comando | Para quê |
|---|---|
| `npm run ctx -- obras \| fornecedores \| materiais \| requisicoes \| requisicao 126 \| buscar "cp2"` | Consultas (somente leitura) |
| `npm run gravar:requisicao -- --arquivo <json> [--confirmar]` | Grava requisição (sem `--confirmar` = prévia) |
| `npm run gravar:proposta -- --arquivo <json> [--confirmar]` | Grava proposta |
| `npm run ler:planilha -- entrada/<arquivo>.xlsx [--confirmar]` | Importa a planilha devolvida pelo fornecedor |
| `npm run mensagem -- --requisicao 126 [--fornecedores 1,7]` | Kit de cotação em `saida/` |
| `npm run relatorio -- --mes 2026-10 [--json]` | Relatório mensal |

---

## 4. Cadastros

| Tela | Dica |
|---|---|
| **Obras** | Preencha os dados da **ficha cadastral**: razão social, CNPJ e CNO de faturamento, endereço de entrega e CEP. Eles vão para a mensagem de cotação, o PDF e o pedido. Cada obra pode ter CNPJ próprio (filial/SPE). |
| **Fornecedores** | CNPJ é validado e não pode repetir. As **categorias** definem quem recebe pedido de cotação. |
| **Materiais** | Nome **padronizado e completo** + unidade + categoria. Apelidos da obra vão em **sinônimos**. |
| **Configurações** | Razão social, CNPJ, endereço, logo e rodapé do pedido (aparecem nas impressões). |

---

## 5. Cuidados com os dados

- **Backup:** `npm run backup` copia o banco para `data/backups/` (mantém os 30 mais recentes). Faça ao fim do dia ou antes de mexer em algo grande.
- **Nunca edite `data/compras.db` na mão.** As skills e telas gravam por scripts validados.
- **Recomeçar com dados de exemplo:** `npm run seed -- --reset` (faz backup antes de apagar). Se o sistema estiver aberto, **pare e rode `npm run dev` de novo** depois do reset.
- Atualizações de estrutura do banco são aplicadas automaticamente ao abrir o sistema, sem perder dados.

---

## 6. Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o sistema em http://localhost:3000 |
| `npm run dev:rede` | Igual, mas acessível pelo celular na rede local |
| `npm run build` + `npm start` | Modo produção (mais rápido), já na rede |
| `npm run seed` / `-- --reset` | Dados de exemplo |
| `npm run backup` | Cópia de segurança do banco |
| `npm test` | Testes das fórmulas (saving, economia, mapa, sinônimos) |
| `npm run typecheck` / `npm run lint` | Verificações de código |

---

## 7. Fórmulas dos indicadores

| Indicador | Fórmula |
|---|---|
| **Saving** | (preço anterior pago − preço novo) × quantidade. Preço anterior = última compra do mesmo material em qualquer obra. Sem compra anterior, não conta. |
| **Cost avoidance (economia na cotação)** | (maior cotação − cotação fechada) × quantidade. Só com 2 ou mais cotações. |
| **Lead time** | data de emissão do pedido − data da requisição (dias corridos) |
| **% urgentes** | requisições urgentes ÷ total do período. Meta: < 5% |
| **Pontualidade** | entregas até o prazo prometido ÷ entregas |
| **Variação de preço** | preço médio do mês ÷ mês anterior − 1 (ponderado pela quantidade) |
| **Curva ABC** | A até 80% do gasto acumulado, B até 95%, C o restante |

---

## 8. Estrutura técnica (resumo)

- **Next.js 16 (App Router) + TypeScript + Tailwind 4 + componentes no padrão shadcn/ui (Radix)**
- **SQLite** (`better-sqlite3`) com **Drizzle ORM**; migrations em `src/db/migrations`
- Valores em **centavos** (sem erro de arredondamento) e datas `AAAA-MM-DD`
- `src/lib/kpis.ts` e `src/lib/mapa.ts`: fórmulas puras e testadas
- `src/server/dados/*`: regras de leitura/gravação compartilhadas entre telas e scripts das skills
- Detalhes para o Claude Code em `CLAUDE.md`

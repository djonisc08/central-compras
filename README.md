# Central de Compras

Sistema pessoal do comprador da construtora: **requisições das obras → cotação → mapa comparativo → pedido → entrega → indicadores**.
Roda 100% no seu computador, sem mensalidade e sem chave de API. A "IA" é o Claude Code, por meio das skills do projeto.

> **Status:** Sprint 1 concluída (cadastros, requisições, propostas, mapa comparativo, impressão e Excel).
> Sprint 2 (pedidos, aprovação, entregas, avaliações e skills) e Sprint 3 (KPIs, gráficos, ranking e relatório mensal) vêm a seguir.

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

---

## 3. Cadastros

| Tela | Dica |
|---|---|
| **Obras** | Preencha os dados da **ficha cadastral**: razão social, CNPJ e CNO de faturamento, endereço de entrega e CEP. Eles vão para a mensagem de cotação, o PDF e o pedido. Cada obra pode ter CNPJ próprio (filial/SPE). |
| **Fornecedores** | CNPJ é validado e não pode repetir. As **categorias** definem quem recebe pedido de cotação. |
| **Materiais** | Nome **padronizado e completo** + unidade + categoria. Apelidos da obra vão em **sinônimos**. |
| **Configurações** | Razão social, CNPJ, endereço, logo e rodapé do pedido (aparecem nas impressões). |

---

## 4. Cuidados com os dados

- **Backup:** `npm run backup` copia o banco para `data/backups/` (mantém os 30 mais recentes). Faça ao fim do dia ou antes de mexer em algo grande.
- **Nunca edite `data/compras.db` na mão.** As skills e telas gravam por scripts validados.
- **Recomeçar com dados de exemplo:** `npm run seed -- --reset` (faz backup antes de apagar). Se o sistema estiver aberto, **pare e rode `npm run dev` de novo** depois do reset.
- Atualizações de estrutura do banco são aplicadas automaticamente ao abrir o sistema, sem perder dados.

---

## 5. Comandos úteis

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

## 6. Fórmulas dos indicadores

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

## 7. Estrutura técnica (resumo)

- **Next.js 16 (App Router) + TypeScript + Tailwind 4 + componentes no padrão shadcn/ui (Radix)**
- **SQLite** (`better-sqlite3`) com **Drizzle ORM**; migrations em `src/db/migrations`
- Valores em **centavos** (sem erro de arredondamento) e datas `AAAA-MM-DD`
- `src/lib/kpis.ts` e `src/lib/mapa.ts`: fórmulas puras e testadas
- `src/server/dados/*`: regras de leitura/gravação compartilhadas entre telas e scripts das skills
- Detalhes para o Claude Code em `CLAUDE.md`

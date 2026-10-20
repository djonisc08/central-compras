@AGENTS.md

# Central de Compras — regras do projeto

Sistema pessoal do comprador de uma construtora. Roda local (Next.js + SQLite). Interface e textos sempre em **português do Brasil**.

## Regras de ouro para qualquer gravação
1. **Nunca edite `data/compras.db` diretamente** (nada de `sqlite3`, SQL manual ou scripts improvisados). Toda gravação passa pelos scripts em `./scripts` ou pelas telas.
2. **Sempre peça confirmação** ao usuário antes de gravar: gere o rascunho JSON em `entrada/rascunhos/`, rode o script **sem** `--confirmar` (prévia/validação), mostre a tabela e só depois rode **com** `--confirmar`.
3. Dinheiro em **centavos inteiros** (`preco_unitario_centavos`, `frete_centavos`). Datas em `AAAA-MM-DD`.
4. Validação fica em `src/lib/validacao.ts` (Zod) e é a mesma para telas e scripts — não duplique regras.
5. Fórmulas de KPI ficam só em `src/lib/kpis.ts`; o mapa comparativo em `src/lib/mapa.ts`.

## Estrutura
- `src/db/schema.ts` — schema Drizzle (migrations em `src/db/migrations`, aplicadas automaticamente ao abrir o banco).
- `src/server/dados/*` — leitura/gravação (recebem `db` por parâmetro; usados por telas e scripts).
- `src/server/actions/*` — Server Actions das telas (chamam `dados/*` e `refresh()`).
- `src/app/(app)` — telas com menu; `src/app/(impressao)` — páginas A4 para imprimir/PDF.
- `scripts/` — `seed.ts`, `backup.ts` e os scripts de gravação usados pelas skills.

## Skills do projeto (.claude/skills)
- `nova-requisicao`, `importar-orcamento`, `mensagem-cotacao`, `relatorio-mensal`.
- Scripts que elas usam: `npm run ctx`, `gravar:requisicao`, `gravar:proposta`, `ler:planilha`, `mensagem`, `relatorio` (detalhes no topo de cada arquivo em `scripts/`).
- Consultas: sempre `npm run --silent ctx -- ...` (JSON). Gravações: sempre prévia → OK do usuário → `--confirmar`.

## Comandos
- `npm run dev` (local) · `npm run dev:rede` (acesso pelo celular na rede)
- `npm run seed -- --reset` recria os dados de exemplo (faz backup antes)
- `npm run backup` · `npm test` · `npm run typecheck` · `npm run lint`
- Mudou o schema? `npm run db:gerar` para criar a migration.

## Next.js 16 neste projeto
- `cacheComponents` está **desligado** de propósito: toda página chama `await connection()` e lê o banco na hora.
- Após gravar numa Server Action, chame `refresh()` (de `next/cache`).

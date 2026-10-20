---
name: mensagem-cotacao
description: Gera o kit para pedir cotação de uma requisição — mensagem pronta de WhatsApp por fornecedor da categoria (com dados de faturamento da obra), link wa.me, PDF da solicitação e planilha para o fornecedor preencher e devolver. Use quando o usuário pedir "manda cotação", "mensagem para os fornecedores", "pedir preço" ou logo após criar uma requisição.
---

# Mensagem de cotação para fornecedores

Não grava nada no banco: só gera textos e arquivos em `saida/`.

## Passo a passo
1. **Identificar a requisição:** número informado pelo usuário, ou a mais recente em `npm run --silent ctx -- requisicoes`. Confirme se houver dúvida.
2. **Gerar o kit:**
   - Todos os fornecedores ativos das categorias dos itens: `npm run --silent mensagem -- --requisicao <id>`
   - Só alguns: `npm run --silent mensagem -- --requisicao <id> --fornecedores 3,7`
3. **Entregar ao usuário**, por fornecedor:
   - a mensagem pronta (leia em `saida/cotacao-<id>/mensagens.md`), em bloco de código para copiar;
   - o link do WhatsApp (abre a conversa com o texto);
   - o link do PDF (`/imprimir/cotacao/<id>?fornecedor=<f>`). No navegador, "Salvar como PDF" gera o arquivo;
   - a planilha `saida/cotacao-<id>/cotacao-<id>-<fornecedor>.xlsx`. Oriente: *"anexe a planilha; quando o fornecedor devolver preenchida, coloque em ./entrada e peça para importar"*.
4. **Ajustes que o usuário pode pedir:** tom mais formal ou curto, prazo de resposta, pedido de foto do produto, entrega fracionada. Edite o texto na conversa; não precisa rodar de novo.
5. **Alertas:**
   - Fornecedor sem WhatsApp cadastrado: avise e ofereça o texto para e-mail.
   - Requisição **urgente**: sugira ligar para os 2 fornecedores mais rápidos.
   - Nenhum fornecedor na categoria: sugira cadastrar um em Fornecedores.
6. **Próximo passo:** *"Quando chegarem os orçamentos, jogue em ./entrada que eu importo (skill importar-orcamento)."*

CREATE TABLE `avaliacoes_fornecedor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`preco` integer NOT NULL,
	`prazo` integer NOT NULL,
	`qualidade` integer NOT NULL,
	`atendimento` integer NOT NULL,
	`comentario` text,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avaliacoes_fornecedor_pedido_id_unique` ON `avaliacoes_fornecedor` (`pedido_id`);--> statement-breakpoint
CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_nome_unique` ON `categorias` (`nome`);--> statement-breakpoint
CREATE TABLE `config_empresa` (
	`id` integer PRIMARY KEY NOT NULL,
	`razao_social` text NOT NULL,
	`nome_fantasia` text,
	`cnpj` text,
	`endereco` text,
	`cidade` text,
	`telefone` text,
	`email` text,
	`comprador` text,
	`logo_path` text,
	`rodape_pedido` text
);
--> statement-breakpoint
CREATE TABLE `entregas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`data_real` text NOT NULL,
	`conforme` integer DEFAULT true NOT NULL,
	`parcial` integer DEFAULT false NOT NULL,
	`observacao` text,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fornecedor_categorias` (
	`fornecedor_id` integer NOT NULL,
	`categoria_id` integer NOT NULL,
	PRIMARY KEY(`fornecedor_id`, `categoria_id`),
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`cnpj` text,
	`contato` text,
	`whatsapp` text,
	`email` text,
	`cidade` text,
	`ativo` integer DEFAULT true NOT NULL,
	`observacoes` text,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fornecedores_cnpj_unique` ON `fornecedores` (`cnpj`);--> statement-breakpoint
CREATE TABLE `materiais` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome_padronizado` text NOT NULL,
	`unidade` text NOT NULL,
	`categoria_id` integer NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materiais_nome_padronizado_unique` ON `materiais` (`nome_padronizado`);--> statement-breakpoint
CREATE TABLE `material_sinonimos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`material_id` integer NOT NULL,
	`texto` text NOT NULL,
	`texto_normalizado` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materiais`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `material_sinonimos_texto_normalizado_unique` ON `material_sinonimos` (`texto_normalizado`);--> statement-breakpoint
CREATE INDEX `sinonimos_material_idx` ON `material_sinonimos` (`material_id`);--> statement-breakpoint
CREATE TABLE `obras` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`endereco` text,
	`engenheiro_responsavel` text,
	`status` text DEFAULT 'ativa' NOT NULL,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obras_nome_unique` ON `obras` (`nome`);--> statement-breakpoint
CREATE TABLE `pedido_itens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`requisicao_item_id` integer,
	`material_id` integer NOT NULL,
	`quantidade` real NOT NULL,
	`preco_unitario_centavos` integer NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requisicao_item_id`) REFERENCES `requisicao_itens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materiais`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pedido_itens_material_idx` ON `pedido_itens` (`material_id`);--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` text,
	`requisicao_id` integer NOT NULL,
	`fornecedor_id` integer NOT NULL,
	`proposta_id` integer,
	`valor_total_centavos` integer NOT NULL,
	`frete_centavos` integer DEFAULT 0 NOT NULL,
	`condicao_pagamento` text,
	`aprovado_por` text,
	`data_aprovacao` text,
	`data_emissao` text,
	`prazo_prometido` text,
	`status` text DEFAULT 'aguardando_aprovacao' NOT NULL,
	`observacoes` text,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposta_id`) REFERENCES `propostas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pedidos_numero_unique` ON `pedidos` (`numero`);--> statement-breakpoint
CREATE INDEX `pedidos_status_idx` ON `pedidos` (`status`);--> statement-breakpoint
CREATE INDEX `pedidos_fornecedor_idx` ON `pedidos` (`fornecedor_id`);--> statement-breakpoint
CREATE TABLE `proposta_itens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposta_id` integer NOT NULL,
	`requisicao_item_id` integer NOT NULL,
	`preco_unitario_centavos` integer NOT NULL,
	`marca` text,
	`disponivel` integer DEFAULT true NOT NULL,
	`vencedora` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`proposta_id`) REFERENCES `propostas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requisicao_item_id`) REFERENCES `requisicao_itens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposta_itens_uq` ON `proposta_itens` (`proposta_id`,`requisicao_item_id`);--> statement-breakpoint
CREATE INDEX `proposta_itens_item_idx` ON `proposta_itens` (`requisicao_item_id`);--> statement-breakpoint
CREATE TABLE `propostas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requisicao_id` integer NOT NULL,
	`fornecedor_id` integer NOT NULL,
	`frete_centavos` integer DEFAULT 0 NOT NULL,
	`condicao_pagamento` text,
	`prazo_entrega_dias` integer,
	`validade` text,
	`data_cotacao` text NOT NULL,
	`arquivo_origem` text,
	`observacoes` text,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `propostas_req_forn_uq` ON `propostas` (`requisicao_id`,`fornecedor_id`);--> statement-breakpoint
CREATE TABLE `requisicao_itens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requisicao_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`quantidade` real NOT NULL,
	`especificacao` text,
	FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `materiais`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `req_itens_req_idx` ON `requisicao_itens` (`requisicao_id`);--> statement-breakpoint
CREATE TABLE `requisicoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`obra_id` integer NOT NULL,
	`solicitante` text NOT NULL,
	`data_pedido` text NOT NULL,
	`data_necessidade` text NOT NULL,
	`urgente` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'aberta' NOT NULL,
	`origem_texto` text,
	`observacoes` text,
	`criado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requisicoes_status_idx` ON `requisicoes` (`status`);--> statement-breakpoint
CREATE INDEX `requisicoes_obra_idx` ON `requisicoes` (`obra_id`);
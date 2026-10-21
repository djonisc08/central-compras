CREATE TABLE `cotacao_envios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requisicao_id` integer NOT NULL,
	`fornecedor_id` integer NOT NULL,
	`enviado_em` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	`cobrado_em` text,
	`qtd_itens` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cotacao_envios_req_forn_idx` ON `cotacao_envios` (`requisicao_id`,`fornecedor_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `categorias` (`nome`) VALUES ('Refrigeração');
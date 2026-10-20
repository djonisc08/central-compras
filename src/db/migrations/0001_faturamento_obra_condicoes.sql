ALTER TABLE `obras` ADD `cep` text;--> statement-breakpoint
ALTER TABLE `obras` ADD `razao_social` text;--> statement-breakpoint
ALTER TABLE `obras` ADD `cnpj` text;--> statement-breakpoint
ALTER TABLE `obras` ADD `cno` text;--> statement-breakpoint
ALTER TABLE `propostas` ADD `desconto_a_vista_bp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `propostas` ADD `prazo_observacao` text;--> statement-breakpoint
ALTER TABLE `propostas` ADD `impostos_inclusos` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `propostas` ADD `numero_orcamento` text;--> statement-breakpoint
ALTER TABLE `propostas` ADD `vendedor` text;
DROP INDEX `fornecedores_cnpj_unique`;--> statement-breakpoint
CREATE INDEX `fornecedores_cnpj_idx` ON `fornecedores` (`cnpj`);
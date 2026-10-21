ALTER TABLE `pedido_itens` ADD `total_centavos` integer;--> statement-breakpoint
ALTER TABLE `proposta_itens` ADD `total_centavos` integer;--> statement-breakpoint
ALTER TABLE `proposta_itens` ADD `quantidade_cotada` real;--> statement-breakpoint
ALTER TABLE `proposta_itens` ADD `unidade_cotada` text;--> statement-breakpoint
ALTER TABLE `propostas` ADD `total_documento_centavos` integer;
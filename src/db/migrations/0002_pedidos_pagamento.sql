ALTER TABLE `pedidos` ADD `forma_pagamento` text DEFAULT 'prazo' NOT NULL;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `desconto_bp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `prazo_entrega_dias` integer;--> statement-breakpoint
ALTER TABLE `pedidos` ADD `motivo_cancelamento` text;
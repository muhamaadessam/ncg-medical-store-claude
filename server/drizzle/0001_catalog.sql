CREATE TABLE `brands` (
	`id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` char(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `pricing_tiers` (
	`id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`label` varchar(60) NOT NULL,
	`units_per_bundle` int NOT NULL,
	`bundle_price` decimal(10,3) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `pricing_tiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_tiers_product_units_unique` UNIQUE(`product_id`,`units_per_bundle`),
	CONSTRAINT `pricing_tiers_units_positive` CHECK(units_per_bundle > 0),
	CONSTRAINT `pricing_tiers_price_positive` CHECK(bundle_price > 0)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`url` varchar(500) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`brand_id` char(36) NOT NULL,
	`category_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pricing_tiers` ADD CONSTRAINT `pricing_tiers_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_created_at_idx` ON `products` (`created_at`);
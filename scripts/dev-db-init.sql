-- Runs once when the local Docker database is first created.
CREATE DATABASE IF NOT EXISTS ncg_pharmacy_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ncg_pharmacy_test.* TO 'ncg'@'%';
FLUSH PRIVILEGES;

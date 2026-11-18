-- Make every table created by later migrations utf8mb4 (cPanel databases often default to latin1).
-- Applies to the current database; the cPanel DB user has ALTER on it via "ALL PRIVILEGES".
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

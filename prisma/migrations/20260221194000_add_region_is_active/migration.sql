-- Add region activation flag for selective regional operations.

SET @col_isActive_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Region'
    AND COLUMN_NAME = 'isActive'
);
SET @sql_add_isActive := IF(
  @col_isActive_exists = 0,
  'ALTER TABLE `Region` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true',
  'SELECT 1'
);
PREPARE stmt_isActive FROM @sql_add_isActive;
EXECUTE stmt_isActive;
DEALLOCATE PREPARE stmt_isActive;


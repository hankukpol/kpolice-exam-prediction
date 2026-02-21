-- Add region activation flag for selective regional operations.

ALTER TABLE `Region`
  ADD COLUMN IF NOT EXISTS `isActive` BOOLEAN NOT NULL DEFAULT true;


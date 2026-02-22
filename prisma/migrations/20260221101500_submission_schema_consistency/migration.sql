-- Align Submission table shape for environments created before edit support landed.

-- ADD COLUMN only if not already present (MySQL-compatible)
SET @col_editCount_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Submission'
    AND COLUMN_NAME = 'editCount'
);
SET @sql_add_editCount := IF(
  @col_editCount_exists = 0,
  'ALTER TABLE `Submission` ADD COLUMN `editCount` INTEGER NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt_editCount FROM @sql_add_editCount;
EXECUTE stmt_editCount;
DEALLOCATE PREPARE stmt_editCount;

SET @col_updatedAt_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Submission'
    AND COLUMN_NAME = 'updatedAt'
);
SET @sql_add_updatedAt := IF(
  @col_updatedAt_exists = 0,
  'ALTER TABLE `Submission` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
  'SELECT 1'
);
PREPARE stmt_updatedAt FROM @sql_add_updatedAt;
EXECUTE stmt_updatedAt;
DEALLOCATE PREPARE stmt_updatedAt;

ALTER TABLE `Submission`
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

SET @idx_submission_region_type_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Submission'
    AND INDEX_NAME = 'Submission_examId_regionId_examType_idx'
);

SET @sql_add_idx_submission_region_type := IF(
  @idx_submission_region_type_exists = 0,
  'CREATE INDEX `Submission_examId_regionId_examType_idx` ON `Submission`(`examId`, `regionId`, `examType`)',
  'SELECT 1'
);
PREPARE stmt_add_idx_submission_region_type FROM @sql_add_idx_submission_region_type;
EXECUTE stmt_add_idx_submission_region_type;
DEALLOCATE PREPARE stmt_add_idx_submission_region_type;

SET @idx_submission_exam_type_score_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Submission'
    AND INDEX_NAME = 'Submission_examId_examType_finalScore_idx'
);

SET @sql_add_idx_submission_exam_type_score := IF(
  @idx_submission_exam_type_score_exists = 0,
  'CREATE INDEX `Submission_examId_examType_finalScore_idx` ON `Submission`(`examId`, `examType`, `finalScore`)',
  'SELECT 1'
);
PREPARE stmt_add_idx_submission_exam_type_score FROM @sql_add_idx_submission_exam_type_score;
EXECUTE stmt_add_idx_submission_exam_type_score;
DEALLOCATE PREPARE stmt_add_idx_submission_exam_type_score;


-- Align Submission table shape for environments created before edit support landed.

ALTER TABLE `Submission`
  ADD COLUMN IF NOT EXISTS `editCount` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `Submission`
  ADD COLUMN IF NOT EXISTS `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

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


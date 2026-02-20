-- CreateTable
CREATE TABLE `RescoreEvent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `examId` INTEGER NOT NULL,
  `examType` ENUM('PUBLIC', 'CAREER') NOT NULL,
  `reason` TEXT NULL,
  `summary` TEXT NOT NULL,
  `createdBy` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `RescoreEvent_examId_createdAt_idx`(`examId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RescoreDetail` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `rescoreEventId` INTEGER NOT NULL,
  `submissionId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `oldTotalScore` DOUBLE NOT NULL,
  `newTotalScore` DOUBLE NOT NULL,
  `oldFinalScore` DOUBLE NOT NULL,
  `newFinalScore` DOUBLE NOT NULL,
  `oldRank` INTEGER NULL,
  `newRank` INTEGER NULL,
  `scoreDelta` DOUBLE NOT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `RescoreDetail_rescoreEventId_submissionId_key`(`rescoreEventId`, `submissionId`),
  INDEX `RescoreDetail_userId_isRead_idx`(`userId`, `isRead`),
  INDEX `RescoreDetail_submissionId_idx`(`submissionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PassCutRelease` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `examId` INTEGER NOT NULL,
  `releaseNumber` INTEGER NOT NULL,
  `releasedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `participantCount` INTEGER NOT NULL,
  `createdBy` INTEGER NOT NULL,
  `memo` TEXT NULL,

  UNIQUE INDEX `PassCutRelease_examId_releaseNumber_key`(`examId`, `releaseNumber`),
  INDEX `PassCutRelease_examId_idx`(`examId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PassCutSnapshot` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `passCutReleaseId` INTEGER NOT NULL,
  `regionId` INTEGER NOT NULL,
  `examType` ENUM('PUBLIC', 'CAREER') NOT NULL,
  `participantCount` INTEGER NOT NULL,
  `recruitCount` INTEGER NOT NULL,
  `averageScore` DOUBLE NULL,
  `oneMultipleCutScore` DOUBLE NULL,
  `sureMinScore` DOUBLE NULL,
  `likelyMinScore` DOUBLE NULL,
  `possibleMinScore` DOUBLE NULL,

  UNIQUE INDEX `PassCutSnapshot_passCutReleaseId_regionId_examType_key`(`passCutReleaseId`, `regionId`, `examType`),
  INDEX `PassCutSnapshot_passCutReleaseId_idx`(`passCutReleaseId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinalPrediction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `submissionId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `fitnessScore` DOUBLE NULL,
  `interviewScore` DOUBLE NULL,
  `interviewGrade` VARCHAR(191) NULL,
  `finalScore` DOUBLE NULL,
  `finalRank` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `FinalPrediction_submissionId_key`(`submissionId`),
  INDEX `FinalPrediction_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RescoreEvent`
  ADD CONSTRAINT `RescoreEvent_examId_fkey`
  FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RescoreEvent`
  ADD CONSTRAINT `RescoreEvent_createdBy_fkey`
  FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RescoreDetail`
  ADD CONSTRAINT `RescoreDetail_rescoreEventId_fkey`
  FOREIGN KEY (`rescoreEventId`) REFERENCES `RescoreEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RescoreDetail`
  ADD CONSTRAINT `RescoreDetail_submissionId_fkey`
  FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RescoreDetail`
  ADD CONSTRAINT `RescoreDetail_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassCutRelease`
  ADD CONSTRAINT `PassCutRelease_examId_fkey`
  FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassCutRelease`
  ADD CONSTRAINT `PassCutRelease_createdBy_fkey`
  FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassCutSnapshot`
  ADD CONSTRAINT `PassCutSnapshot_passCutReleaseId_fkey`
  FOREIGN KEY (`passCutReleaseId`) REFERENCES `PassCutRelease`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassCutSnapshot`
  ADD CONSTRAINT `PassCutSnapshot_regionId_fkey`
  FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalPrediction`
  ADD CONSTRAINT `FinalPrediction_submissionId_fkey`
  FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalPrediction`
  ADD CONSTRAINT `FinalPrediction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

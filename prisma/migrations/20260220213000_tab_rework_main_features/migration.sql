-- Add applicant counts to Region for actual applicant numbers by exam type.
ALTER TABLE `Region`
  ADD COLUMN `applicantCount` INTEGER NULL,
  ADD COLUMN `applicantCountCareer` INTEGER NULL;

-- Expand difficulty rating to 5 levels.
ALTER TABLE `DifficultyRating`
  MODIFY COLUMN `rating` ENUM('VERY_EASY','EASY','NORMAL','HARD','VERY_HARD') NOT NULL;

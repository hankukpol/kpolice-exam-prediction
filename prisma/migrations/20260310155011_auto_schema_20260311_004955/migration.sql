-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('PUBLIC', 'CAREER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('NONE', 'VETERAN_5', 'VETERAN_10', 'HERO_3', 'HERO_5');

-- CreateEnum
CREATE TYPE "DifficultyRatingLevel" AS ENUM ('VERY_EASY', 'EASY', 'NORMAL', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "PassCutSnapshotStatus" AS ENUM ('READY', 'COLLECTING_LOW_PARTICIPATION', 'COLLECTING_UNSTABLE', 'COLLECTING_MISSING_APPLICANT_COUNT', 'COLLECTING_INSUFFICIENT_SAMPLE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termsAgreedAt" TIMESTAMP(3),
    "privacyAgreedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_region_quotas" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "recruitCount" INTEGER NOT NULL,
    "recruitCountCareer" INTEGER NOT NULL,
    "applicantCount" INTEGER,
    "applicantCountCareer" INTEGER,
    "examNumberStart" TEXT,
    "examNumberEnd" TEXT,
    "examNumberStartCareer" TEXT,
    "examNumberEndCareer" TEXT,

    CONSTRAINT "exam_region_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "pointPerQuestion" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "examType" "ExamType" NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerKey" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnswerKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerKeyLog" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "examType" "ExamType" NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "oldAnswer" INTEGER,
    "newAnswer" INTEGER NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerKeyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "examType" "ExamType" NOT NULL,
    "gender" "Gender" NOT NULL,
    "examNumber" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "bonusType" "BonusType" NOT NULL DEFAULT 'NONE',
    "bonusRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "submitDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreRegistration" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "examType" "ExamType" NOT NULL,
    "gender" "Gender" NOT NULL,
    "examNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnswer" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "selectedAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "UserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectScore" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "isFailed" BOOLEAN NOT NULL,

    CONSTRAINT "SubjectScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" SERIAL NOT NULL,
    "zone" TEXT NOT NULL,
    "imageUrl" TEXT,
    "mobileImageUrl" TEXT,
    "linkUrl" TEXT,
    "altText" TEXT NOT NULL DEFAULT '',
    "htmlContent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSection" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DifficultyRating" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "rating" "DifficultyRatingLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DifficultyRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescoreEvent" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "examType" "ExamType" NOT NULL,
    "reason" TEXT,
    "summary" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescoreDetail" (
    "id" SERIAL NOT NULL,
    "rescoreEventId" INTEGER NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "oldTotalScore" DOUBLE PRECISION NOT NULL,
    "newTotalScore" DOUBLE PRECISION NOT NULL,
    "oldFinalScore" DOUBLE PRECISION NOT NULL,
    "newFinalScore" DOUBLE PRECISION NOT NULL,
    "oldRank" INTEGER,
    "newRank" INTEGER,
    "scoreDelta" DOUBLE PRECISION NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescoreDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassCutRelease" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "releaseNumber" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantCount" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "memo" TEXT,

    CONSTRAINT "PassCutRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassCutSnapshot" (
    "id" SERIAL NOT NULL,
    "passCutReleaseId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,
    "examType" "ExamType" NOT NULL,
    "status" "PassCutSnapshotStatus" NOT NULL DEFAULT 'READY',
    "statusReason" TEXT,
    "applicantCount" INTEGER,
    "targetParticipantCount" INTEGER,
    "coverageRate" DOUBLE PRECISION,
    "stabilityScore" DOUBLE PRECISION,
    "participantCount" INTEGER NOT NULL,
    "recruitCount" INTEGER NOT NULL,
    "averageScore" DOUBLE PRECISION,
    "oneMultipleCutScore" DOUBLE PRECISION,
    "sureMinScore" DOUBLE PRECISION,
    "likelyMinScore" DOUBLE PRECISION,
    "possibleMinScore" DOUBLE PRECISION,

    CONSTRAINT "PassCutSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalPrediction" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "fitnessScore" DOUBLE PRECISION,
    "interviewScore" DOUBLE PRECISION,
    "interviewGrade" TEXT,
    "finalScore" DOUBLE PRECISION,
    "finalRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionLog" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "submitDurationMs" INTEGER,
    "changedFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "requestedAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_logs" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "userId" INTEGER,
    "anonymousId" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimitBucket" (
    "id" SERIAL NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_year_round_key" ON "Exam"("year", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exam_region_quotas_examId_regionId_key" ON "exam_region_quotas"("examId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_examType_key" ON "Subject"("name", "examType");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerKey_examId_subjectId_questionNumber_key" ON "AnswerKey"("examId", "subjectId", "questionNumber");

-- CreateIndex
CREATE INDEX "AnswerKeyLog_examId_examType_createdAt_idx" ON "AnswerKeyLog"("examId", "examType", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerKeyLog_subjectId_questionNumber_idx" ON "AnswerKeyLog"("subjectId", "questionNumber");

-- CreateIndex
CREATE INDEX "Submission_examId_regionId_examType_idx" ON "Submission"("examId", "regionId", "examType");

-- CreateIndex
CREATE INDEX "Submission_examId_examType_finalScore_idx" ON "Submission"("examId", "examType", "finalScore");

-- CreateIndex
CREATE INDEX "Submission_examId_regionId_examType_isSuspicious_idx" ON "Submission"("examId", "regionId", "examType", "isSuspicious");

-- CreateIndex
CREATE INDEX "Submission_examId_createdAt_idx" ON "Submission"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_examId_regionId_examType_finalScore_idx" ON "Submission"("examId", "regionId", "examType", "finalScore");

-- CreateIndex
CREATE INDEX "Submission_examId_regionId_examType_totalScore_idx" ON "Submission"("examId", "regionId", "examType", "totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_userId_examId_key" ON "Submission"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_examId_regionId_examNumber_key" ON "Submission"("examId", "regionId", "examNumber");

-- CreateIndex
CREATE INDEX "PreRegistration_examId_regionId_examType_idx" ON "PreRegistration"("examId", "regionId", "examType");

-- CreateIndex
CREATE UNIQUE INDEX "PreRegistration_userId_examId_key" ON "PreRegistration"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "PreRegistration_examId_regionId_examNumber_key" ON "PreRegistration"("examId", "regionId", "examNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswer_submissionId_subjectId_questionNumber_key" ON "UserAnswer"("submissionId", "subjectId", "questionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectScore_submissionId_subjectId_key" ON "SubjectScore"("submissionId", "subjectId");

-- CreateIndex
CREATE INDEX "Comment_examId_createdAt_idx" ON "Comment"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- CreateIndex
CREATE INDEX "Banner_zone_isActive_idx" ON "Banner"("zone", "isActive");

-- CreateIndex
CREATE INDEX "DifficultyRating_subjectId_rating_idx" ON "DifficultyRating"("subjectId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyRating_submissionId_subjectId_key" ON "DifficultyRating"("submissionId", "subjectId");

-- CreateIndex
CREATE INDEX "RescoreEvent_examId_createdAt_idx" ON "RescoreEvent"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "RescoreDetail_userId_isRead_idx" ON "RescoreDetail"("userId", "isRead");

-- CreateIndex
CREATE INDEX "RescoreDetail_submissionId_idx" ON "RescoreDetail"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RescoreDetail_rescoreEventId_submissionId_key" ON "RescoreDetail"("rescoreEventId", "submissionId");

-- CreateIndex
CREATE INDEX "PassCutRelease_examId_idx" ON "PassCutRelease"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "PassCutRelease_examId_releaseNumber_key" ON "PassCutRelease"("examId", "releaseNumber");

-- CreateIndex
CREATE INDEX "PassCutSnapshot_passCutReleaseId_idx" ON "PassCutSnapshot"("passCutReleaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PassCutSnapshot_passCutReleaseId_regionId_examType_key" ON "PassCutSnapshot"("passCutReleaseId", "regionId", "examType");

-- CreateIndex
CREATE UNIQUE INDEX "FinalPrediction_submissionId_key" ON "FinalPrediction"("submissionId");

-- CreateIndex
CREATE INDEX "FinalPrediction_userId_idx" ON "FinalPrediction"("userId");

-- CreateIndex
CREATE INDEX "FinalPrediction_interviewGrade_finalScore_idx" ON "FinalPrediction"("interviewGrade", "finalScore");

-- CreateIndex
CREATE INDEX "SubmissionLog_submissionId_idx" ON "SubmissionLog"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionLog_userId_createdAt_idx" ON "SubmissionLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_usedAt_idx" ON "RecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "RecoveryCode_codeHash_idx" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "visitor_logs_date_idx" ON "visitor_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_logs_date_userId_key" ON "visitor_logs"("date", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_logs_date_anonymousId_key" ON "visitor_logs"("date", "anonymousId");

-- CreateIndex
CREATE INDEX "AuthRateLimitBucket_expiresAt_idx" ON "AuthRateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRateLimitBucket_namespace_key_key" ON "AuthRateLimitBucket"("namespace", "key");

-- AddForeignKey
ALTER TABLE "exam_region_quotas" ADD CONSTRAINT "exam_region_quotas_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_region_quotas" ADD CONSTRAINT "exam_region_quotas_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerKey" ADD CONSTRAINT "AnswerKey_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerKey" ADD CONSTRAINT "AnswerKey_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerKeyLog" ADD CONSTRAINT "AnswerKeyLog_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerKeyLog" ADD CONSTRAINT "AnswerKeyLog_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerKeyLog" ADD CONSTRAINT "AnswerKeyLog_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreRegistration" ADD CONSTRAINT "PreRegistration_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreRegistration" ADD CONSTRAINT "PreRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreRegistration" ADD CONSTRAINT "PreRegistration_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectScore" ADD CONSTRAINT "SubjectScore_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectScore" ADD CONSTRAINT "SubjectScore_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DifficultyRating" ADD CONSTRAINT "DifficultyRating_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DifficultyRating" ADD CONSTRAINT "DifficultyRating_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescoreEvent" ADD CONSTRAINT "RescoreEvent_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescoreEvent" ADD CONSTRAINT "RescoreEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescoreDetail" ADD CONSTRAINT "RescoreDetail_rescoreEventId_fkey" FOREIGN KEY ("rescoreEventId") REFERENCES "RescoreEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescoreDetail" ADD CONSTRAINT "RescoreDetail_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescoreDetail" ADD CONSTRAINT "RescoreDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassCutRelease" ADD CONSTRAINT "PassCutRelease_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassCutRelease" ADD CONSTRAINT "PassCutRelease_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassCutSnapshot" ADD CONSTRAINT "PassCutSnapshot_passCutReleaseId_fkey" FOREIGN KEY ("passCutReleaseId") REFERENCES "PassCutRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassCutSnapshot" ADD CONSTRAINT "PassCutSnapshot_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPrediction" ADD CONSTRAINT "FinalPrediction_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPrediction" ADD CONSTRAINT "FinalPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLog" ADD CONSTRAINT "SubmissionLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLog" ADD CONSTRAINT "SubmissionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

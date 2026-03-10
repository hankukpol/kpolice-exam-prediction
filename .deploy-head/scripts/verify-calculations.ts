import assert from "node:assert/strict";
import { BonusType, ExamType, Role } from "@prisma/client";
import {
  calculateFinalRankingDetails,
  calculateKnownFinalRank,
  calculateKnownFinalScore,
} from "../src/lib/final-prediction";
import { prisma } from "../src/lib/prisma";
import {
  calculatePrediction,
  getLikelyMultiple,
  getPassMultiple,
  getRecruitCount,
} from "../src/lib/prediction";

type MutableRecord = Record<string, unknown>;

function patchMethod(target: object, key: string, value: unknown): () => void {
  const record = target as MutableRecord;
  const hadOwnProperty = Object.prototype.hasOwnProperty.call(target, key);
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, key);

  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
  });

  return () => {
    if (hadOwnProperty && originalDescriptor) {
      Object.defineProperty(target, key, originalDescriptor);
      return;
    }
    delete record[key];
  };
}

async function withPatchedMethods(patches: Array<() => void>, callback: () => Promise<void>) {
  try {
    await callback();
  } finally {
    for (const restore of patches.reverse()) {
      restore();
    }
  }
}

function verifyPassMultipleRules() {
  assert.equal(getPassMultiple(1), 3);
  assert.equal(getPassMultiple(2), 3);
  assert.equal(getPassMultiple(3), 8 / 3);
  assert.equal(getPassMultiple(4), 9 / 4);
  assert.equal(getPassMultiple(5), 2);
  assert.equal(getPassMultiple(6), 1.8);
  assert.equal(getPassMultiple(50), 1.7);
  assert.equal(getPassMultiple(100), 1.6);
  assert.equal(getPassMultiple(150), 1.5);
  assert.equal(getLikelyMultiple(1.8), 1.2);
  assert.equal(getLikelyMultiple(1.1), 1.1);
  assert.equal(getRecruitCount({ recruitCount: 10, recruitCountCareer: 4 }, ExamType.PUBLIC), 10);
  assert.equal(getRecruitCount({ recruitCount: 10, recruitCountCareer: 4 }, ExamType.CAREER), 4);
}

function verifyKnownFinalScoreRules() {
  const passed = calculateKnownFinalScore({
    writtenScore: 200,
    fitnessPassed: true,
    martialDanLevel: 4,
    bonusRate: 0.05,
  });

  assert.deepEqual(passed, {
    writtenScore: 200,
    written50: 40,
    fitnessBase: 48,
    martialBonusPoint: 2,
    fitnessTotal: 50,
    fitnessBonus25: 1.25,
    fitness25: 26.25,
    score75: 66.25,
  });

  const failed = calculateKnownFinalScore({
    writtenScore: 200,
    fitnessPassed: false,
    martialDanLevel: 4,
    bonusRate: 0.05,
  });

  assert.equal(failed.score75, null);
  assert.equal(failed.fitness25, 26.25);
}

async function verifyPredictionSummaryRules() {
  const submissionDelegate = prisma.submission as unknown as object;
  const quotaDelegate = prisma.examRegionQuota as unknown as object;

  const predictionSubmission = {
    id: 101,
    examId: 1,
    regionId: 1,
    examType: ExamType.PUBLIC,
    finalScore: 87,
    exam: {
      id: 1,
      name: "2026 경찰 1차",
      year: 2026,
      round: 1,
    },
    region: {
      id: 1,
      name: "서울",
    },
    user: {
      name: "홍길동",
    },
    subjectScores: [{ isFailed: false }],
  };

  const scoreBands = [
    { finalScore: 90, _count: { _all: 1 } },
    { finalScore: 89, _count: { _all: 2 } },
    { finalScore: 88, _count: { _all: 3 } },
    { finalScore: 87, _count: { _all: 4 } },
    { finalScore: 86, _count: { _all: 5 } },
    { finalScore: 85, _count: { _all: 10 } },
  ];

  const pageOneParticipants = [
    { id: 1, userId: 1, finalScore: 90, user: { name: "김1" } },
    { id: 2, userId: 2, finalScore: 89, user: { name: "김2" } },
    { id: 3, userId: 3, finalScore: 89, user: { name: "김3" } },
    { id: 4, userId: 4, finalScore: 88, user: { name: "김4" } },
    { id: 5, userId: 5, finalScore: 88, user: { name: "김5" } },
    { id: 6, userId: 6, finalScore: 88, user: { name: "김6" } },
    { id: 7, userId: 7, finalScore: 87, user: { name: "김7" } },
    { id: 101, userId: 999, finalScore: 87, user: { name: "홍길동" } },
    { id: 9, userId: 9, finalScore: 87, user: { name: "김9" } },
    { id: 10, userId: 10, finalScore: 87, user: { name: "김10" } },
    { id: 11, userId: 11, finalScore: 86, user: { name: "김11" } },
    { id: 12, userId: 12, finalScore: 86, user: { name: "김12" } },
    { id: 13, userId: 13, finalScore: 86, user: { name: "김13" } },
    { id: 14, userId: 14, finalScore: 86, user: { name: "김14" } },
    { id: 15, userId: 15, finalScore: 86, user: { name: "김15" } },
    { id: 16, userId: 16, finalScore: 85, user: { name: "김16" } },
    { id: 17, userId: 17, finalScore: 85, user: { name: "김17" } },
    { id: 18, userId: 18, finalScore: 85, user: { name: "김18" } },
    { id: 19, userId: 19, finalScore: 85, user: { name: "김19" } },
    { id: 20, userId: 20, finalScore: 85, user: { name: "김20" } },
  ];

  const restores = [
    patchMethod(submissionDelegate, "findFirst", async () => predictionSubmission),
    patchMethod(
      submissionDelegate,
      "groupBy",
      async () => scoreBands
    ),
    patchMethod(submissionDelegate, "findMany", async () => pageOneParticipants),
    patchMethod(quotaDelegate, "findUnique", async () => ({
      recruitCount: 10,
      recruitCountCareer: 4,
      applicantCount: 120,
      applicantCountCareer: 30,
    })),
  ];

  await withPatchedMethods(restores, async () => {
    const result = await calculatePrediction(999, {}, Role.USER);

    assert.equal(result.summary.recruitCount, 10);
    assert.equal(result.summary.applicantCount, 120);
    assert.equal(result.summary.totalParticipants, 25);
    assert.equal(result.summary.myScore, 87);
    assert.equal(result.summary.myRank, 7);
    assert.equal(result.summary.myMultiple, 0.7);
    assert.equal(result.summary.oneMultipleBaseRank, 10);
    assert.equal(result.summary.oneMultipleActualRank, 10);
    assert.equal(result.summary.oneMultipleCutScore, 87);
    assert.equal(result.summary.oneMultipleTieCount, 4);
    assert.equal(result.summary.passMultiple, 1.8);
    assert.equal(result.summary.likelyMultiple, 1.2);
    assert.equal(result.summary.passCount, 18);
    assert.equal(result.summary.passLineScore, 85);

    assert.deepEqual(result.pyramid.counts, {
      sure: 10,
      likely: 2,
      possible: 6,
      challenge: 5,
      belowChallenge: 2,
    });
    assert.equal(result.pyramid.levels[0]?.isCurrent, true);

    assert.equal(result.competitors.page, 1);
    assert.equal(result.competitors.totalCount, 25);
    assert.equal(result.competitors.totalPages, 2);
    assert.equal(result.competitors.items.length, 20);
    assert.equal(result.competitors.items.find((item) => item.isMine)?.rank, 7);
    assert.equal(result.competitors.items.find((item) => item.isMine)?.score, 87);
  });
}

async function verifyFinalRankingRules() {
  const quotaDelegate = prisma.examRegionQuota as unknown as object;
  const finalPredictionDelegate = prisma.finalPrediction as unknown as object;

  const rankingRows = [
    {
      submissionId: 201,
      finalScore: 66,
      fitnessScore: 2,
      submission: {
        finalScore: 200,
        bonusType: BonusType.NONE,
        user: { name: "홍길동" },
      },
    },
    {
      submissionId: 202,
      finalScore: 66,
      fitnessScore: 2,
      submission: {
        finalScore: 195,
        bonusType: BonusType.VETERAN_5,
        user: { name: "김보훈" },
      },
    },
    {
      submissionId: 203,
      finalScore: 65,
      fitnessScore: 1,
      submission: {
        finalScore: 198,
        bonusType: BonusType.NONE,
        user: { name: "이수험" },
      },
    },
    {
      submissionId: 204,
      finalScore: 64,
      fitnessScore: 0,
      submission: {
        finalScore: 190,
        bonusType: BonusType.NONE,
        user: { name: "박응시" },
      },
    },
  ];

  const restores = [
    patchMethod(quotaDelegate, "findUnique", async () => ({
      recruitCount: 2,
      recruitCountCareer: 1,
      region: { name: "서울" },
    })),
    patchMethod(finalPredictionDelegate, "findMany", async () => rankingRows),
  ];

  await withPatchedMethods(restores, async () => {
    const rankOnly = await calculateKnownFinalRank({
      examId: 1,
      regionId: 1,
      examType: ExamType.PUBLIC,
      submissionId: 201,
    });

    assert.deepEqual(rankOnly, {
      finalRank: 1,
      totalParticipants: 4,
    });

    const details = await calculateFinalRankingDetails({
      examId: 1,
      regionId: 1,
      examType: ExamType.PUBLIC,
      submissionId: 201,
    });

    assert.ok(details);
    assert.equal(details.finalRank, 1);
    assert.equal(details.totalParticipants, 4);
    assert.equal(details.recruitCount, 2);
    assert.equal(details.passMultiple, 3);
    assert.equal(details.oneMultipleCutScore, 66);
    assert.equal(details.isWithinOneMultiple, true);
    assert.equal(details.competitors[0]?.rank, 1);
    assert.equal(details.competitors[1]?.rank, 1);
    assert.equal(details.competitors.some((item) => item.isMine && item.rank === 1), true);
  });
}

async function main() {
  verifyPassMultipleRules();
  verifyKnownFinalScoreRules();
  await verifyPredictionSummaryRules();
  await verifyFinalRankingRules();

  console.log("Calculation verification passed.");
}

main()
  .catch((error) => {
    console.error("Calculation verification failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.qsdufgjxepzvgkrcumcq:hankukpol_0112%5E%5E@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require'
    }
  }
});

function getPassMultiple(recruitCount) {
  if (recruitCount >= 150) return 1.5;
  if (recruitCount >= 100) return 1.6;
  if (recruitCount >= 50)  return 1.7;
  if (recruitCount >= 6)   return 1.8;
  const table = { 5: 10, 4: 9, 3: 8, 2: 6, 1: 3 };
  return (table[recruitCount] || 0) / recruitCount;
}

function getScoreAtRank(bands, rank) {
  let covered = 0;
  for (const b of bands) {
    covered += b.count;
    if (covered >= rank) return b.score;
  }
  return null;
}

async function main() {
  const examId = 1;

  // 정답키 등록 여부
  const answerKeys = await prisma.answerKey.count({ where: { examId } });
  console.log(`\n정답키 등록: ${answerKeys}개`);

  // 시간대별 제출 현황
  const recentSubs = await prisma.submission.findMany({
    where: { examId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, createdAt: true, examType: true, finalScore: true }
  });
  console.log(`\n최근 제출 5건:`);
  recentSubs.forEach(s => {
    console.log(`  #${s.id} ${s.examType} ${s.finalScore?.toFixed(2)}점 @ ${s.createdAt.toISOString()}`);
  });

  // 전체 통계
  const totalSubmissions = await prisma.submission.count({ where: { examId, isSuspicious: false } });
  const passSubmissions = await prisma.submission.count({
    where: { examId, isSuspicious: false, subjectScores: { some: {}, none: { isFailed: true } } }
  });
  const failedSubs = totalSubmissions - passSubmissions;

  console.log(`\n===== 전체 현황 =====`);
  console.log(`총 제출: ${totalSubmissions}명 | 유효(과락제외): ${passSubmissions}명 | 과락: ${failedSubs}명`);

  // 점수 분포 (전체)
  const allScores = await prisma.submission.findMany({
    where: { examId, isSuspicious: false, subjectScores: { some: {}, none: { isFailed: true } } },
    select: { finalScore: true, examType: true, regionId: true },
    orderBy: { finalScore: 'desc' }
  });

  const regions = await prisma.region.findMany({ select: { id: true, name: true } });
  const regionMap = Object.fromEntries(regions.map(r => [r.id, r.name]));

  // 지역별 그룹
  const grouped = {};
  for (const s of allScores) {
    const key = `${s.examType}|${regionMap[s.regionId] || s.regionId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(Number(s.finalScore));
  }

  // 쿼터 정보
  const quotas = await prisma.$queryRaw`
    SELECT q."regionId", r."name" AS "regionName", q."recruitCount", q."recruitCountCareer"
    FROM "exam_region_quotas" q
    JOIN "Region" r ON r.id = q."regionId"
    WHERE q."examId" = ${examId}
    ORDER BY r."name" ASC
  `;

  const quotaMap = {};
  for (const q of quotas) {
    quotaMap[`PUBLIC|${q.regionName}`] = q.recruitCount;
    quotaMap[`CAREER|${q.regionName}`] = q.recruitCountCareer;
  }

  console.log(`\n===== 지역별 점수 현황 =====`);
  const examTypeLabel = { PUBLIC: '공채', CAREER: '경행경채' };

  // 참여자 있는 지역만 출력
  const sortKeys = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  for (const key of sortKeys) {
    const scores = grouped[key];
    if (scores.length === 0) continue;
    const [type, regionName] = key.split('|');
    const recruitCount = quotaMap[key] || 0;
    const label = examTypeLabel[type] || type;

    const passMultiple = recruitCount >= 1 ? getPassMultiple(recruitCount) : null;
    const passCount = passMultiple ? Math.ceil(recruitCount * passMultiple) : null;

    const bands = [];
    const scoreMap = {};
    for (const sc of scores) {
      const k = sc.toFixed(2);
      scoreMap[k] = (scoreMap[k] || 0) + 1;
    }
    for (const [sc, cnt] of Object.entries(scoreMap).sort((a, b) => Number(b[0]) - Number(a[0]))) {
      bands.push({ score: Number(sc), count: cnt });
    }

    const topScore = scores[0];
    const bottomScore = scores[scores.length - 1];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const sureScore = recruitCount >= 1 ? getScoreAtRank(bands, recruitCount) : null;
    const likelyMaxRank = recruitCount >= 1 ? Math.max(1, Math.floor(recruitCount * Math.min(1.2, passMultiple))) : null;
    const likelyScore = likelyMaxRank ? getScoreAtRank(bands, likelyMaxRank) : null;
    const passLineScore = passCount ? getScoreAtRank(bands, passCount) : null;

    console.log(`\n[${label}] ${regionName} | 모집: ${recruitCount}명 | 참여: ${scores.length}명`);
    console.log(`  점수범위: ${bottomScore.toFixed(2)} ~ ${topScore.toFixed(2)} | 평균: ${avgScore.toFixed(2)}`);
    if (recruitCount >= 1) {
      console.log(`  확실권컷(${recruitCount}등): ${sureScore !== null ? sureScore.toFixed(2)+'점' : '데이터 부족('+scores.length+'/'+recruitCount+')'}`);
      console.log(`  유력권컷(${likelyMaxRank}등): ${likelyScore !== null ? likelyScore.toFixed(2)+'점' : '데이터 부족'}`);
      console.log(`  합격배수컷(${passCount}등,${passMultiple}배): ${passLineScore !== null ? passLineScore.toFixed(2)+'점' : '데이터 부족'}`);
    }
  }

  // 전체 공채 점수 분포 (상위 20개)
  console.log(`\n===== 공채 전체 점수 상위 20위 =====`);
  const publicScores = allScores.filter(s => s.examType === 'PUBLIC')
    .map(s => Number(s.finalScore))
    .sort((a, b) => b - a);
  publicScores.slice(0, 20).forEach((sc, i) => {
    console.log(`  ${i+1}등: ${sc.toFixed(2)}점`);
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

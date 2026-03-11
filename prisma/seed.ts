import bcrypt from "bcryptjs";
import { ExamType, PrismaClient, Role } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const regions = [
  "서울", "101경비단", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기남부", "경기북부", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 2026년 1차 시험 기준 지역별 모집인원 (ExamRegionQuota 시딩용)
// recruitCountCareer 값은 공식 경행경채 인원 확정 전까지 공채와 동일 값 사용
const regionQuotas = [
  { regionName: "서울", recruitCount: 715, recruitCountCareer: 715 },
  { regionName: "101경비단", recruitCount: 40, recruitCountCareer: 0 },
  { regionName: "부산", recruitCount: 213, recruitCountCareer: 213 },
  { regionName: "대구", recruitCount: 92, recruitCountCareer: 92 },
  { regionName: "인천", recruitCount: 175, recruitCountCareer: 175 },
  { regionName: "광주", recruitCount: 37, recruitCountCareer: 37 },
  { regionName: "대전", recruitCount: 51, recruitCountCareer: 51 },
  { regionName: "울산", recruitCount: 22, recruitCountCareer: 22 },
  { regionName: "세종", recruitCount: 10, recruitCountCareer: 10 },
  { regionName: "경기남부", recruitCount: 609, recruitCountCareer: 609 },
  { regionName: "경기북부", recruitCount: 128, recruitCountCareer: 128 },
  { regionName: "강원", recruitCount: 140, recruitCountCareer: 140 },
  { regionName: "충북", recruitCount: 121, recruitCountCareer: 121 },
  { regionName: "충남", recruitCount: 152, recruitCountCareer: 152 },
  { regionName: "전북", recruitCount: 137, recruitCountCareer: 137 },
  { regionName: "전남", recruitCount: 176, recruitCountCareer: 176 },
  { regionName: "경북", recruitCount: 181, recruitCountCareer: 181 },
  { regionName: "경남", recruitCount: 196, recruitCountCareer: 196 },
  { regionName: "제주", recruitCount: 47, recruitCountCareer: 47 },
];

const subjects = [
  {
    name: "헌법",
    examType: ExamType.PUBLIC,
    questionCount: 20,
    pointPerQuestion: 2.5,
    maxScore: 50,
  },
  {
    name: "형사법",
    examType: ExamType.PUBLIC,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
  {
    name: "경찰학",
    examType: ExamType.PUBLIC,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
  {
    name: "범죄학",
    examType: ExamType.CAREER,
    questionCount: 20,
    pointPerQuestion: 2.5,
    maxScore: 50,
  },
  {
    name: "형사법",
    examType: ExamType.CAREER,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
  {
    name: "경찰학",
    examType: ExamType.CAREER,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
];

const siteSettings = [
  { key: "site.title", value: "경찰 필기 합격예측" },
  { key: "site.heroBadge", value: "2026년 경찰 1차 필기시험 합격예측" },
  { key: "site.heroTitle", value: "OMR 입력부터 합격권 예측까지\n한 번에 확인하세요." },
  {
    key: "site.heroSubtitle",
    value:
      "응시정보와 OMR 답안을 입력하면 과목별 분석, 석차, 배수 위치, 합격권 등급을 실시간으로 제공합니다.",
  },
  {
    key: "site.footerDisclaimer",
    value:
      "면책조항: 본 서비스는 수험생의 자기 점검을 위한 참고용 분석 도구이며, 실제 합격 여부를 보장하지 않습니다. 최종 선발 결과는 경찰청 및 지역청 공식 공고를 반드시 확인해 주세요.",
  },
  { key: "site.bannerImageUrl", value: "" },
  { key: "site.bannerLink", value: "" },
  { key: "site.maintenanceMode", value: "false" },
  { key: "site.maintenanceMessage", value: "시스템 점검 중입니다." },
  { key: "site.careerExamEnabled", value: "true" },
  { key: "site.mainPageAutoRefresh", value: "true" },
  { key: "site.mainPageRefreshInterval", value: "60" },
  {
    key: "site.termsOfService",
    value: `제1조 (목적)
본 약관은 경찰 필기 합격예측 서비스(이하 "서비스")의 이용 조건 및 운영자와 이용자 간의 권리·의무에 관한 사항을 정합니다.

제2조 (서비스 이용)
① 본 서비스는 경찰공무원(순경) 채용시험 필기 응시자를 위한 합격예측 참고 도구입니다.
② 서비스 이용은 회원가입 후 가능하며, 만 14세 이상만 가입할 수 있습니다.
③ 1인 1계정 원칙을 준수하며, 타인의 계정을 사용·양도·대여할 수 없습니다.

제3조 (서비스의 성격 및 면책)
① 본 서비스는 참여자가 입력한 답안을 기반으로 하는 참고용 분석 정보를 제공합니다.
② 제공되는 합격예측 정보는 실제 시험 결과와 다를 수 있으며, 최종 합격 여부는 경찰청 공식 발표를 기준으로 합니다.
③ 서비스 오류, 데이터 지연, 예측 정확도 등으로 인한 손해에 대해 운영자는 책임을 지지 않습니다.

제4조 (이용자 의무)
이용자는 다음 행위를 하여서는 안 됩니다.
① 허위 정보 입력 또는 타인 정보 도용
② 서비스를 통한 상업적 목적의 데이터 수집·재배포
③ 서비스 운영을 방해하는 악의적 행위
④ 관련 법령에 위반되는 행위

제5조 (서비스 변경·중단)
운영자는 서비스 내용을 변경하거나 일시 중단·종료할 수 있으며, 중요한 변경은 사전 공지를 원칙으로 합니다.

제6조 (회원 탈퇴)
이용자는 언제든지 서비스 내 설정을 통해 탈퇴를 신청할 수 있으며, 탈퇴 시 개인 데이터는 개인정보 처리방침에 따라 처리됩니다.

본 약관은 서비스 최초 이용 시점부터 효력이 발생합니다.`,
  },
  {
    key: "site.privacyPolicy",
    value: `경찰 필기 합격예측 서비스는 「개인정보 보호법」에 따라 이용자의 개인정보를 아래와 같이 처리합니다.

1. 수집하는 개인정보 항목
- 필수: 이름, 전화번호(아이디로 사용), 이메일 주소, 비밀번호(암호화 저장)
- 자동 수집: 접속 IP 주소(보안 및 부정 이용 방지 목적)

2. 개인정보 수집 및 이용 목적
- 회원가입 및 본인 식별
- 로그인·인증 서비스 제공
- 비밀번호 재설정(이메일 발송)
- 합격예측 서비스 제공 및 개인 성적 데이터 조회

3. 개인정보 보유 및 이용 기간
- 회원 탈퇴 시 또는 서비스 종료 시까지 보유합니다.
- 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.

4. 개인정보의 제3자 제공
이용자의 개인정보를 외부에 제공하지 않습니다.

5. 개인정보 처리 위탁
현재 개인정보 처리를 외부에 위탁하지 않습니다.

6. 이용자의 권리
이용자는 언제든지 본인의 개인정보 열람·수정·삭제 및 처리 정지를 요청할 수 있습니다.

7. 개인정보 보호책임자
서비스 이용 중 개인정보 관련 문의는 서비스 운영자에게 연락해 주시기 바랍니다.

본 처리방침은 서비스 운영 정책 변경에 따라 사전 공지 후 수정될 수 있습니다.`,
  },
];

const noticeSamples = [
  {
    title: "시험일: 2026.3.14(토)",
    content: "합격발표: 2026.3.20(금) 17:00",
    isActive: true,
    priority: 1,
  },
];

const faqSamples = [
  // ── 서비스 이용 ──────────────────────────────────────────
  {
    question: "이 서비스가 뭔가요?",
    answer:
      "대구·경북 지역 경찰공무원(순경) 채용시험 필기 합격예측 서비스입니다. 시험 당일 OMR 답안을 입력하면 자동 채점 후 과목별 성적 분석, 대구·경북 참여자 대비 순위, 합격배수 위치, 합격 가능성 등급(확실권·유력권·가능권·도전권)을 실시간으로 확인할 수 있습니다.",
    isActive: true,
    priority: 110,
  },
  {
    question: "어떻게 이용하나요?",
    answer:
      "① 회원가입 후 로그인 → ② '응시정보 입력' 탭에서 채용유형(공채/경행경채)·지역(대구 또는 경북)·가산점 선택 → ③ 100문항 OMR 답안 입력 후 제출 → ④ '내 성적 분석' 탭에서 과목별 채점 결과 확인 → ⑤ '합격 컷/경쟁자 정보' 탭에서 합격예측 등급과 순위 확인.",
    isActive: true,
    priority: 105,
  },
  {
    question: "회원가입이 꼭 필요한가요?",
    answer:
      "네, 답안 제출과 성적 조회는 로그인이 필요합니다. 전화번호·이메일·비밀번호만으로 1분 안에 가입할 수 있습니다.",
    isActive: true,
    priority: 103,
  },
  {
    question: "채용유형이나 지역을 잘못 선택했어요. 수정할 수 있나요?",
    answer:
      "제출 전에는 입력 화면에서 자유롭게 수정할 수 있습니다. 제출 후에는 결과 화면의 '답안 수정' 버튼을 눌러 다시 제출하면 변경 내용이 즉시 반영됩니다. 단, 관리자 정책에 따라 수정 가능 기간이 제한될 수 있습니다.",
    isActive: true,
    priority: 100,
  },
  {
    question: "OMR 마킹을 잘못 입력했어요. 수정할 수 있나요?",
    answer:
      "가능합니다. 제출 후 결과 화면에서 '답안 수정' 버튼을 누르고 수정한 뒤 다시 제출하면 최신 답안으로 즉시 재채점됩니다. 마지막으로 제출한 답안이 최종 답안으로 처리됩니다.",
    isActive: true,
    priority: 98,
  },

  // ── 시험과목·채점 방식 ─────────────────────────────────
  {
    question: "공채와 경행경채는 어떻게 다른가요?",
    answer:
      "첫 번째 과목만 다르고, 나머지는 동일합니다.\n• 공채: 헌법(20문항) + 형사법(40문항) + 경찰학(40문항)\n• 경행경채(경찰행정학과 경력채용): 범죄학(20문항) + 형사법(40문항) + 경찰학(40문항)\n채점 방식·배점·과락 기준·합격배수·가산점은 공채와 동일합니다. 반드시 본인이 응시한 채용유형을 선택하세요. 공채와 경행경채는 별도 모집단으로 순위가 산출됩니다.",
    isActive: true,
    priority: 95,
  },
  {
    question: "점수는 어떻게 계산되나요?",
    answer:
      "모든 문항의 배점은 2.5점으로 동일하며, 오답 감점은 없습니다.\n• 헌법 또는 범죄학: 20문항 × 2.5점 = 최대 50점\n• 형사법: 40문항 × 2.5점 = 최대 100점\n• 경찰학: 40문항 × 2.5점 = 최대 100점\n• 총점 최대: 250점\n가산점이 있는 경우 원점수 합산 후 별도 추가됩니다.",
    isActive: true,
    priority: 92,
  },
  {
    question: "과락 기준이 뭔가요?",
    answer:
      "3개 과목 중 1개라도 과목별 만점의 40% 미만이면 과락(불합격)입니다.\n• 헌법 또는 범죄학: 50점 만점 → 20점 미만이면 과락\n• 형사법: 100점 만점 → 40점 미만이면 과락\n• 경찰학: 100점 만점 → 40점 미만이면 과락\n총점 기준 과락은 없으며, 한 과목이라도 과락이면 총점에 관계없이 불합격 처리됩니다.",
    isActive: true,
    priority: 90,
  },

  // ── 합격배수·순위 ─────────────────────────────────────
  {
    question: "1배수, 합격배수가 뭔가요?",
    answer:
      "경찰 필기시험은 최종 모집인원보다 더 많은 인원을 선발합니다. 이 선발 비율을 합격배수라고 합니다.\n• 1배수 이내 = 모집인원 이내 순위 → 합격 확실권\n• 합격배수 이내 = 필기 합격 기준 순위\n예를 들어 모집 100명에 합격배수 1.6배이면, 160등 이내에 들어야 필기 합격입니다.",
    isActive: true,
    priority: 88,
  },
  {
    question: "합격배수는 어떻게 결정되나요?",
    answer:
      "경찰청 공고 기준으로 해당 연도 지역별 모집인원에 따라 아래와 같이 적용됩니다.\n• 150명 이상: 1.5배\n• 100~149명: 1.6배\n• 50~99명: 1.7배\n• 6~49명: 1.8배\n• 5명: 10명 / 4명: 9명 / 3명: 8명 / 2명: 6명 / 1명: 3명\n합격선 동점자는 배수 초과 시에도 전원 합격 처리됩니다.",
    isActive: true,
    priority: 85,
  },
  {
    question: "대구·경북의 합격배수는 어떻게 되나요?",
    answer:
      "대구와 경북의 합격배수는 해당 연도 공고에서 발표하는 지역별 모집인원에 따라 결정됩니다. 매년 모집인원이 달라질 수 있으므로 경찰청 공식 공고를 확인하세요.\n• 모집 150명 이상: 1.5배\n• 모집 100~149명: 1.6배\n• 모집 50~99명: 1.7배\n본 서비스는 공고 기준 최신 모집인원을 반영하여 합격배수를 자동 적용합니다.",
    isActive: true,
    priority: 83,
  },
  {
    question: "서비스 순위와 실제 시험 결과가 다를 수 있나요?",
    answer:
      "네, 반드시 참고용으로만 활용하세요. 본 서비스 순위는 이 사이트에 답안을 입력한 대구·경북 참여자만을 대상으로 산출됩니다. 실제 시험에는 훨씬 많은 응시자가 있으므로, 실제 합격 여부는 경찰청 공식 합격자 발표를 반드시 확인하세요.",
    isActive: true,
    priority: 80,
  },
  {
    question: "나와 점수가 같은 사람이 여러 명이면 순위는 어떻게 되나요?",
    answer:
      "동점자는 모두 같은 순위로 처리됩니다. 경찰청 공고에 따르면, 필기 합격선 동점자는 선발 배수를 초과하더라도 전원 필기 합격으로 처리됩니다. 본 서비스도 동점자를 동일 순위로 표시합니다.",
    isActive: true,
    priority: 77,
  },
  {
    question: "대구와 경북 중 어디를 선택해야 하나요?",
    answer:
      "원서 접수 시 본인이 선택한 지역을 그대로 선택하세요.\n• 대구경찰청에 지원한 경우 → '대구' 선택\n• 경북경찰청에 지원한 경우 → '경북' 선택\n지역을 정확히 선택해야 해당 지역 응시자 기준 순위와 합격배수가 올바르게 산출됩니다.",
    isActive: true,
    priority: 74,
  },

  // ── 가산점 ────────────────────────────────────────────
  {
    question: "가산점은 어떻게 적용되나요?",
    answer:
      "과목별 40% 이상(과락 없음)인 경우에 한해 필기시험 만점(250점) 기준으로 아래 비율이 추가됩니다.\n• 취업지원대상자(국가유공자 등): 5% → 12.5점 / 10% → 25점\n• 의사상자 등: 3% → 7.5점 / 5% → 12.5점\n두 가산점이 모두 해당되는 경우 유리한 1개만 선택 적용됩니다.",
    isActive: true,
    priority: 72,
  },
  {
    question: "취업지원대상자 가산점이 5%인지 10%인지 어떻게 알 수 있나요?",
    answer:
      "국가보훈부에서 발급한 취업지원대상자 증명서(확인서)에 가산 비율이 기재되어 있습니다. 해당 서류를 확인하여 본인의 비율을 정확히 입력하세요. 증명서 없이 신청하거나 비율을 잘못 기재하면 부정 신청이 될 수 있습니다.",
    isActive: true,
    priority: 70,
  },

  // ── 정답·재채점 ───────────────────────────────────────
  {
    question: "가답안과 확정 답안이 다르면 점수가 바뀌나요?",
    answer:
      "경찰청이 확정 답안을 발표하면 본 서비스에서도 새 정답키로 자동 재채점합니다. 기존에 입력한 답안은 그대로 유지되며, 변경된 정답키 기준으로 점수와 순위가 업데이트됩니다. 별도로 답안을 다시 입력할 필요가 없습니다.",
    isActive: true,
    priority: 68,
  },
  {
    question: "이의신청으로 복수 정답이나 전원 정답 처리가 되면 어떻게 되나요?",
    answer:
      "경찰청 최종 확정 답안에 복수 정답 또는 전원 정답 처리 문항이 포함되면, 해당 내용을 반영한 정답키로 자동 재채점됩니다. 확정 답안은 경찰청 공식 공고를 통해 확인하세요.",
    isActive: true,
    priority: 65,
  },

  // ── 서비스·기타 ───────────────────────────────────────
  {
    question: "여기서 보여주는 합격예측이 최종 합격인가요?",
    answer:
      "아닙니다. 본 서비스는 필기시험 점수 기준 참고 지표입니다. 필기 합격 이후에는 체력검사·신체검사·면접·신원조회 등의 전형이 남아 있으며, 이는 본 서비스에서 반영되지 않습니다. 최종 합격 여부는 경찰청 공식 발표를 반드시 확인하세요.",
    isActive: true,
    priority: 62,
  },
  {
    question: "필기 합격자 발표는 어디서 확인하나요?",
    answer:
      "경찰청 공식 홈페이지(www.police.go.kr) 및 대구경찰청·경북경찰청 홈페이지에서 확인할 수 있습니다. 발표 일정은 매년 시험 공고문에 명시되므로 공고문을 미리 확인해 두세요.",
    isActive: true,
    priority: 60,
  },
  {
    question: "내 개인정보는 안전하게 관리되나요?",
    answer:
      "가입 시 입력한 전화번호·이메일·이름은 서비스 운영 목적으로만 사용됩니다. 다른 사용자 화면에서는 이름이 마스킹 처리(예: 김○○)되어 표시되며, 개인정보는 외부에 제공되지 않습니다.",
    isActive: true,
    priority: 55,
  },
];

async function main() {
  const adminPhone = process.env.ADMIN_PHONE;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPhone || !adminPassword) {
    throw new Error(
      "[seed] ADMIN_PHONE 또는 ADMIN_PASSWORD 환경변수가 설정되지 않았습니다. .env.local을 확인하세요."
    );
  }

  if (adminPassword.length < 10) {
    throw new Error("[seed] ADMIN_PASSWORD는 10자 이상이어야 합니다.");
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      name: "시스템 관리자",
      phone: adminPhone,
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      name: "시스템 관리자",
      phone: adminPhone,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.exam.upsert({
    where: {
      year_round: {
        year: 2026,
        round: 1,
      },
    },
    update: {
      name: "2026년 제1차 경찰공무원(순경) 채용시험",
      examDate: new Date("2026-03-14T10:00:00+09:00"),
      isActive: true,
    },
    create: {
      name: "2026년 제1차 경찰공무원(순경) 채용시험",
      year: 2026,
      round: 1,
      examDate: new Date("2026-03-14T10:00:00+09:00"),
      isActive: true,
    },
  });

  for (const regionName of regions) {
    await prisma.region.upsert({
      where: { name: regionName },
      update: {},
      create: { name: regionName },
    });
  }

  // ExamRegionQuota 시딩: 활성 시험 × 지역별 모집인원
  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (activeExam) {
    for (const quota of regionQuotas) {
      const region = await prisma.region.findUnique({
        where: { name: quota.regionName },
        select: { id: true },
      });
      if (!region) continue;

      await prisma.examRegionQuota.upsert({
        where: {
          examId_regionId: {
            examId: activeExam.id,
            regionId: region.id,
          },
        },
        update: {
          recruitCount: quota.recruitCount,
          recruitCountCareer: quota.recruitCountCareer,
        },
        create: {
          examId: activeExam.id,
          regionId: region.id,
          recruitCount: quota.recruitCount,
          recruitCountCareer: quota.recruitCountCareer,
        },
      });
    }
  }

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: {
        name_examType: {
          name: subject.name,
          examType: subject.examType,
        },
      },
      update: subject,
      create: subject,
    });
  }

  const existingSiteSettingKeys = new Set(
    (
      await prisma.siteSetting.findMany({
        where: {
          key: {
            in: siteSettings.map((setting) => setting.key),
          },
        },
        select: { key: true },
      })
    ).map((setting) => setting.key)
  );

  const missingSiteSettings = siteSettings.filter((setting) => !existingSiteSettingKeys.has(setting.key));

  // 관리자가 수정한 사이트 기본설정은 seed 재실행 시 덮어쓰지 않는다.
  if (missingSiteSettings.length > 0) {
    await prisma.siteSetting.createMany({
      data: missingSiteSettings,
    });
  }

  for (const notice of noticeSamples) {
    const existingNotice = await prisma.notice.findFirst({
      where: { title: notice.title },
      select: { id: true },
    });

    if (existingNotice) {
      await prisma.notice.update({
        where: { id: existingNotice.id },
        data: {
          content: notice.content,
          isActive: notice.isActive,
          priority: notice.priority,
        },
      });
    } else {
      await prisma.notice.create({ data: notice });
    }
  }

  // FAQ는 매번 전체 교체 (질문 텍스트가 바뀌면 이전 데이터가 남는 문제 방지)
  await prisma.faq.deleteMany({});
  await prisma.faq.createMany({ data: faqSamples });

  console.log("기본 데이터 시딩이 완료되었습니다.");
  console.log(`관리자 연락처: ${adminPhone}`);
  console.log("관리자 비밀번호는 환경변수 ADMIN_PASSWORD 값을 사용합니다.");
}

main()
  .catch((error) => {
    console.error("시딩 중 오류가 발생했습니다.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

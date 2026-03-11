export type SiteSettingKey =
  | "site.title"
  | "site.heroBadge"
  | "site.heroTitle"
  | "site.heroSubtitle"
  | "site.footerDisclaimer"
  | "site.termsOfService"
  | "site.privacyPolicy"
  | "site.bannerImageUrl"
  | "site.bannerLink"
  | "site.careerExamEnabled"
  | "site.maintenanceMode"
  | "site.maintenanceMessage"
  | "site.mainPageAutoRefresh"
  | "site.mainPageRefreshInterval"
  | "site.mainCardLiveStatsEnabled"
  | "site.mainCardOverviewEnabled"
  | "site.mainCardDifficultyEnabled"
  | "site.mainCardCompetitiveEnabled"
  | "site.mainCardScoreDistributionEnabled"
  | "site.submissionEditLimit"
  | "site.finalPredictionEnabled"
  | "site.autoPassCutEnabled"
  | "site.autoPassCutMode"
  | "site.autoPassCutCheckIntervalSec"
  | "site.autoPassCutThresholdProfile"
  | "site.commentsEnabled"
  | "site.autoPassCutReadyRatioProfile"
  | "site.tabMainEnabled"
  | "site.tabInputEnabled"
  | "site.tabResultEnabled"
  | "site.tabPredictionEnabled"
  | "site.tabNoticesEnabled"
  | "site.tabFaqEnabled"
  | "site.tabLockedMessage"
  | "site.preRegistrationEnabled"
  | "site.answerInputEnabled"
  | "site.preRegistrationClosedMessage";

export type SiteSettingValueType = "string" | "nullable-string" | "boolean" | "number";

export type SiteSettingsMap = Record<SiteSettingKey, string | boolean | number | null>;

export const SITE_SETTING_TYPES: Record<SiteSettingKey, SiteSettingValueType> = {
  "site.title": "string",
  "site.heroBadge": "string",
  "site.heroTitle": "string",
  "site.heroSubtitle": "string",
  "site.footerDisclaimer": "string",
  "site.termsOfService": "string",
  "site.privacyPolicy": "string",
  "site.bannerImageUrl": "nullable-string",
  "site.bannerLink": "nullable-string",
  "site.careerExamEnabled": "boolean",
  "site.maintenanceMode": "boolean",
  "site.maintenanceMessage": "string",
  "site.mainPageAutoRefresh": "boolean",
  "site.mainPageRefreshInterval": "string",
  "site.mainCardLiveStatsEnabled": "boolean",
  "site.mainCardOverviewEnabled": "boolean",
  "site.mainCardDifficultyEnabled": "boolean",
  "site.mainCardCompetitiveEnabled": "boolean",
  "site.mainCardScoreDistributionEnabled": "boolean",
  "site.submissionEditLimit": "number",
  "site.commentsEnabled": "boolean",
  "site.finalPredictionEnabled": "boolean",
  "site.autoPassCutEnabled": "boolean",
  "site.autoPassCutMode": "string",
  "site.autoPassCutCheckIntervalSec": "number",
  "site.autoPassCutThresholdProfile": "string",
  "site.autoPassCutReadyRatioProfile": "string",
  "site.tabMainEnabled": "boolean",
  "site.tabInputEnabled": "boolean",
  "site.tabResultEnabled": "boolean",
  "site.tabPredictionEnabled": "boolean",
  "site.tabNoticesEnabled": "boolean",
  "site.tabFaqEnabled": "boolean",
  "site.tabLockedMessage": "string",
  "site.preRegistrationEnabled": "boolean",
  "site.answerInputEnabled": "boolean",
  "site.preRegistrationClosedMessage": "string",
};

export const SITE_SETTING_DEFAULTS: SiteSettingsMap = {
  "site.title": "경찰 합격예측",
  "site.heroBadge": "2026년 경찰 1차 필기시험 합격예측",
  "site.heroTitle": "OMR 입력부터 합격예측까지\n한 번에 확인하세요",
  "site.heroSubtitle":
    "응시정보와 OMR 답안을 입력하면 과목별 분석, 예상점수, 배수 위치, 합격권 예측을 실시간으로 제공합니다.",
  "site.footerDisclaimer":
    "면책조항: 본 서비스는 수험생의 자기 점검을 위한 참고용 분석 도구이며, 실제 합격 여부를 보장하지 않습니다. 최종 결과는 경찰청 및 지방청 공식 공고를 반드시 확인해 주세요.",
  "site.termsOfService": `제1조 (목적)
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
  "site.privacyPolicy": `경찰 필기 합격예측 서비스는 「개인정보 보호법」에 따라 이용자의 개인정보를 아래와 같이 처리합니다.

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
  "site.bannerImageUrl": null,
  "site.bannerLink": null,
  "site.careerExamEnabled": true,
  "site.maintenanceMode": false,
  "site.maintenanceMessage": "서비스 점검 중입니다.",
  "site.mainPageAutoRefresh": true,
  "site.mainPageRefreshInterval": "60",
  "site.mainCardLiveStatsEnabled": true,
  "site.mainCardOverviewEnabled": true,
  "site.mainCardDifficultyEnabled": true,
  "site.mainCardCompetitiveEnabled": true,
  "site.mainCardScoreDistributionEnabled": true,
  "site.submissionEditLimit": 3,
  "site.commentsEnabled": true,
  "site.finalPredictionEnabled": false,
  "site.autoPassCutEnabled": false,
  "site.autoPassCutMode": "HYBRID",
  "site.autoPassCutCheckIntervalSec": 300,
  "site.autoPassCutThresholdProfile": "BALANCED",
  "site.autoPassCutReadyRatioProfile": "BALANCED",
  "site.tabMainEnabled": true,
  "site.tabInputEnabled": true,
  "site.tabResultEnabled": true,
  "site.tabPredictionEnabled": true,
  "site.tabNoticesEnabled": true,
  "site.tabFaqEnabled": true,
  "site.tabLockedMessage": "시험 중 오픈 예정입니다.",
  "site.preRegistrationEnabled": true,
  "site.answerInputEnabled": true,
  "site.preRegistrationClosedMessage":
    "사전등록이 마감되었습니다. 답안 입력 오픈 후 다시 이용해 주세요.",
};

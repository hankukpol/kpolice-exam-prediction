import type { BonusType, ExamType, Gender, Role } from "@prisma/client";

export type UserRole = Role;
export type RecruitExamType = ExamType;
export type UserGender = Gender;
export type BonusCategory = BonusType;

export interface RegionRecruitInfo {
  name: string;
  recruitCount: number;
  recruitCountCareer: number;
}

export interface SubjectDefinition {
  name: string;
  examType: ExamType;
  questionCount: number;
  pointPerQuestion: number;
  maxScore: number;
}

export interface RegisterFormData {
  name: string;
  username: string;
  contactPhone: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
}

export interface LoginFormData {
  username: string;
  password: string;
}

export interface PasswordResetRequestFormData {
  username: string;
  email: string;
}

export interface ResetPasswordFormData {
  username: string;
  email: string;
  resetCode: string;
  password: string;
}

export interface ScoringSummary {
  totalRawScore: number;
  bonusScore: number;
  finalScore: number;
  isFailed: boolean;
}

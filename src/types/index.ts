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
  phone: string;
  password: string;
}

export interface LoginFormData {
  phone: string;
  password: string;
}

export interface ScoringSummary {
  totalRawScore: number;
  bonusScore: number;
  finalScore: number;
  isFailed: boolean;
}

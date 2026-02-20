import "server-only";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/validations";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/exam/login",
  },
  providers: [
    CredentialsProvider({
      name: "연락처 로그인",
      credentials: {
        phone: {
          label: "연락처",
          type: "text",
          placeholder: "010-1234-5678",
        },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const phone = normalizePhone(credentials?.phone ?? "");
        const password = credentials?.password?.trim();

        if (!phone || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { phone },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: String(user.id),
          name: user.name,
          phone: user.phone,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.phone = (user as { phone: string }).phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.phone = typeof token.phone === "string" ? token.phone : "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

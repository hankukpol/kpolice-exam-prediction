import "server-only";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import {
  consumeFixedWindowRateLimit,
  getFixedWindowRateLimitState,
  resetFixedWindowRateLimit,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { normalizeUsername } from "@/lib/validations";

const INSECURE_SECRETS = new Set([
  "change-this-to-a-long-random-string",
  "secret",
  "nextauth-secret",
  "",
]);

const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "";
const isProduction = process.env.NODE_ENV === "production";
const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!nextAuthSecret || INSECURE_SECRETS.has(nextAuthSecret)) {
  if (isProduction && !isNextBuildPhase) {
    throw new Error(
      "[auth] NEXTAUTH_SECRET\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uAE30\uBCF8\uAC12\uC785\uB2C8\uB2E4. \uD504\uB85C\uB355\uC158\uC5D0\uC11C\uB294 \uBC18\uB4DC\uC2DC \uC548\uC804\uD55C \uAC12\uC73C\uB85C \uBCC0\uACBD\uD574\uC57C \uD569\uB2C8\uB2E4."
    );
  }

  console.warn(
    "[auth] \uACBD\uACE0: NEXTAUTH_SECRET\uAC00 \uAE30\uBCF8\uAC12\uC785\uB2C8\uB2E4. \uD504\uB85C\uB355\uC158 \uBC30\uD3EC \uC804 \uBC18\uB4DC\uC2DC \uBCC0\uACBD\uD574\uC57C \uD569\uB2C8\uB2E4."
  );
}

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_IP_WINDOW_MS = 60 * 1000;
const LOGIN_IP_LIMIT = 20;

const LOGIN_USERNAME_FAILURE_NAMESPACE = "auth-login-username-failure";
const LOGIN_USERNAME_LOCK_NAMESPACE = "auth-login-username-lock";

type AppUser = User & {
  role: Role;
  username: string;
};

function getUsernameRateLimitState(username: string) {
  return getFixedWindowRateLimitState({
    namespace: LOGIN_USERNAME_LOCK_NAMESPACE,
    key: username,
    limit: 1,
    windowMs: LOGIN_FAILURE_WINDOW_MS,
  });
}

function recordLoginFailure(username: string) {
  const failureState = consumeFixedWindowRateLimit({
    namespace: LOGIN_USERNAME_FAILURE_NAMESPACE,
    key: username,
    limit: LOGIN_FAILURE_LIMIT,
    windowMs: LOGIN_FAILURE_WINDOW_MS,
  });

  if (!failureState.allowed || failureState.remaining === 0) {
    consumeFixedWindowRateLimit({
      namespace: LOGIN_USERNAME_LOCK_NAMESPACE,
      key: username,
      limit: 1,
      windowMs: LOGIN_FAILURE_WINDOW_MS,
    });
  }
}

function clearLoginFailures(username: string) {
  resetFixedWindowRateLimit({ namespace: LOGIN_USERNAME_FAILURE_NAMESPACE, key: username });
  resetFixedWindowRateLimit({ namespace: LOGIN_USERNAME_LOCK_NAMESPACE, key: username });
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "\uC544\uC774\uB514 \uB85C\uADF8\uC778",
      credentials: {
        username: {
          label: "\uC544\uC774\uB514",
          type: "text",
          placeholder: "\uC544\uC774\uB514\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
        },
        password: {
          label: "\uBE44\uBC00\uBC88\uD638",
          type: "password",
        },
        adminOnly: {
          label: "\uAD00\uB9AC\uC790 \uC804\uC6A9",
          type: "text",
        },
      },
      async authorize(credentials, request) {
        const username = normalizeUsername(credentials?.username ?? "");
        const password = credentials?.password?.trim() ?? "";
        const adminOnly = credentials?.adminOnly === "true";
        const clientIp = getClientIp(request);

        const ipRateLimit = consumeFixedWindowRateLimit({
          namespace: "auth-login-ip",
          key: clientIp,
          limit: LOGIN_IP_LIMIT,
          windowMs: LOGIN_IP_WINDOW_MS,
        });
        if (!ipRateLimit.allowed) {
          return null;
        }

        if (!username || !password) {
          return null;
        }

        const usernameRateLimit = getUsernameRateLimitState(username);
        if (!usernameRateLimit.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { phone: username } });
        if (!user) {
          recordLoginFailure(username);
          return null;
        }

        if (adminOnly && user.role !== "ADMIN") {
          recordLoginFailure(username);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          recordLoginFailure(username);
          return null;
        }

        clearLoginFailures(username);

        return {
          id: String(user.id),
          name: user.name,
          role: user.role,
          username: user.phone,
        } satisfies AppUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AppUser;
        token.id = authUser.id;
        token.role = authUser.role;
        token.username = authUser.username;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.username = typeof token.username === "string" ? token.username : "";
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

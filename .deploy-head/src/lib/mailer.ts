import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";

const MSG = {
  missingEnv: "\uD658\uACBD\uBCC0\uC218\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
  previewTitle: "\uBA54\uC77C \uD504\uB9AC\uBDF0",
  to: "\uBC1B\uB294 \uC0AC\uB78C",
  subject: "\uC81C\uBAA9",
  resetSubject: "[\uD569\uACA9\uC608\uCE21] \uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uC548\uB0B4",
  serviceName: "\uD569\uACA9\uC608\uCE21 \uC11C\uBE44\uC2A4",
  greetingSuffix: "\uB2D8,",
  bodyLine1: "\uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
  bodyLine2:
    "\uC544\uB798 \uC778\uC99D\uCF54\uB4DC\uB97C \uBE44\uBC00\uBC88\uD638 \uCC3E\uAE30 \uD654\uBA74\uC5D0 \uC785\uB825\uD558\uBA74 \uC0C8 \uBE44\uBC00\uBC88\uD638\uB97C \uC124\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  usernamePrefix: "\uC544\uC774\uB514",
  codePrefix: "\uC778\uC99D\uCF54\uB4DC",
  expireSuffix:
    "\uBD84 \uC548\uC5D0 \uC778\uC99D\uCF54\uB4DC\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694. \uC2DC\uAC04\uC774 \uC9C0\uB098\uBA74 \uC0C8 \uCF54\uB4DC\uB97C \uB2E4\uC2DC \uBC1B\uC544\uC57C \uD569\uB2C8\uB2E4.",
  ignoreLine:
    "\uBCF8\uC778\uC774 \uC694\uCCAD\uD558\uC9C0 \uC54A\uC558\uB2E4\uBA74 \uC774 \uBA54\uC77C\uC740 \uBB34\uC2DC\uD558\uC154\uB3C4 \uB429\uB2C8\uB2E4.",
  footer:
    "\uBCF8 \uBA54\uC77C\uC740 \uBC1C\uC2E0 \uC804\uC6A9\uC785\uB2C8\uB2E4. \uBB38\uC758\uAC00 \uD544\uC694\uD558\uBA74 \uC11C\uBE44\uC2A4 \uC6B4\uC601\uC790\uC5D0\uAC8C \uC5F0\uB77D\uD574 \uC8FC\uC138\uC694.",
};

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} ${MSG.missingEnv}`);
  }
  return value;
}

export function isMailerConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM_EMAIL
  );
}

function createTransport() {
  const port = Number(readRequired("SMTP_PORT"));
  return nodemailer.createTransport({
    host: readRequired("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: {
      user: readRequired("SMTP_USER"),
      pass: readRequired("SMTP_PASS"),
    },
  });
}

function getFromAddress(): string {
  const fromEmail = readRequired("SMTP_FROM_EMAIL");
  const fromName = process.env.SMTP_FROM_NAME?.trim();
  return fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
}

async function writePreviewMail(params: { to: string; subject: string; text: string; html: string }) {
  const previewDir = path.join(process.cwd(), ".tmp", "mail-previews");
  await mkdir(previewDir, { recursive: true });

  const filename = `password-reset-${Date.now()}.html`;
  const previewPath = path.join(previewDir, filename);
  const previewHtml = `
    <html lang="ko">
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 8px;">${MSG.previewTitle}</h1>
        <p><strong>${MSG.to}:</strong> ${params.to}</p>
        <p><strong>${MSG.subject}:</strong> ${params.subject}</p>
        <hr />
        ${params.html}
        <hr />
        <pre style="white-space: pre-wrap;">${params.text}</pre>
      </body>
    </html>
  `;

  await writeFile(previewPath, previewHtml, "utf8");
  return previewPath;
}

export async function sendPasswordResetCodeEmail(params: {
  to: string;
  name: string;
  username: string;
  code: string;
  expireMinutes: number;
}): Promise<{ previewFile?: string }> {
  const subject = MSG.resetSubject;
  const text = [
    MSG.serviceName,
    "",
    `${params.name}${MSG.greetingSuffix}`,
    "",
    MSG.bodyLine1,
    MSG.bodyLine2,
    "",
    `${MSG.usernamePrefix}: ${params.username}`,
    `${MSG.codePrefix}: ${params.code}`,
    `${params.expireMinutes}${MSG.expireSuffix}`,
    MSG.ignoreLine,
    "",
    MSG.footer,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background: #f3f4f6; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden;">
        <div style="background: #111827; color: #ffffff; padding: 20px 24px;">
          <div style="font-size: 13px; opacity: 0.8;">${MSG.serviceName}</div>
          <h1 style="margin: 8px 0 0; font-size: 22px; line-height: 1.3;">${MSG.resetSubject}</h1>
        </div>
        <div style="padding: 24px;">
          <p style="margin-top: 0;">${params.name}${MSG.greetingSuffix}</p>
          <p>${MSG.bodyLine1}</p>
          <p>${MSG.bodyLine2}</p>
          <div style="margin: 18px 0; padding: 16px; border-radius: 14px; background: #f9fafb; border: 1px solid #e5e7eb;">
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">${MSG.usernamePrefix}</div>
            <div style="font-size: 16px; font-weight: 600;">${params.username}</div>
          </div>
          <div style="margin: 18px 0; padding: 18px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe; text-align: center;">
            <div style="font-size: 13px; color: #1d4ed8; margin-bottom: 8px;">${MSG.codePrefix}</div>
            <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #111827;">${params.code}</div>
          </div>
          <p style="margin-bottom: 0;">${params.expireMinutes}${MSG.expireSuffix}</p>
          <p style="color: #b45309; margin-bottom: 0;">${MSG.ignoreLine}</p>
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
          ${MSG.footer}
        </div>
      </div>
    </div>
  `;

  if (!isMailerConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`SMTP ${MSG.missingEnv}`);
    }

    const previewFile = await writePreviewMail({ to: params.to, subject, text, html });
    return { previewFile };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: getFromAddress(),
    to: params.to,
    subject,
    text,
    html,
  });

  return {};
}

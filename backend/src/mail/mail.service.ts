import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PlatformSettingsService } from '../settings/platform-settings.service';

// Sends transactional email via SMTP. Configuration is resolved at send
// time from platform settings (admin panel) with env-var fallback, so
// changes from the admin panel apply immediately without a restart.
// When SMTP is not configured the service degrades gracefully: it logs
// the message instead of failing.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private cached: {
    signature: string;
    transporter: nodemailer.Transporter;
  } | null = null;

  constructor(private settings: PlatformSettingsService) {}

  private async resolveConfig() {
    const [host, portRaw, user, pass, from] = await Promise.all([
      this.settings.get('SMTP_HOST'),
      this.settings.get('SMTP_PORT'),
      this.settings.get('SMTP_USER'),
      this.settings.get('SMTP_PASS'),
      this.settings.get('SMTP_FROM'),
    ]);
    if (!host || !user || !pass) return null;
    return {
      host,
      port: Number(portRaw || 587),
      user,
      pass,
      from: from || 'حبقة Hubqa <no-reply@hubqa.app>',
    };
  }

  async isConfigured(): Promise<boolean> {
    return (await this.resolveConfig()) !== null;
  }

  private async getTransport() {
    const config = await this.resolveConfig();
    if (!config) return null;

    const signature = `${config.host}:${config.port}:${config.user}:${config.pass}`;
    if (!this.cached || this.cached.signature !== signature) {
      this.cached = {
        signature,
        transporter: nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465,
          auth: { user: config.user, pass: config.pass },
        }),
      };
      this.logger.log(`Mail transport configured via ${config.host}:${config.port}`);
    }
    return { transporter: this.cached.transporter, from: config.from };
  }

  private async send(to: string, subject: string, html: string) {
    const transport = await this.getTransport();
    if (!transport) {
      this.logger.warn(
        `[MAIL SKIPPED — SMTP not configured] to=${to} subject="${subject}"`,
      );
      return { sent: false };
    }
    try {
      await transport.transporter.sendMail({
        from: transport.from,
        to,
        subject,
        html,
      });
      this.logger.log(`Mail sent to ${to}: ${subject}`);
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send mail to ${to}: ${error.message}`);
      return { sent: false };
    }
  }

  private wrapTemplate(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string) {
    const button = ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto"><tr><td style="border-radius:12px;background:#2563eb">
           <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">${ctaLabel}</a>
         </td></tr></table>`
      : '';
    return `<!doctype html>
<html dir="rtl" lang="ar">
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Tahoma,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#2563eb;padding:22px;text-align:center">
          <span style="color:#ffffff;font-size:20px;font-weight:bold">حبقة Hubqa</span>
        </td></tr>
        <tr><td style="padding:32px 28px;text-align:right;direction:rtl">
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${title}</h1>
          <div style="font-size:15px;line-height:1.9;color:#374151">${bodyHtml}</div>
          ${button}
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">إذا لم تطلب هذا البريد فتجاهله بأمان.</p>
        </td></tr>
        <tr><td style="padding:18px;text-align:center;background:#f9fafb">
          <span style="font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} حبقة Hubqa — منصة الرد الآلي الذكي</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    const html = this.wrapTemplate(
      'إعادة تعيين كلمة المرور',
      `<p>وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في حبقة.</p>
       <p>اضغط الزر بالأسفل لاختيار كلمة مرور جديدة. الرابط صالح لمدة ساعة واحدة فقط.</p>`,
      resetUrl,
      'إعادة تعيين كلمة المرور',
    );
    return this.send(to, 'إعادة تعيين كلمة المرور — حبقة', html);
  }

  async sendVerificationCode(to: string, code: string) {
    const html = this.wrapTemplate(
      'رمز تفعيل حسابك',
      `<p>أهلاً بك في حبقة! استخدم الرمز التالي لتفعيل بريدك الإلكتروني:</p>
       <p style="text-align:center;margin:24px 0">
         <span style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:12px;padding:14px 28px;font-size:28px;font-weight:bold;letter-spacing:8px;color:#2563eb">${code}</span>
       </p>
       <p>الرمز صالح لمدة 30 دقيقة. لا تشاركه مع أي شخص.</p>`,
    );
    return this.send(to, `رمز التفعيل: ${code} — حبقة`, html);
  }

  async sendAnnouncement(to: string, subject: string, bodyHtml: string) {
    const html = this.wrapTemplate(subject, bodyHtml);
    return this.send(to, `${subject} — حبقة`, html);
  }

  async sendTestEmail(to: string) {
    const html = this.wrapTemplate(
      'إعدادات البريد تعمل بنجاح ✓',
      `<p>هذه رسالة اختبار من منصة حبقة.</p>
       <p>إذا وصلتك هذه الرسالة فإعدادات SMTP مضبوطة بشكل صحيح، وكل رسائل المنصة (التفعيل، استعادة كلمة المرور، الدعوات، النشرة) ستعمل تلقائياً.</p>`,
    );
    return this.send(to, 'رسالة اختبار — حبقة', html);
  }

  async sendTeamInvitation(
    to: string,
    inviteUrl: string,
    workspaceName: string,
    role: string,
  ) {
    const html = this.wrapTemplate(
      `دعوة للانضمام إلى "${workspaceName}"`,
      `<p>تمت دعوتك للانضمام إلى فريق <b>${workspaceName}</b> على منصة حبقة بدور <b>${role}</b>.</p>
       <p>اضغط الزر بالأسفل لقبول الدعوة وإنشاء كلمة مرورك. الدعوة صالحة لمدة 24 ساعة.</p>`,
      inviteUrl,
      'قبول الدعوة',
    );
    return this.send(to, `دعوة للانضمام إلى ${workspaceName} — حبقة`, html);
  }
}

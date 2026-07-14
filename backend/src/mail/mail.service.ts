import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PlatformSettingsService } from '../settings/platform-settings.service';

// Sends transactional email via SMTP. Configuration is resolved at send
// time from platform settings (admin panel) with env-var fallback, so
// changes from the admin panel apply immediately without a restart.
// When SMTP is not configured the service degrades gracefully: it logs
// the message instead of failing.
//
// Deliverability: every message is sent as multipart/alternative (a real
// plain-text part alongside the HTML), with an aligned envelope sender,
// a Reply-To, and — for bulk mail — a List-Unsubscribe header. These are
// the code-side factors that keep Gmail/Outlook from flagging us as spam.
// The DNS-side factors (SPF, DKIM, DMARC on the sending domain) must be
// configured separately at the domain registrar / mail provider.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private cached: {
    signature: string;
    transporter: nodemailer.Transporter;
  } | null = null;

  constructor(private settings: PlatformSettingsService) {}

  private async resolveConfig() {
    const [host, portRaw, user, pass, from, replyTo, frontendUrl] =
      await Promise.all([
        this.settings.get('SMTP_HOST'),
        this.settings.get('SMTP_PORT'),
        this.settings.get('SMTP_USER'),
        this.settings.get('SMTP_PASS'),
        this.settings.get('SMTP_FROM'),
        this.settings.get('SMTP_REPLY_TO'),
        this.settings.get('FRONTEND_URL'),
      ]);
    if (!host || !user || !pass) return null;
    return {
      host,
      port: Number(portRaw || 587),
      user,
      pass,
      from: from || 'حبقة Hubqa <no-reply@hubqa.app>',
      replyTo: replyTo || undefined,
      frontendUrl: frontendUrl || 'https://hubqa.app',
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
      this.logger.log(
        `Mail transport configured via ${config.host}:${config.port}`,
      );
    }
    return {
      transporter: this.cached.transporter,
      from: config.from,
      replyTo: config.replyTo,
      frontendUrl: config.frontendUrl,
    };
  }

  // Pull the bare address out of a "Name <addr@host>" string.
  private extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).trim();
  }

  private async send(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
    bulk?: boolean;
  }) {
    const transport = await this.getTransport();
    if (!transport) {
      this.logger.warn(
        `[MAIL SKIPPED — SMTP not configured] to=${opts.to} subject="${opts.subject}"`,
      );
      return { sent: false };
    }

    const fromEmail = this.extractEmail(transport.from);
    // Reply-To defaults to the sender address so replies never black-hole
    // silently; admins can point it at a real support inbox via settings.
    const replyTo = transport.replyTo || fromEmail;

    const headers: Record<string, string> = {};
    if (opts.bulk) {
      // Gmail/Yahoo bulk-sender rules require a functional unsubscribe.
      headers['List-Unsubscribe'] =
        `<mailto:${fromEmail}?subject=unsubscribe>, <${transport.frontendUrl}/dashboard/settings>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    try {
      await transport.transporter.sendMail({
        from: transport.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo,
        // Align the SMTP envelope (Return-Path) with the From address so
        // SPF checks pass on the sending domain.
        envelope: { from: fromEmail, to: opts.to },
        headers,
      });
      this.logger.log(`Mail sent to ${opts.to}: ${opts.subject}`);
      return { sent: true };
    } catch (error) {
      this.logger.error(
        `Failed to send mail to ${opts.to}: ${error.message}`,
      );
      return { sent: false };
    }
  }

  private wrapTemplate(
    title: string,
    bodyHtml: string,
    preheader: string,
    ctaUrl?: string,
    ctaLabel?: string,
  ) {
    const button = ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto"><tr><td style="border-radius:12px;background:#2563eb">
           <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:13px 34px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">${ctaLabel}</a>
         </td></tr></table>`
      : '';
    // A hidden preheader controls the inbox preview line and reads as a
    // legitimate, well-formed message to filters.
    const preheaderHtml = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${preheader}</div>`;
    return `<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Tahoma,Arial,sans-serif">
  ${preheaderHtml}
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
      'رابط إعادة تعيين كلمة المرور صالح لمدة ساعة.',
      resetUrl,
      'إعادة تعيين كلمة المرور',
    );
    const text = [
      'إعادة تعيين كلمة المرور — حبقة',
      '',
      'وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في حبقة.',
      'افتح الرابط التالي لاختيار كلمة مرور جديدة (صالح لمدة ساعة واحدة):',
      resetUrl,
      '',
      'إذا لم تطلب هذا البريد فتجاهله بأمان.',
      `© ${new Date().getFullYear()} حبقة Hubqa`,
    ].join('\n');
    return this.send({
      to,
      subject: 'إعادة تعيين كلمة المرور في حبقة',
      html,
      text,
    });
  }

  async sendVerificationCode(to: string, code: string) {
    const html = this.wrapTemplate(
      'رمز تفعيل حسابك',
      `<p>أهلاً بك في حبقة! استخدم الرمز التالي لتفعيل بريدك الإلكتروني:</p>
       <p style="text-align:center;margin:24px 0">
         <span style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:12px;padding:14px 28px;font-size:28px;font-weight:bold;letter-spacing:8px;color:#2563eb">${code}</span>
       </p>
       <p>الرمز صالح لمدة 30 دقيقة. لا تشاركه مع أي شخص.</p>`,
      'رمز تفعيل حسابك في حبقة صالح لمدة 30 دقيقة.',
    );
    const text = [
      'تفعيل بريدك الإلكتروني في حبقة',
      '',
      `رمز التفعيل الخاص بك هو: ${code}`,
      'الرمز صالح لمدة 30 دقيقة. لا تشاركه مع أي شخص.',
      '',
      'إذا لم تطلب هذا البريد فتجاهله بأمان.',
      `© ${new Date().getFullYear()} حبقة Hubqa`,
    ].join('\n');
    return this.send({
      to,
      subject: 'فعّل بريدك الإلكتروني في حبقة',
      html,
      text,
    });
  }

  async sendAnnouncement(to: string, subject: string, bodyHtml: string) {
    const html = this.wrapTemplate(
      subject,
      bodyHtml,
      subject,
    );
    // Plain-text fallback derived from the HTML body.
    const text = [
      subject,
      '',
      bodyHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      '',
      `© ${new Date().getFullYear()} حبقة Hubqa`,
    ].join('\n');
    return this.send({ to, subject, html, text, bulk: true });
  }

  async sendTestEmail(to: string) {
    const html = this.wrapTemplate(
      'إعدادات البريد تعمل بنجاح ✓',
      `<p>هذه رسالة اختبار من منصة حبقة.</p>
       <p>إذا وصلتك هذه الرسالة فإعدادات SMTP مضبوطة بشكل صحيح، وكل رسائل المنصة (التفعيل، استعادة كلمة المرور، الدعوات، النشرة) ستعمل تلقائياً.</p>`,
      'رسالة اختبار للتأكد من إعدادات البريد.',
    );
    const text = [
      'رسالة اختبار — حبقة',
      '',
      'هذه رسالة اختبار من منصة حبقة.',
      'إذا وصلتك هذه الرسالة فإعدادات SMTP مضبوطة بشكل صحيح.',
      '',
      `© ${new Date().getFullYear()} حبقة Hubqa`,
    ].join('\n');
    return this.send({ to, subject: 'رسالة اختبار من حبقة', html, text });
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
      `دعوة للانضمام إلى ${workspaceName} على حبقة.`,
      inviteUrl,
      'قبول الدعوة',
    );
    const text = [
      `دعوة للانضمام إلى ${workspaceName} — حبقة`,
      '',
      `تمت دعوتك للانضمام إلى فريق "${workspaceName}" بدور ${role}.`,
      'افتح الرابط التالي لقبول الدعوة وإنشاء كلمة مرورك (صالح لمدة 24 ساعة):',
      inviteUrl,
      '',
      `© ${new Date().getFullYear()} حبقة Hubqa`,
    ].join('\n');
    return this.send({
      to,
      subject: `دعوة للانضمام إلى ${workspaceName} على حبقة`,
      html,
      text,
    });
  }
}

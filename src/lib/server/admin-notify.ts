/**
 * 管理员告警邮件服务
 *
 * 使用 Resend 向 ADMIN_EMAILS 中的所有管理员发送告警邮件。
 */

import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import { createLogger } from '$lib/server/logger';

const log = createLogger('admin-notify');

interface AlertOptions {
    subject: string;
    html: string;
}

/**
 * 向所有管理员发送告警邮件
 */
export async function sendAdminAlert(opts: AlertOptions): Promise<void> {
    const adminEmails = getAdminEmails();
    if (adminEmails.length === 0) {
        log.warn('未配置 ADMIN_EMAILS，跳过告警邮件发送');
        return;
    }

    const apiKey = env.RESEND_API_KEY;
    const from = env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
        log.warn('未配置 RESEND_API_KEY 或 RESEND_FROM_EMAIL，跳过告警邮件发送');
        return;
    }

    const resend = new Resend(apiKey);

    for (const to of adminEmails) {
        try {
            const result = await resend.emails.send({
                from,
                to,
                subject: opts.subject,
                html: opts.html,
            });
            if (result.error) {
                log.error('发送告警邮件失败', { to, error: result.error.message });
            } else {
                log.info('已发送告警邮件', { to, subject: opts.subject });
            }
        } catch (error) {
            log.error('发送告警邮件异常', error instanceof Error ? error : new Error(String(error)), { to });
        }
    }
}

function getAdminEmails(): string[] {
    const raw = env.ADMIN_EMAILS ?? '';
    return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

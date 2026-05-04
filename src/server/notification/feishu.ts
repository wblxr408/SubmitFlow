/**
 * 飞书 Webhook 推送服务（选做）
 * 投递状态变化时触发飞书通知
 */
import { query } from '@/lib/db';
import { safeDecrypt } from '@/lib/crypto';
import { createLogger } from '@/lib/logger';
import axios from 'axios';
import type { UserNotification } from '@/types';

const log = createLogger('feishu');

const DEFAULT_PROFILE_ID = 1;

export interface FeishuPayload {
  company: string;
  job: string;
  status: string;
  source?: string;
}

const STATUS_TEXT: Record<string, string> = {
  screening: '投递成功',
  written_test: '进入笔试阶段',
  interview: '进入面试阶段',
  offer: '收到 Offer！',
  rejected: '流程结束',
  withdrawn: '已撤回',
};

export async function sendFeishuNotification(payload: FeishuPayload): Promise<void> {
  const notification = await query<UserNotification>(
    `SELECT * FROM user_notifications WHERE profile_id = $1 AND channel = 'feishu' AND status = 'active'`,
    [DEFAULT_PROFILE_ID],
  );

  if (!notification || notification.length === 0) {
    log.debug('Feishu notification not configured, skipping');
    return;
  }

  const config = notification[0];
  const webhookUrl = safeDecrypt(config.config_encrypted ?? '');
  if (!webhookUrl) {
    log.warn('Feishu webhook URL not found');
    return;
  }

  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: STATUS_TEXT[payload.status] ?? '投递状态更新' },
        template: payload.status === 'offer' ? 'green' : 'blue',
      },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: `**${payload.company}** · ${payload.job}` } },
        { tag: 'hr' },
        {
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: `来源：${payload.source ?? '手动更新'} · ${new Date().toLocaleString('zh-CN')}` },
          ],
        },
      ],
    },
  };

  try {
    await axios.post(webhookUrl, card, { timeout: 5000 });
    log.info({ company: payload.company, status: payload.status }, 'Feishu notification sent');
  } catch (err) {
    log.error({ err }, 'Feishu notification failed');
  }
}

export async function testFeishuWebhook(webhookUrl: string): Promise<boolean> {
  try {
    await axios.post(
      webhookUrl,
      {
        msg_type: 'text',
        content: { text: 'SubmitFlow 飞书通知配置成功！' },
      },
      { timeout: 5000 },
    );
    return true;
  } catch {
    return false;
  }
}

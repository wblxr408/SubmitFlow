'use client';
import { useState, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmailConnection {
  id: number;
  provider: string;
  status: string;
  last_synced_at: string | null;
}

interface PendingEmailItem {
  id: number;
  parsed_company: string | null;
  parsed_role: string | null;
  parsed_status: string | null;
  confidence: number | null;
  matched_application_id: number | null;
  matched_company_name: string | null;
  matched_job_title: string | null;
  created_at: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '从未同步';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [pendingEmails, setPendingEmails] = useState<PendingEmailItem[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch('/api/email/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadPendingEmails = async () => {
    const res = await fetch('/api/email/confirm');
    if (res.ok) {
      const data = await res.json();
      setPendingEmails(data.items ?? []);
    }
  };

  useEffect(() => {
    loadConnections();
    loadPendingEmails();
  }, []);

  const gmailConnected = connections.some((c) => c.provider === 'gmail' && c.status === 'active');

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/email/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(
          `同步完成：拉取 ${data.pulled}，解析 ${data.parsed}，自动更新 ${data.updated}，待确认 ${data.pending}`,
        );
        await loadConnections();
        await loadPendingEmails();
      } else {
        setSyncResult(`同步失败：${data.error}`);
      }
    } catch (err) {
      setSyncResult(`同步失败：${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('确定断开 Gmail 连接？')) return;
    const res = await fetch('/api/email/sync', { method: 'DELETE' });
    if (res.ok) {
      await loadConnections();
    }
  };

  const handlePendingAction = async (logId: number, action: 'confirm' | 'ignore') => {
    setProcessingId(logId);
    try {
      const res = await fetch('/api/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, action }),
      });
      const data = await res.json();
      setSyncResult(
        res.ok
          ? action === 'confirm'
            ? '已确认更新邮件状态'
            : '已忽略该邮件'
          : `处理失败：${data.error}`,
      );
      if (res.ok) {
        await loadPendingEmails();
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-text-primary">集成</h1>
      </div>

      {/* Gmail */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-bg-secondary">
              <span className="text-lg">✉</span>
            </div>
            <div>
              <CardTitle className="text-base">Gmail 邮件同步</CardTitle>
              <p className="mt-0.5 text-xs text-text-secondary">
                自动识别招聘通知邮件并更新投递状态
              </p>
            </div>
          </div>
          {gmailConnected ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              已连接
            </span>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { window.location.href = '/api/email/connect'; }}
            >
              连接 Gmail
            </Button>
          )}
        </div>

        {gmailConnected && (
          <div className="mt-4 border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">上次同步</span>
              <span className="text-text-primary">
                {formatDate(connections.find((c) => c.provider === 'gmail')?.last_synced_at ?? null)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                loading={syncing}
              >
                {syncing ? '同步中...' : '手动同步'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
              >
                断开连接
              </Button>
            </div>
            {syncResult && (
              <p className="text-xs text-text-secondary">{syncResult}</p>
            )}
          </div>
        )}
      </Card>

      {/* 飞书（选做） */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-bg-secondary">
              <span className="text-lg">⬡</span>
            </div>
            <div>
              <CardTitle className="text-base">飞书通知</CardTitle>
              <p className="mt-0.5 text-xs text-text-secondary">
                投递状态变化时推送提醒（选做）
              </p>
            </div>
          </div>
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-tertiary">
            即将支持
          </span>
        </div>
      </Card>

      {/* 来源配置 */}
      <Card>
        <CardTitle className="mb-3 text-base">抓取来源</CardTitle>
        <p className="text-sm text-text-secondary">
          在岗位库页手动触发抓取任务，来源配置由系统预设
        </p>
      </Card>

      <Card>
        <CardTitle className="mb-3 text-base">邮件待确认队列</CardTitle>
        {pendingEmails.length === 0 ? (
          <p className="text-sm text-text-secondary">暂无待确认邮件</p>
        ) : (
          <div className="space-y-3">
            {pendingEmails.map((item) => (
              <div key={item.id} className="rounded border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-text-primary">
                      {item.parsed_company ?? item.matched_company_name ?? '未知公司'}
                      {item.parsed_status ? ` · ${item.parsed_status}` : ''}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {item.parsed_role ?? item.matched_job_title ?? '未识别岗位'}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      置信度 {item.confidence?.toFixed(2) ?? '0.00'} · {formatDate(item.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!item.matched_application_id || processingId === item.id}
                      loading={processingId === item.id}
                      onClick={() => handlePendingAction(item.id, 'confirm')}
                    >
                      确认
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={processingId === item.id}
                      onClick={() => handlePendingAction(item.id, 'ignore')}
                    >
                      忽略
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

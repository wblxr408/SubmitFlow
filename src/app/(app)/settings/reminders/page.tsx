'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Reminder } from '@/types';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    days_before: '3',
    channel: 'email',
  });

  useEffect(() => {
    fetch('/api/reminders')
      .then((r) => r.json())
      .then((d) => { setReminders(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days_before: parseInt(form.days_before, 10),
          channel: form.channel,
        }),
      });
      const res = await fetch('/api/reminders');
      const data = await res.json();
      setReminders(data.items ?? []);
      setForm({ days_before: '3', channel: 'email' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number, is_enabled: boolean) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled }),
    });
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, is_enabled } : r));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条提醒配置？')) return;
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-text-primary">投递提醒</h1>
        <p className="mt-0.5 text-sm text-text-secondary">岗位截止前自动提醒，避免错过投递</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">添加提醒规则</h2>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary whitespace-nowrap">岗位截止前</span>
              <Input
                type="number"
                min="1"
                max="30"
                value={form.days_before}
                onChange={(e) => setForm({ ...form, days_before: e.target.value })}
                className="w-20"
              />
              <span className="text-sm text-text-secondary whitespace-nowrap">天提醒我</span>
            </div>
            <Select
              label="通知方式"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              options={[
                { value: 'email', label: '邮件' },
                { value: 'feishu', label: '飞书' },
                { value: 'both', label: '邮件 + 飞书' },
              ]}
            />
            <Button type="submit" loading={saving} size="sm">添加规则</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">已配置的提醒</h2>
          {loading ? (
            <div className="py-8 text-center text-sm text-text-tertiary">加载中...</div>
          ) : reminders.length === 0 ? (
            <p className="py-4 text-sm text-text-tertiary">暂无提醒规则，添加一条开始使用</p>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border border-border p-3">
                  <div>
                    <p className="text-sm text-text-primary">
                      截止前 {r.days_before} 天
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {r.channel === 'email' ? '邮件通知' : r.channel === 'feishu' ? '飞书通知' : '邮件 + 飞书'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.is_enabled ? 'bg-accent-blue' : 'bg-border'}`}
                      onClick={() => handleToggle(r.id, !r.is_enabled)}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${r.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => handleDelete(r.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

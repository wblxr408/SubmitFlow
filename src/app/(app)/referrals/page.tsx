'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Referral } from '@/types';

interface ReferralWithUsage extends Referral {
  usage_count: number;
  last_used_at: string | null;
}

const TAB_FILTERS = [
  { key: 'active', label: '我的内推' },
  { key: 'archived', label: '已归档' },
] as const;

type TabKey = (typeof TAB_FILTERS)[number]['key'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReferralCard({
  item,
  onEdit,
  onArchive,
  onDelete,
}: {
  item: ReferralWithUsage;
  onEdit: (item: ReferralWithUsage) => void;
  onArchive: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleArchive = async () => {
    setLoading(true);
    try { await onArchive(item.id); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('确定要彻底删除这条内推信息吗？')) return;
    setLoading(true);
    try { await onDelete(item.id); } finally { setLoading(false); }
  };

  const sourceLabel: Record<string, string> = {
    manual: '手动添加',
    import: '批量导入',
    feishu: '飞书',
  };

  return (
    <Card className="border-l-4 border-l-emerald-400">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-text-primary truncate">{item.company_name}</h3>
              <Badge variant="green" className="text-2xs">{sourceLabel[item.source] || item.source}</Badge>
            </div>
            {item.job_title && (
              <p className="text-sm text-text-secondary truncate">{item.job_title}</p>
            )}
            <div className="mt-2 space-y-1">
              {item.referrer_name && (
                <p className="text-xs text-text-tertiary">
                  <span className="text-text-secondary">推荐人：</span>{item.referrer_name}
                  {item.referrer_contact && ` · ${item.referrer_contact}`}
                </p>
              )}
              {item.referral_code && (
                <p className="text-xs text-text-tertiary">
                  <span className="text-text-secondary">内推码：</span>
                  <code className="bg-bg-secondary px-1 rounded text-text-primary">{item.referral_code}</code>
                </p>
              )}
              {item.notes && (
                <p className="text-xs text-text-tertiary line-clamp-2">{item.notes}</p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
              <span>使用 {item.usage_count ?? 0} 次</span>
              {item.last_used_at && <span>最近使用 {formatDate(item.last_used_at)}</span>}
              <span>添加于 {formatDate(item.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.entry_url && (
              <a
                href={item.entry_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded text-text-tertiary hover:text-accent-blue transition-colors"
                title="打开链接"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <button
              className="p-1.5 rounded text-text-tertiary hover:text-accent-blue transition-colors"
              onClick={() => onEdit(item)}
              title="编辑"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              className="p-1.5 rounded text-text-tertiary hover:text-amber-500 transition-colors"
              onClick={handleArchive}
              disabled={loading}
              title="归档"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
            <button
              className="p-1.5 rounded text-text-tertiary hover:text-red-500 transition-colors"
              onClick={handleDelete}
              disabled={loading}
              title="删除"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditModal({
  item,
  onSave,
  onClose,
}: {
  item?: ReferralWithUsage | null;
  onSave: (data: Partial<ReferralWithUsage>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    company_name: item?.company_name ?? '',
    job_title: item?.job_title ?? '',
    referrer_name: item?.referrer_name ?? '',
    referrer_contact: item?.referrer_contact ?? '',
    referral_code: item?.referral_code ?? '',
    entry_url: item?.entry_url ?? '',
    notes: item?.notes ?? '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          {item ? '编辑内推信息' : '添加内推信息'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="公司名称 *"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            required
          />
          <Input
            label="岗位名称"
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
          />
          <Input
            label="推荐人姓名"
            value={form.referrer_name}
            onChange={(e) => setForm({ ...form, referrer_name: e.target.value })}
          />
          <Input
            label="推荐人联系方式"
            value={form.referrer_contact}
            onChange={(e) => setForm({ ...form, referrer_contact: e.target.value })}
          />
          <Input
            label="内推码"
            value={form.referral_code}
            onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
          />
          <Input
            label="投递链接"
            type="url"
            value={form.entry_url}
            onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">备注</label>
            <textarea
              className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent-blue"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="其他备注..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
            <Button type="submit" loading={loading} disabled={!form.company_name}>
              {item ? '保存' : '添加'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [referrals, setReferrals] = useState<ReferralWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferralWithUsage | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: activeTab });
      if (keyword) params.set('keyword', keyword);
      const res = await fetch(`/api/referrals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReferrals(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeTab, keyword]);

  useEffect(() => { void fetchReferrals(); }, [fetchReferrals]);

  const handleArchive = async (id: number) => {
    await fetch(`/api/referrals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    setReferrals((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => prev - 1);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/referrals/${id}`, { method: 'DELETE' });
    setReferrals((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => prev - 1);
  };

  const handleSave = async (data: Partial<ReferralWithUsage>) => {
    if (editingItem) {
      const res = await fetch(`/api/referrals/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchReferrals();
        setEditingItem(null);
      }
    } else {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchReferrals();
      }
    }
    setShowModal(false);
  };

  const handleImport = async () => {
    setImportLoading(true);
    try {
      const lines = importText.trim().split('\n').filter(Boolean);
      const items = lines.map((line) => {
        const parts = line.split('\t').map((p) => p.trim());
        return {
          company_name: parts[0] ?? '',
          job_title: parts[1] ?? '',
          referrer_name: parts[2] ?? '',
          referral_code: parts[3] ?? '',
          notes: parts[4] ?? '',
        };
      }).filter((item) => item.company_name);

      const res = await fetch('/api/referrals/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      alert(`导入完成：成功 ${data.imported} 条，失败 ${data.errors} 条`);
      setShowImportModal(false);
      setImportText('');
      await fetchReferrals();
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">内推管理</h1>
          <p className="mt-0.5 text-sm text-text-secondary">共 {total} 条内推信息</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            批量导入
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setShowModal(true); }}>
            添加内推
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="搜索公司/推荐人/岗位..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void fetchReferrals()}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={() => void fetchReferrals()}>搜索</Button>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1">
          {TAB_FILTERS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'text-accent-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue" />}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        </div>
      ) : referrals.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-4 text-sm text-text-tertiary">暂无内推信息</p>
            <p className="mt-1 text-xs text-text-tertiary">添加或批量导入内推信息</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map((item) => (
            <ReferralCard
              key={item.id}
              item={item}
              onEdit={(i) => { setEditingItem(i); setShowModal(true); }}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showModal && (
        <EditModal
          item={editingItem}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
        />
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-text-primary">批量导入内推</h2>
            <p className="mb-2 text-sm text-text-secondary">
              每行一条，格式：<code className="text-xs">公司名称	岗位名称	推荐人	内推码	备注</code>（Tab 分隔，可留空）
            </p>
            <textarea
              className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent-blue"
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`字节跳动	后端开发	张三	ABC123	2024秋招\n腾讯	前端开发	李四	DEF456	暑期实习`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setShowImportModal(false); setImportText(''); }}>取消</Button>
              <Button onClick={() => void handleImport()} loading={importLoading} disabled={!importText.trim()}>
                开始导入
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Job, Tag } from '@/types';

interface FavoriteJob extends Job {
  id: number;
  profile_id: number;
  job_id: number;
  note: string | null;
  status: 'active' | 'archived';
  created_at: string;
  company_name: string;
  company_fame_score: number;
  tags: Tag[];
}

const TAB_FILTERS = [
  { key: 'active', label: '我的收藏' },
  { key: 'archived', label: '已归档' },
] as const;

type TabKey = (typeof TAB_FILTERS)[number]['key'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function FavoriteCard({
  item,
  tab,
  onRemove,
  onArchive,
  onRestore,
  onSaveNote,
}: {
  item: FavoriteJob;
  tab: TabKey;
  onRemove: (id: number) => Promise<void>;
  onArchive: (id: number) => Promise<void>;
  onRestore: (id: number) => Promise<void>;
  onSaveNote: (id: number, note: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);
  const [note, setNote] = useState(item.note ?? '');

  const handleRemove = async () => {
    if (!confirm('确定要删除这条收藏吗？')) return;
    setLoading(true);
    try {
      await onRemove(item.id);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await onArchive(item.id);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    setLoading(true);
    try {
      await onSaveNote(item.id, note);
      setNoteEditing(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card hover className="border-l-4 border-l-amber-400">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link href={`/jobs/${item.job_id}`} className="block">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-text-primary truncate hover:text-accent-blue transition-colors">
                  {item.title}
                </h3>
              </div>
              <p className="text-sm text-text-secondary truncate">
                {item.company_name}
                {item.city && ` · ${item.city}`}
              </p>
            </Link>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-text-tertiary">
              {item.deadline && <span>截止 {formatDate(item.deadline)}</span>}
              {item.internship_type && <span>{item.internship_type}</span>}
              <span>收藏于 {formatDate(item.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {tab === 'active' && (
              <>
                <button
                  className="p-1.5 rounded text-text-tertiary hover:text-amber-500 transition-colors"
                  onClick={() => setNoteEditing(!noteEditing)}
                  title="添加备注"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  className="p-1.5 rounded text-text-tertiary hover:text-text-primary transition-colors"
                  onClick={handleArchive}
                  disabled={loading}
                  title="归档收藏"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>
                <button
                  className="p-1.5 rounded text-text-tertiary hover:text-red-500 transition-colors"
                  onClick={handleRemove}
                  disabled={loading}
                  title="彻底删除"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            {tab === 'archived' && (
              <>
                <button
                  className="p-1.5 rounded text-text-tertiary hover:text-emerald-500 transition-colors"
                  onClick={() => {
                    setLoading(true);
                    void (async () => {
                      await onRestore(item.id);
                      setLoading(false);
                    })();
                  }}
                  disabled={loading}
                  title="恢复收藏"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  className="p-1.5 rounded text-text-tertiary hover:text-red-500 transition-colors"
                  onClick={handleRemove}
                  disabled={loading}
                  title="彻底删除"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {noteEditing && tab === 'active' && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                placeholder="添加备注..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSaveNote();
                  }
                }}
                className="flex-1 h-8 text-sm"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => void handleSaveNote()}
                disabled={!note.trim() || loading}
              >
                保存
              </Button>
            </div>
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((tag) => (
              <Badge key={tag.id} variant="default" className="text-2xs">
                {tag.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/favorites?status=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  const handleRemove = async (id: number) => {
    const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const handleArchive = async (id: number) => {
    const res = await fetch(`/api/favorites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    if (res.ok) {
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const handleRestore = async (id: number) => {
    const res = await fetch(`/api/favorites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (res.ok) {
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const handleSaveNote = async (id: number, note: string) => {
    await fetch(`/api/favorites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    setFavorites((prev) =>
      prev.map((f) => (f.id === id ? { ...f, note } : f)),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">我的收藏</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            共 {total} 个收藏岗位
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = `/api/export?type=favorites&format=csv`;
            window.open(url, '_blank');
          }}
        >
          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出 CSV
        </Button>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1">
          {TAB_FILTERS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
          <p className="mt-2 text-sm text-text-tertiary">加载中...</p>
        </div>
      ) : favorites.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <p className="mt-4 text-sm text-text-tertiary">暂无收藏</p>
            <p className="mt-1 text-xs text-text-tertiary">
              {activeTab === 'active'
                ? '在岗位库中点击收藏按钮添加'
                : '归档的收藏将显示在这里'}
            </p>
            {activeTab === 'active' && (
              <Link href="/jobs">
                <Button variant="outline" size="sm" className="mt-4">
                  去看看岗位库
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {favorites.map((item) => (
            <FavoriteCard
              key={item.id}
              item={item}
              tab={activeTab}
              onRemove={handleRemove}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onSaveNote={handleSaveNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

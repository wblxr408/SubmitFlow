'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface JobDetail {
  id: number;
  title: string;
  city: string | null;
  is_remote: boolean;
  internship_type: string | null;
  deadline: string | null;
  jd_text: string | null;
  conversion_rate: number | null;
  company_name: string;
  company_alias_names: string[];
  tags: Array<{ tag_id: number; tag_label: string; tag_color: string }>;
  entrypoints: Array<{
    id: number;
    entry_type: string;
    entry_url: string;
    visibility: string;
    referrer_name: string | null;
    status: string;
  }>;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  official: '官网直投',
  public_referral: '公开内推',
  private_referral: '私域内推',
  internal: '内部推荐',
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  official: 'default',
  public_referral: 'blue',
  private_referral: 'green',
  internal: 'orange',
};

function formatDeadline(deadline: string | null): { text: string; urgent: boolean } {
  if (!deadline) return { text: '无截止日期', urgent: false };
  const date = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: '已截止', urgent: false };
  if (diffDays <= 3) return { text: `${diffDays}天后截止`, urgent: true };
  if (diffDays <= 7) return { text: `${diffDays}天后截止`, urgent: true };
  return { text: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), urgent: false };
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/jobs/${jobId}`)
      .then((res) => {
        if (!res.ok) throw new Error('岗位不存在');
        return res.json();
      })
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // 检查收藏状态
    fetch(`/api/favorites/check?job_ids=${jobId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.favorited?.[0]?.is_favorited) {
          setIsFavorite(true);
        }
      })
      .catch(() => {});
  }, [jobId]);

  const handleApply = async (entrypointId: number) => {
    setApplying(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: parseInt(jobId, 10), job_entrypoint_id: entrypointId }),
      });
      if (res.ok) {
        setApplied(true);
      } else {
        const data = await res.json();
        alert(data.error ?? '投递失败');
      }
    } finally {
      setApplying(false);
    }
  };

  const handleToggleFavorite = async () => {
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        const res = await fetch(`/api/favorites?job_id=${jobId}`, { method: 'DELETE' });
        if (res.ok) {
          setIsFavorite(false);
        }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: parseInt(jobId, 10) }),
        });
        if (res.ok) {
          setIsFavorite(true);
        }
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-bg-secondary" />
        <Card className="animate-pulse">
          <div className="space-y-3">
            <div className="h-6 w-3/4 rounded bg-bg-secondary" />
            <div className="h-4 w-1/2 rounded bg-bg-secondary" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">{error ?? '岗位不存在'}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>
            返回
          </Button>
        </div>
      </div>
    );
  }

  const deadline = formatDeadline(job.deadline);
  const tags = job.tags ?? [];
  const entrypoints = job.entrypoints ?? [];
  const publicEntrypoints = entrypoints.filter((e) => e.visibility === 'public' && e.status === 'active');
  const privateEntrypoints = entrypoints.filter((e) => e.visibility === 'private' && e.status === 'active');

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-text-tertiary">
        <a href="/jobs" className="hover:text-text-secondary">岗位库</a>
        <span>›</span>
        <span className="text-text-secondary">{job.company_name}</span>
      </div>

      {/* 基础信息 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-text-secondary">{job.company_name}</span>
            {job.city && <Badge variant="default">{job.city}</Badge>}
            {job.is_remote && <Badge variant="green">可远程</Badge>}
            {job.internship_type && <Badge variant="default">{job.internship_type}</Badge>}
            <Badge variant={deadline.urgent ? 'yellow' : 'default'}>
              {deadline.text}
            </Badge>
            {job.conversion_rate && (
              <Badge variant="green">转正率 {job.conversion_rate}%</Badge>
            )}
          </div>
        </div>
        <button
          className={`shrink-0 p-2 rounded-full transition-all ${
            isFavorite
              ? 'bg-amber-50 text-amber-400 hover:bg-amber-100'
              : 'bg-bg-secondary text-text-tertiary hover:text-amber-400'
          } ${favoriteLoading ? 'opacity-50' : ''}`}
          onClick={() => void handleToggleFavorite()}
          disabled={favoriteLoading}
          title={isFavorite ? '取消收藏' : '添加收藏'}
        >
          <svg className="h-6 w-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* 标签 */}
      {tags.length > 0 && (
        <Card>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.tag_id}
                style={{ backgroundColor: tag.tag_color + '20', color: tag.tag_color, borderColor: tag.tag_color + '40' }}
                className="text-xs border"
              >
                {tag.tag_label}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* 职位描述 */}
      {job.jd_text && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-text-primary">职位描述</h2>
          <p className="whitespace-pre-wrap text-sm text-text-secondary leading-relaxed">
            {job.jd_text}
          </p>
        </Card>
      )}

      {/* 投递入口 */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-text-primary">投递入口</h2>

        {applied ? (
          <div className="rounded-md bg-emerald-50 p-4 text-center">
            <p className="font-medium text-emerald-700">已标记投递</p>
            <p className="mt-1 text-xs text-emerald-600">
              可在投递记录中追踪状态，Gmail 同步后将自动更新
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {publicEntrypoints.length > 0 ? (
              publicEntrypoints.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded border border-border p-3">
                  <div>
                    <Badge variant={ENTRY_TYPE_COLORS[entry.entry_type] as 'default' | 'blue' | 'green' | 'yellow' | 'red'}>
                      {ENTRY_TYPE_LABELS[entry.entry_type]}
                    </Badge>
                    {entry.referrer_name && (
                      <span className="ml-2 text-xs text-text-tertiary">推荐人: {entry.referrer_name}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={entry.entry_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent-blue hover:underline"
                    >
                      前往投递 →
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApply(entry.id)}
                      loading={applying}
                    >
                      标记已投递
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-tertiary">暂无投递入口</p>
            )}

            {privateEntrypoints.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">私域入口（仅你可见）</p>
                {privateEntrypoints.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="green">{ENTRY_TYPE_LABELS[entry.entry_type]}</Badge>
                      {entry.referrer_name && (
                        <span className="text-xs text-text-tertiary">推荐人: {entry.referrer_name}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={entry.entry_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent-blue hover:underline"
                      >
                        前往投递 →
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApply(entry.id)}
                        loading={applying}
                      >
                        标记已投递
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

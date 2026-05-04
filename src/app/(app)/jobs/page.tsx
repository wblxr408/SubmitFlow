'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Job, Tag } from '@/types';

interface JobListItem extends Job {
  company_name: string;
  tags: Tag[];
  has_referral: boolean;
}

export default function JobsPage() {
  const [keyword, setKeyword] = useState('');
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasReferralOnly, setHasReferralOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [favoriteLoading, setFavoriteLoading] = useState<number | null>(null);

  const search = useCallback(async (kw = keyword, pg = 1, referralOnly = hasReferralOnly) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ keyword: kw, page: String(pg) });
      if (referralOnly) {
        params.set('has_referral', 'true');
      }
      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setPage(pg);
      setTotal(data.total ?? 0);
      setHasNextPage(Boolean(data.hasNextPage));
    } finally {
      setLoading(false);
    }
  }, [hasReferralOnly, keyword]);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/favorites?status=active');
      if (res.ok) {
        const data = await res.json();
        setFavorites(new Set(data.items?.map((item: { job_id: number }) => item.job_id) ?? []));
      }
    } catch {
      // ignore
    }
  }, []);

  const runCrawl = async () => {
    setSyncing(true);
    try {
      await fetch('/api/crawl/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_type: 'incremental' }),
      });
      await search(keyword, 1, hasReferralOnly);
    } finally {
      setSyncing(false);
    }
  };

  const toggleFavorite = async (jobId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteLoading(jobId);
    try {
      if (favorites.has(jobId)) {
        const res = await fetch(`/api/favorites?job_id=${jobId}`, { method: 'DELETE' });
        if (res.ok) {
          setFavorites((prev) => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });
        }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        });
        if (res.ok) {
          setFavorites((prev) => new Set(prev).add(jobId));
        }
      }
    } finally {
      setFavoriteLoading(null);
    }
  };

  useEffect(() => {
    void search();
    void loadFavorites();
  }, [search, loadFavorites]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">岗位库</h1>
          <p className="mt-0.5 text-sm text-text-secondary">共 {total} 个有效岗位</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <Input
              placeholder="搜索公司或岗位..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
            />
            <Button onClick={() => void search()}>搜索</Button>
          </div>
          <Button variant="outline" onClick={runCrawl} loading={syncing}>
            手动抓取
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={hasReferralOnly}
          onChange={(e) => {
            const checked = e.target.checked;
            setHasReferralOnly(checked);
            void search(keyword, 1, checked);
          }}
          className="h-4 w-4 rounded border-border bg-bg-card text-accent-blue"
        />
        仅看可内推
      </label>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-text-tertiary">加载中...</div>
      ) : jobs.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded border border-dashed border-border text-sm text-text-tertiary">
          <span>暂无岗位</span>
          <Button variant="outline" size="sm" onClick={() => void search()}>
            刷新
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const tags = job.tags ?? [];

            return (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card hover className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-medium text-text-primary">{job.title}</h3>
                        {job.has_referral && <Badge variant="green">可内推</Badge>}
                      </div>
                      <p className="text-sm text-text-secondary">
                        {job.company_name}
                        {job.city && ` · ${job.city}`}
                        {job.internship_type && ` · ${job.internship_type}`}
                      </p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {tags.slice(0, 4).map((tag) => (
                            <Badge key={tag.id} variant="default" className="text-2xs">
                              {tag.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {job.deadline && <Badge variant="yellow">截止 {job.deadline}</Badge>}
                      {job.composite_score !== undefined && (
                        <span className="text-xs text-text-tertiary">综合分 {job.composite_score}</span>
                      )}
                    </div>
                  </div>
                  <button
                    className={`absolute right-4 top-4 p-1.5 rounded transition-all ${
                      favorites.has(job.id)
                        ? 'text-amber-400 hover:text-amber-500'
                        : 'text-text-tertiary hover:text-amber-400'
                    } ${favoriteLoading === job.id ? 'opacity-50' : ''}`}
                    onClick={(e) => void toggleFavorite(job.id, e)}
                    disabled={favoriteLoading === job.id}
                    title={favorites.has(job.id) ? '取消收藏' : '添加收藏'}
                  >
                    <svg className="h-5 w-5" fill={favorites.has(job.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </Card>
              </Link>
            );
          })}

          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => void search(keyword, page - 1)}
            >
              上一页
            </Button>
            <span className="flex items-center text-sm text-text-secondary">第 {page} 页</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => void search(keyword, page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

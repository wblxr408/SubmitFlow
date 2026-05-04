'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Job, RecommendationParams } from '@/types';

// ============================================================
// 常量
// ============================================================
const RANKING_PRESETS = {
  稳重型: {
    fame_weight: 0.4,
    match_weight: 0.2,
    city_weight: 0.2,
    deadline_weight: 0.1,
    conversion_weight: 0.1,
  },
  海投型: {
    fame_weight: 0.15,
    match_weight: 0.2,
    city_weight: 0.15,
    deadline_weight: 0.3,
    conversion_weight: 0.2,
  },
  精准型: {
    fame_weight: 0.1,
    match_weight: 0.4,
    city_weight: 0.2,
    deadline_weight: 0.1,
    conversion_weight: 0.2,
  },
} as const;

type PresetName = keyof typeof RANKING_PRESETS;

const WEIGHT_KEYS = ['fame_weight', 'match_weight', 'city_weight', 'deadline_weight', 'conversion_weight'] as const;
type WeightKey = (typeof WEIGHT_KEYS)[number];

const WEIGHT_LABELS: Record<WeightKey, string> = {
  fame_weight: '知名度',
  match_weight: '匹配度',
  city_weight: '城市',
  deadline_weight: '紧迫性',
  conversion_weight: '转正率',
};

const TIER_OPTIONS = [
  { value: 'top20', label: 'Top 20' },
  { value: 'top50', label: 'Top 50' },
  { value: 'top100', label: 'Top 100' },
  { value: 'top200', label: 'Top 200' },
  { value: 'all', label: '全部' },
] as const;

type TierValue = (typeof TIER_OPTIONS)[number]['value'];

const DEFAULT_WEIGHTS: RankingWeights = {
  fame_weight: 0.2,
  match_weight: 0.2,
  city_weight: 0.2,
  deadline_weight: 0.2,
  conversion_weight: 0.2,
};

// ============================================================
// 类型
// ============================================================
interface RankingWeights {
  fame_weight: number;
  match_weight: number;
  city_weight: number;
  deadline_weight: number;
  conversion_weight: number;
}

interface RecommendationResponse {
  items: RecommendationJob[];
  tier: string;
  weights: RankingWeights;
  preset: string | null;
}

interface ScoreBreakdown {
  fameScore: number;
  matchScore: number;
  cityScore: number;
  deadlineScore: number;
  conversionScore: number | null;
  freshnessScore: number;
}

interface RecommendationJob extends Job {
  company_name: string;
  company_fame_score: number;
  composite_score: number;
  has_referral?: boolean;
  score_breakdown?: ScoreBreakdown;
}

const DIMENSION_KEY_MAP: Record<WeightKey, keyof ScoreBreakdown> = {
  fame_weight: 'fameScore',
  match_weight: 'matchScore',
  city_weight: 'cityScore',
  deadline_weight: 'deadlineScore',
  conversion_weight: 'conversionScore',
};

// ============================================================
// 工具函数
// ============================================================
function getScoreColor(score: number): { bg: string; text: string } {
  if (score >= 60) return { bg: 'bg-emerald-500', text: 'text-emerald-700' };
  if (score >= 30) return { bg: 'bg-amber-500', text: 'text-amber-700' };
  return { bg: 'bg-red-500', text: 'text-red-700' };
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '无截止日期';
  const date = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `已截止`;
  if (diffDays === 0) return '今天截止';
  if (diffDays === 1) return '明天截止';
  if (diffDays <= 7) return `${diffDays}天后截止`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function hasReferral(job: RecommendationJob): boolean {
  return job.has_referral ?? false;
}

// ============================================================
// 骨架屏组件
// ============================================================
function JobCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-bg-secondary" />
          <div className="h-4 w-1/2 rounded bg-bg-secondary" />
        </div>
        <div className="h-6 w-16 rounded bg-bg-secondary" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-4 w-20 rounded bg-bg-secondary" />
        <div className="h-4 w-16 rounded bg-bg-secondary" />
      </div>
      <div className="mt-3 h-2 w-full rounded bg-bg-secondary" />
    </Card>
  );
}

// ============================================================
// 岗位卡片组件
// ============================================================
function JobCard({
  job,
  rank,
  onExpand,
  isExpanded,
}: {
  job: RecommendationJob;
  rank: number;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const scoreColor = getScoreColor(job.composite_score ?? 0);
  const canReferral = hasReferral(job);
  const deadlineText = formatDeadline(job.deadline);

  return (
    <Card hover className="cursor-pointer" onClick={onExpand}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-blue text-xs font-semibold text-white">
              {rank}
            </span>
            <h3 className="truncate text-base font-semibold text-text-primary">{job.title}</h3>
          </div>
          <p className="text-sm text-text-secondary">{job.company_name}</p>
          <div className="flex flex-wrap items-center gap-2">
            {job.city && (
              <Badge variant="default" className="text-xs">
                {job.city}
              </Badge>
            )}
            <Badge variant={deadlineText.includes('截止') ? 'yellow' : 'default'} className="text-xs">
              {deadlineText}
            </Badge>
            {canReferral && (
              <Badge variant="green" className="text-xs">
                可内推
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <span className={`text-lg font-bold ${scoreColor.text}`}>
              {job.composite_score ?? 0}
            </span>
            <span className="text-xs text-text-tertiary">分</span>
          </div>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary">
            <div
              className={`h-full ${scoreColor.bg} transition-all duration-300`}
              style={{ width: `${job.composite_score ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="mt-4 border-t border-border pt-4">
          <h4 className="mb-3 text-sm font-medium text-text-primary">为什么推荐？</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {WEIGHT_KEYS.map((key) => {
              const label = WEIGHT_LABELS[key];
              const weight = getDimensionScore(job, key);
              const displayScore = weight ?? 0;
              const color = weight === null
                ? { bg: 'bg-slate-300', text: 'text-text-tertiary' }
                : getScoreColor(displayScore);
              return (
                <div key={key} className="flex flex-col items-center gap-1 rounded bg-bg-secondary p-2">
                  <span className="text-xs text-text-secondary">{label}</span>
                  <span className={`text-sm font-semibold ${color.text}`}>{weight ?? '--'}</span>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-bg-primary">
                    <div className={`h-full ${color.bg}`} style={{ width: `${displayScore}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function getDimensionScore(job: RecommendationJob, dimension: WeightKey): number | null {
  const scoreKey = DIMENSION_KEY_MAP[dimension];
  const score = job.score_breakdown?.[scoreKey];
  if (typeof score === 'number') {
    return Math.round(score);
  }

  switch (dimension) {
    case 'fame_weight':
      return typeof job.company_fame_score === 'number' ? Math.round(job.company_fame_score) : null;
    case 'match_weight':
      return typeof job.composite_score === 'number' ? Math.round(job.composite_score) : null;
    case 'city_weight':
      return job.city ? 100 : 40;
    case 'deadline_weight':
      if (!job.deadline) return 30;
      {
        const days = Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0) return 0;
        if (days <= 3) return 100;
        if (days <= 7) return 80;
        if (days <= 14) return 60;
        return 40;
      }
    case 'conversion_weight':
      return typeof job.conversion_rate === 'number' ? Math.round(job.conversion_rate) : null;
    default:
      return null;
  }
}

// ============================================================
// 滑块组件
// ============================================================
function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-text-secondary">{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-bg-secondary accent-accent-blue"
      />
      <span className="text-xs font-medium text-text-primary">{value.toFixed(2)}</span>
    </div>
  );
}

// ============================================================
// 主页面组件
// ============================================================
export default function RecommendationsPage() {
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);
  const [activePreset, setActivePreset] = useState<PresetName | null>(null);
  const [tier, setTier] = useState<TierValue>('top20');
  const [hasReferral, setHasReferral] = useState(false);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const lastAppliedParamsRef = useRef('');

  const currentParams: RecommendationParams = {
    tier,
    has_referral: hasReferral,
    ...weights,
  };
  const currentParamsKey = JSON.stringify(currentParams);
  const hasPendingChanges =
    lastAppliedParamsRef.current !== '' && lastAppliedParamsRef.current !== currentParamsKey;

  const fetchRecommendations = useCallback(async (params: RecommendationParams) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (params.tier && params.tier !== 'all') searchParams.set('tier', params.tier);
      if (params.has_referral) searchParams.set('has_referral', 'true');
      if (params.fame_weight !== undefined) searchParams.set('fame_weight', params.fame_weight.toString());
      if (params.match_weight !== undefined) searchParams.set('match_weight', params.match_weight.toString());
      if (params.city_weight !== undefined) searchParams.set('city_weight', params.city_weight.toString());
      if (params.deadline_weight !== undefined) searchParams.set('deadline_weight', params.deadline_weight.toString());
      if (params.conversion_weight !== undefined) searchParams.set('conversion_weight', params.conversion_weight.toString());

      const response = await fetch(`/api/recommendations?${searchParams.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      if (requestId !== requestIdRef.current) return;
      setData(result);
      lastAppliedParamsRef.current = JSON.stringify(params);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to fetch recommendations:', error);
      setError('推荐榜单更新失败，请稍后重试');
    } finally {
      if (requestId !== requestIdRef.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecommendations({
      tier: 'top20',
      has_referral: false,
      ...DEFAULT_WEIGHTS,
    });
  }, [fetchRecommendations]);

  const handlePresetClick = (presetName: PresetName) => {
    const preset = RANKING_PRESETS[presetName];
    setWeights({ ...preset });
    setActivePreset(presetName);
  };

  const handleWeightChange = (key: WeightKey, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  };

  const handleTierChange = (newTier: TierValue) => {
    setTier(newTier);
  };

  const handleRefresh = () => {
    void fetchRecommendations(currentParams);
  };

  const toggleExpanded = (jobId: number) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  const jobs = data?.items ?? [];
  const isInitialLoading = isLoading && !data;
  const isRefreshing = isLoading && !!data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">推荐榜单</h1>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          <p>基于你的偏好自动推荐优质岗位</p>
          {isRefreshing && <span className="text-xs text-text-tertiary">更新中...</span>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">权重配置</CardTitle>
            <Button
              size="sm"
              variant={hasPendingChanges ? 'primary' : 'outline'}
              onClick={handleRefresh}
              loading={isLoading}
            >
              {hasPendingChanges ? '更新榜单' : '刷新榜单'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RANKING_PRESETS) as PresetName[]).map((name) => (
              <button
                key={name}
                onClick={() => handlePresetClick(name)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activePreset === name
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-border'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {WEIGHT_KEYS.map((key) => (
              <WeightSlider
                key={key}
                label={WEIGHT_LABELS[key]}
                value={weights[key]}
                onChange={(value) => handleWeightChange(key, value)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="has-referral"
              checked={hasReferral}
              onChange={(e) => setHasReferral(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-bg-card text-accent-blue focus:ring-accent-blue"
            />
            <label htmlFor="has-referral" className="cursor-pointer text-sm text-text-secondary">
              仅看可内推
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TIER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleTierChange(option.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              tier === option.value
                ? 'bg-text-primary text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-border'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && !isInitialLoading && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-600">{error}</p>
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isInitialLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      ) : error && jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium text-text-primary">推荐榜单加载失败</h3>
            <p className="mt-1 text-sm text-text-secondary">{error}</p>
            <Button className="mt-4" size="sm" onClick={handleRefresh}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mb-3 text-4xl">📭</div>
            <h3 className="text-lg font-medium text-text-primary">暂无数据</h3>
            <p className="mt-1 text-sm text-text-secondary">请先完成 AI 建档，或调整筛选条件</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              rank={index + 1}
              onExpand={() => toggleExpanded(job.id)}
              isExpanded={expandedJobId === job.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

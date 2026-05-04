'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type ApplicationStatus = 'screening' | 'written_test' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

interface ApplicationItem {
  id: number;
  job_id: number;
  job_entrypoint_id: number | null;
  status: ApplicationStatus;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  job_title: string;
  company_name: string;
  job_city: string | null;
  private_tags?: ApplicationPrivateTag[];
}

interface ApplicationPrivateTag {
  id: number;
  application_id: number;
  label: string;
  created_at: string;
}

interface ApplicationEvent {
  id: number;
  application_id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  source: string;
  source_ref: string | null;
  created_at: string;
}

interface StatusCount {
  all: number;
  screening: number;
  written_test: number;
  interview: number;
  offer: number;
  rejected: number;
  withdrawn: number;
}

interface EventsResponse {
  events: ApplicationEvent[];
}

interface ListResponse {
  items: ApplicationItem[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_LABELS: Record<ApplicationStatus | 'all', string> = {
  all: '全部',
  screening: '笔试中',
  written_test: '笔试中',
  interview: '面试中',
  offer: 'Offer',
  rejected: '已拒绝',
  withdrawn: '已撤回',
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  screening: 'border-l-indigo-500',
  written_test: 'border-l-purple-500',
  interview: 'border-l-amber-500',
  offer: 'border-l-emerald-500',
  rejected: 'border-l-red-500',
  withdrawn: 'border-l-gray-400',
};

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  screening: ['written_test', 'interview', 'offer', 'rejected', 'withdrawn'],
  written_test: ['interview', 'offer', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['rejected', 'withdrawn'],
  rejected: [],
  withdrawn: [],
};

const SOURCE_LABELS: Record<string, string> = {
  manual: '手动更新',
  email: '邮件同步',
  manual_feishu: '飞书更新',
};

const TAB_FILTERS: Array<{ key: ApplicationStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'screening', label: '笔试中' },
  { key: 'interview', label: '面试中' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'withdrawn', label: '已撤回' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  if (days < 365) return `${Math.floor(days / 30)}月前`;
  return `${Math.floor(days / 365)}年前`;
}

interface StatusHistoryProps {
  events: ApplicationEvent[];
}

function StatusHistory({ events }: StatusHistoryProps) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="mb-3 text-sm font-medium text-text-secondary">状态历史</h4>
      <div className="relative pl-4">
        <div className="absolute left-3 top-2 h-[calc(100%-8px)] w-px bg-border" />
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="relative flex gap-3">
              <div
                className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  index === events.length - 1
                    ? 'border-accent-blue bg-bg-card'
                    : 'border-border bg-bg-primary'
                }`}
              >
                {index === events.length - 1 && (
                  <div className="h-2 w-2 rounded-full bg-accent-blue" />
                )}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {event.from_status
                      ? `${STATUS_LABELS[event.from_status]} → ${STATUS_LABELS[event.to_status]}`
                      : `投递成功 → ${STATUS_LABELS[event.to_status]}`}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
                  <span>{formatDate(event.created_at)}</span>
                  <span className="text-text-tertiary">·</span>
                  <span>{SOURCE_LABELS[event.source] || event.source}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ApplicationCardProps {
  app: ApplicationItem;
  onStatusUpdate: (id: number, newStatus: ApplicationStatus) => Promise<void>;
  onTagAdd: (applicationId: number, label: string) => Promise<void>;
}

function ApplicationCard({ app, onStatusUpdate, onTagAdd }: ApplicationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  const canTransitions = VALID_TRANSITIONS[app.status];
  const canUpdate = canTransitions.length > 0;

  const toggleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (events.length === 0) {
      setLoadingEvents(true);
      try {
        const res = await fetch(`/api/applications/${app.id}`);
        if (res.ok) {
          const data: EventsResponse = await res.json();
          setEvents(data.events);
        }
      } catch {
        // ignore
      } finally {
        setLoadingEvents(false);
      }
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    try {
      await onStatusUpdate(app.id, selectedStatus as ApplicationStatus);
      setSelectedStatus('');
      const res = await fetch(`/api/applications/${app.id}`);
      if (res.ok) {
        const data: EventsResponse = await res.json();
        setEvents(data.events);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    setAddingTag(true);
    try {
      await onTagAdd(app.id, newTag.trim());
      setNewTag('');
    } finally {
      setAddingTag(false);
    }
  };

  const statusOptions = canTransitions.map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
  }));

  return (
    <Card
      className={`border-l-4 ${STATUS_COLORS[app.status]} cursor-pointer transition-all hover:shadow-card-hover`}
      onClick={toggleExpand}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-text-primary truncate">
                {app.company_name}
              </h3>
              <StatusBadge status={app.status} />
            </div>
            <p className="text-sm text-text-secondary truncate">{app.job_title}</p>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-text-tertiary">
              {app.job_city && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {app.job_city}
                </span>
              )}
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatRelativeTime(app.applied_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className={`p-1.5 rounded transition-colors ${
                expanded
                  ? 'rotate-180 text-accent-blue'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand();
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
            {app.job_entrypoint_id && (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="text-text-tertiary">投递入口：</span>
                <span className="text-text-secondary">内推</span>
              </div>
            )}

            {app.private_tags && app.private_tags.length > 0 && (
              <div className="mb-3">
                <span className="text-sm text-text-tertiary">私有标签：</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {app.private_tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary"
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="添加私有标签..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddTag}
                  loading={addingTag}
                  disabled={!newTag.trim()}
                >
                  添加
                </Button>
              </div>
            </div>

            {loadingEvents ? (
              <div className="py-4 text-center">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
              </div>
            ) : (
              <StatusHistory events={events} />
            )}

            {canUpdate && (
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                <Select
                  options={[{ value: '', label: '选择新状态...' }, ...statusOptions]}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="flex-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStatusUpdate}
                  loading={loading}
                  disabled={!selectedStatus}
                >
                  更新状态
                </Button>
              </div>
            )}

            {app.status === 'rejected' || app.status === 'withdrawn' ? (
              <div className="mt-4 border-t border-border pt-4 text-sm text-text-tertiary">
                此状态不可变更
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ApplicationsPage() {
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all');
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<StatusCount>({
    all: 0,
    screening: 0,
    written_test: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
  });

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        params.set('status', activeTab);
      }
      params.set('page', '1');
      params.set('page_size', '50');

      const res = await fetch(`/api/applications?${params.toString()}`);
      if (res.ok) {
        const data: ListResponse = await res.json();
        setApplications(data.items);
        setTotal(data.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchStatusCounts = useCallback(async () => {
    const res = await fetch('/api/applications?counts_only=true');
    if (res.ok) {
      const data: Record<string, number> = await res.json();
      setStatusCounts(data as unknown as StatusCount);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  const handleStatusUpdate = async (id: number, newStatus: ApplicationStatus) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      await fetchApplications();
      await fetchStatusCounts();
    }
  };

  const handleTagAdd = async (applicationId: number, label: string) => {
    const res = await fetch(`/api/applications/${applicationId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });

    if (res.ok) {
      await fetchApplications();
    }
  };

  const getTabCount = (tab: ApplicationStatus | 'all'): number => {
    if (tab === 'all') return statusCounts.all;
    return statusCounts[tab];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">投递记录</h1>
          <p className="mt-0.5 text-sm text-text-secondary">管理你的投递进度</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `/api/export?type=applications&format=csv${activeTab !== 'all' ? `&status=${activeTab}` : ''}`;
              window.open(url, '_blank');
            }}
          >
            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 CSV
          </Button>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1">
          {TAB_FILTERS.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-accent-blue'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs ${
                        isActive
                          ? 'bg-accent-blue/10 text-accent-blue'
                          : 'bg-bg-secondary text-text-tertiary'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue" />}
              </button>
            );
          })}
        </nav>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
          <p className="mt-2 text-sm text-text-tertiary">加载中...</p>
        </div>
      ) : applications.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-4 text-sm text-text-tertiary">暂无投递记录</p>
            <p className="mt-1 text-xs text-text-tertiary">从岗位库中标记投递后即可追踪</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onStatusUpdate={handleStatusUpdate}
              onTagAdd={handleTagAdd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

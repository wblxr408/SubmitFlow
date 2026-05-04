import Link from 'next/link';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDashboardData } from '@/server/dashboard';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string | null): string {
  if (!dateStr) {
    return '待更新';
  }

  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

export default async function HomePage() {
  const dashboard = await getDashboardData();
  const quickLinks = [
    { href: '/jobs', label: '岗位库', desc: '浏览全部岗位' },
    { href: '/recommendations', label: '推荐榜单', desc: 'AI 推荐的投递目标' },
    { href: '/match', label: 'AI 建档', desc: '明确你的求职方向' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">欢迎使用 SubmitFlow</h1>
        <p className="mt-1 text-sm text-text-secondary">管理你的实习与校招投递</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardDescription>待确认邮件</CardDescription>
              <CardTitle className="mt-2 text-2xl">{dashboard.pendingEmailCount}</CardTitle>
            </div>
            <Badge variant={dashboard.pendingEmailCount > 0 ? 'yellow' : 'default'}>
              {dashboard.pendingEmailCount > 0 ? '待处理' : '正常'}
            </Badge>
          </div>
        </Card>
        <Card>
          <CardDescription>近期截止岗位</CardDescription>
          <CardTitle className="mt-2 text-2xl">{dashboard.upcomingDeadlines.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>最近状态变更</CardDescription>
          <CardTitle className="mt-2 text-2xl">{dashboard.recentApplications.length}</CardTitle>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card hover>
              <CardTitle>{item.label}</CardTitle>
              <CardDescription className="mt-1">{item.desc}</CardDescription>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <CardTitle>近期截止</CardTitle>
            <Link href="/jobs">
              <Button size="sm" variant="outline">
                查看岗位库
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-text-tertiary">暂无近期截止岗位</p>
            ) : (
              dashboard.upcomingDeadlines.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block rounded-md border border-border p-3 transition-colors hover:bg-bg-secondary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{job.title}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {job.company_name}
                        {job.city ? ` · ${job.city}` : ''}
                      </p>
                    </div>
                    <Badge variant="yellow">{formatDate(job.deadline)}</Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <CardTitle>最近投递动态</CardTitle>
            <Link href="/applications">
              <Button size="sm" variant="outline">
                管理投递
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.recentApplications.length === 0 ? (
              <p className="text-sm text-text-tertiary">还没有投递记录，先去岗位库挑一个目标。</p>
            ) : (
              dashboard.recentApplications.map((application) => (
                <div key={application.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{application.job_title}</p>
                      <p className="mt-1 text-sm text-text-secondary">{application.company_name}</p>
                    </div>
                    <Badge variant={application.status as 'screening' | 'written_test' | 'interview' | 'offer' | 'rejected' | 'withdrawn'}>
                      {application.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-text-tertiary">
                    最近更新于 {formatDate(application.updated_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

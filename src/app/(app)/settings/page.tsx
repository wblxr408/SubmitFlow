'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';

const SHORTCUTS = [
  { keys: ['G', 'J'], desc: '跳转岗位库' },
  { keys: ['G', 'F'], desc: '跳转我的收藏' },
  { keys: ['G', 'A'], desc: '跳转投递记录' },
  { keys: ['G', 'H'], desc: '跳转首页' },
  { keys: ['/'], desc: '聚焦搜索框' },
  { keys: ['Esc'], desc: '关闭弹窗' },
  { keys: ['N'], desc: '新建会话（AI建档页）' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text-primary">设置</h1>
      </div>

      <Card>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-text-primary">外观</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded p-3 hover:bg-bg-secondary">
            <div>
              <span className="font-medium text-text-primary">主题模式</span>
              <p className="text-xs text-text-secondary">切换应用的外观主题</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-text-primary">快捷键</h2>
        </div>
        <div className="divide-y divide-border">
          {SHORTCUTS.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="rounded border border-border bg-bg-secondary px-2 py-0.5 text-xs font-mono text-text-primary">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <Link href="/settings/profile" className="block rounded p-3 hover:bg-bg-secondary">
            <span className="font-medium text-text-primary">个人资料</span>
            <p className="text-xs text-text-secondary">学校、专业、目标城市</p>
          </Link>
          <Link href="/settings/reminders" className="block rounded p-3 hover:bg-bg-secondary">
            <span className="font-medium text-text-primary">投递提醒</span>
            <p className="text-xs text-text-secondary">截止日期提醒配置</p>
          </Link>
          <Link href="/settings/ai" className="block rounded p-3 hover:bg-bg-secondary">
            <span className="font-medium text-text-primary">AI 服务商</span>
            <p className="text-xs text-text-secondary">配置 API Key 和任务路由</p>
          </Link>
          <Link href="/settings/integrations" className="block rounded p-3 hover:bg-bg-secondary">
            <span className="font-medium text-text-primary">集成</span>
            <p className="text-xs text-text-secondary">Gmail、飞书（选做）</p>
          </Link>
        </div>
      </Card>
    </div>
  );
}

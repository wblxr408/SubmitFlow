'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: '首页', icon: '⌂' },
  { href: '/jobs', label: '岗位库', icon: '⊞' },
  { href: '/favorites', label: '我的收藏', icon: '♥' },
  { href: '/referrals', label: '内推管理', icon: '✦' },
  { href: '/recommendations', label: '推荐榜单', icon: '★' },
  { href: '/applications', label: '投递记录', icon: '⊛' },
  { href: '/resumes', label: '简历管理', icon: '📄' },
  { href: '/match', label: 'AI 建档', icon: '◈' },
  { href: '/settings', label: '设置', icon: '⚙' },
] as const;

interface CurrentUser {
  id: number;
  email: string;
  nickname: string | null;
  role: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // 获取当前用户
    fetch('/api/auth/me')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    // 获取收藏数
    fetch('/api/favorites?status=active')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setFavoritesCount(data?.total ?? 0))
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      // ignore
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-52 flex-col border-r border-border bg-bg-card">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Link href="/" className="text-lg font-bold text-text-primary tracking-tight">
          SubmitFlow
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-bg-secondary text-text-primary'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
            )}
          >
            <span className="flex items-center gap-3">
              <span className="text-base">{item.icon}</span>
              {item.label}
            </span>
            {item.href === '/favorites' && favoritesCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-2xs font-medium text-amber-600">
                {favoritesCount > 99 ? '99+' : favoritesCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-bg-secondary"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-blue text-xs font-semibold text-white">
                {user.nickname?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 truncate text-left">
                <div className="truncate text-text-primary">
                  {user.nickname || user.email.split('@')[0]}
                </div>
              </div>
              <span className="text-text-tertiary">▼</span>
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded border border-border bg-bg-card shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <div className="truncate text-xs text-text-tertiary">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="block rounded bg-bg-secondary px-3 py-2 text-center text-sm text-text-secondary hover:bg-border hover:text-text-primary"
          >
            登录
          </Link>
        )}
        <div className="mt-2 rounded bg-bg-secondary px-3 py-2 text-xs text-text-tertiary">
          v1.3 · 多用户模式
        </div>
      </div>
    </aside>
  );
}

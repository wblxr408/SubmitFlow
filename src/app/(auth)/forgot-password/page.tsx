'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // 如果有 token，显示重置密码表单
  const isResetMode = !!token;

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '请求失败');
        return;
      }

      setSuccess(true);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 8) {
      setError('密码至少需要 8 个字符');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '重置失败');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-text-primary">SubmitFlow</h1>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isResetMode ? '设置新密码' : '找回密码'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 text-center">
                <div className="text-4xl">✓</div>
                <p className="text-text-primary">
                  {isResetMode
                    ? '密码重置成功！即将跳转到登录页...'
                    : '如果该邮箱已注册，将收到密码重置链接'}
                </p>
                {!isResetMode && (
                  <Link href="/login" className="text-accent-blue hover:underline">
                    返回登录
                  </Link>
                )}
              </div>
            ) : isResetMode ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="rounded bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Input
                  label="新密码"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 个字符"
                  required
                />

                <Input
                  label="确认密码"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  required
                />

                <Button type="submit" className="w-full" loading={loading}>
                  重置密码
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                {error && (
                  <div className="rounded bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <p className="text-sm text-text-secondary">
                  输入你的注册邮箱，我们将发送密码重置链接
                </p>

                <Input
                  label="邮箱"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />

                <Button type="submit" className="w-full" loading={loading}>
                  发送重置链接
                </Button>

                <p className="text-center text-sm text-text-secondary">
                  想起密码了？{' '}
                  <Link href="/login" className="text-accent-blue hover:underline">
                    返回登录
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4 text-text-secondary">
          加载中…
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}

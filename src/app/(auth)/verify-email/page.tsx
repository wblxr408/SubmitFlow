'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('验证链接无效');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || '验证失败');
          return;
        }

        setStatus('success');
        setMessage('邮箱验证成功！');
      } catch {
        setStatus('error');
        setMessage('网络错误，请稍后重试');
      }
    };

    verify();
  }, [token]);

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
            <CardTitle>邮箱验证</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-center">
              {status === 'loading' && (
                <>
                  <div className="text-4xl animate-spin">⏳</div>
                  <p className="text-text-secondary">验证中...</p>
                </>
              )}

              {status === 'success' && (
                <>
                  <div className="text-5xl">✓</div>
                  <p className="text-text-primary font-medium">{message}</p>
                  <p className="text-sm text-text-secondary">
                    现在你可以开始使用平台的所有功能
                  </p>
                  <Link href="/">
                    <Button className="mt-4">前往首页</Button>
                  </Link>
                </>
              )}

              {status === 'error' && (
                <>
                  <div className="text-5xl">✗</div>
                  <p className="text-red-600 font-medium">{message}</p>
                  <p className="text-sm text-text-secondary">
                    请检查链接是否正确，或联系技术支持
                  </p>
                  <Link href="/login">
                    <Button variant="secondary" className="mt-4">
                      返回登录
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4 text-text-secondary">
          加载中…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

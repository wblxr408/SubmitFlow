'use client';
import { useState, useEffect } from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Provider {
  id: number;
  provider_key: string;
  display_name: string;
  adapter_type: string;
}

interface SavedConfig {
  id: number;
  provider_id: number;
  provider_key: string;
  display_name: string | null;
  base_url: string | null;
  is_enabled: boolean;
}

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string; latency_ms?: number } | null>(null);

  useEffect(() => {
    fetch('/api/ai/providers')
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.providers ?? []);
        setConfigs(d.configs ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, []);

  const selectedProviderMeta = providers.find(
    (p) => String(p.id) === selectedProvider || p.provider_key === selectedProvider,
  );

  const handleTest = async () => {
    if (!selectedProvider && !apiKey) {
      setTestResult({ error: '请选择服务商并填写 API Key' });
      return;
    }
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProvider,
          api_key: apiKey,
          base_url: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('确定要删除此服务商配置吗？')) return;
    const res = await fetch(`/api/ai/providers/${configId}`, { method: 'DELETE' });
    if (res.ok) {
      setConfigs((prev) => prev.filter((c) => c.id !== configId));
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">AI 服务商配置</h1>
        <p className="mt-0.5 text-sm text-text-secondary">配置你的 AI API Key，服务端加密存储</p>
      </div>

      {/* 已配置的服务商 */}
      <Card>
        <CardTitle className="mb-3">已配置的服务商</CardTitle>
        {loadingProviders ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-bg-secondary" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <p className="text-sm text-text-tertiary">暂无配置。添加并测试连接后即可使用。</p>
        ) : (
          <div className="space-y-3">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                className="flex items-center justify-between rounded border border-border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {cfg.display_name ?? cfg.provider_key}
                    </span>
                    {cfg.is_enabled ? (
                      <Badge variant="green" className="text-2xs">已启用</Badge>
                    ) : (
                      <Badge variant="default" className="text-2xs">已禁用</Badge>
                    )}
                  </div>
                  {cfg.base_url && (
                    <p className="mt-0.5 text-xs text-text-tertiary">{cfg.base_url}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                  onClick={() => handleDelete(cfg.id)}
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 添加新服务商 */}
      <Card>
        <CardTitle>添加服务商</CardTitle>
        <CardDescription className="mb-4 mt-1">
          API Key 将通过 AES-256-GCM 加密后存储，不会明文保存
        </CardDescription>
        <div className="space-y-3">
          <Select
            label="服务商"
            value={selectedProvider}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProvider(e.target.value)}
            options={[
              { value: '', label: '请选择服务商...' },
              ...providers.map((p) => ({
                value: String(p.id),
                label: p.display_name || p.provider_key,
              })),
            ]}
          />
          <Input
            label="API Key"
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Input
            label="Base URL（可选）"
            placeholder="如使用代理或第三方兼容接口"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <Button onClick={handleTest} loading={saving}>
            测试并保存
          </Button>
        </div>
      </Card>

      {testResult && (
        <Card className={testResult.success ? 'border-green-500' : 'border-red-500'}>
          {testResult.success ? (
            <div className="text-sm text-green-700">
              连接成功（{testResult.latency_ms}ms）
            </div>
          ) : (
            <div className="text-sm text-red-600">连接失败：{testResult.error}</div>
          )}
        </Card>
      )}
    </div>
  );
}

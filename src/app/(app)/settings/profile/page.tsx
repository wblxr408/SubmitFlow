'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export default function ProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [techStacks, setTechStacks] = useState<Array<{ tag_id: number; tag_label: string; weight: number }>>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        const p = d.profile;
        if (!p) return;
        const set = (name: string, value: string) => {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(
            `[name="${name}"]`,
          );
          if (el) el.value = String(value ?? '');
        };
        set('school', p.school ?? '');
        set('major', p.major ?? '');
        if (p.graduation_year) set('graduation_year', String(p.graduation_year));
        set('target_cities', (p.target_cities ?? []).join(', '));
        set('internship_types', (p.internship_types ?? [])[0] ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/graph/preferences')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => {
        setTechStacks((d.detailed_prefs ?? []).filter((item: { weight: number }) => item.weight > 0));
      })
      .catch(() => {
        setTechStacks([]);
      });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const data = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">个人资料</h1>
        <p className="mt-0.5 text-sm text-text-secondary">完善信息以获得更准确的岗位推荐</p>
      </div>
      <Card>
        <CardTitle className="mb-4">基本信息</CardTitle>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-bg-secondary" />
            ))}
          </div>
        ) : (
          <form ref={formRef} onSubmit={save} className="space-y-4">
            <Input label="学校" name="school" placeholder="如：清华大学" />
            <Input label="专业" name="major" placeholder="如：计算机科学与技术" />
            <Select
              label="毕业年份"
              name="graduation_year"
              options={[
                { value: '', label: '请选择' },
                { value: '2025', label: '2025' },
                { value: '2026', label: '2026' },
                { value: '2027', label: '2027' },
                { value: '2028', label: '2028' },
              ]}
            />
            <Input label="目标城市" name="target_cities" placeholder="北京, 上海（逗号分隔）" />
            <Select
              label="实习类型"
              name="internship_type"
              options={[
                { value: '', label: '请选择' },
                { value: '日常实习', label: '日常实习' },
                { value: '暑期实习', label: '暑期实习' },
                { value: '寒假实习', label: '寒假实习' },
                { value: '秋招提前批', label: '秋招提前批' },
              ]}
            />
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={saving}>
                保存
              </Button>
              {saved && (
                <span className="text-sm text-emerald-600">保存成功</span>
              )}
            </div>
          </form>
        )}
      </Card>

      <Card>
        <CardTitle className="mb-4">技术评估偏好（用于推荐匹配）</CardTitle>
        {techStacks.length === 0 ? (
          <p className="text-sm text-text-secondary">暂无已保存技术栈，请到“技术评估建档”页选择并保存。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {techStacks.map((item) => (
              <span
                key={item.tag_id}
                className="rounded-full border border-border bg-bg-secondary px-2.5 py-1 text-xs text-text-primary"
              >
                {item.tag_label} · {item.weight.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

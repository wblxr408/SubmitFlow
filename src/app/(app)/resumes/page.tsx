'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Resume } from '@/types';

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTags, setSelectedTags] = useState('');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const loadResumes = () => {
    setLoading(true);
    fetch('/api/resumes')
      .then((r) => r.json())
      .then((d) => { setResumes(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadResumes(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInput?.files?.[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('tags', selectedTags);
    fd.append('notes', notes);
    fd.append('is_default', String(isDefault));

    try {
      await fetch('/api/resumes', { method: 'POST', body: fd });
      loadResumes();
      setSelectedTags('');
      setNotes('');
      setIsDefault(false);
      if (fileInput) fileInput.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    await fetch(`/api/resumes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    });
    loadResumes();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这份简历？')) return;
    await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
    loadResumes();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">简历管理</h1>
        <p className="mt-0.5 text-sm text-text-secondary">上传和管理你的简历，方便投递时快速选择</p>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-text-primary">上传新简历</h2>
        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <input
              ref={setFileInput as React.RefCallback<HTMLInputElement>}
              type="file"
              accept=".pdf,.doc,.docx"
              className="w-full rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-bg-secondary file:px-3 file:py-1 file:text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="标签，如：后端，暑期实习（逗号分隔）"
            value={selectedTags}
            onChange={(e) => setSelectedTags(e.target.value)}
            className="w-full rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent-blue"
          />
          <textarea
            placeholder="备注..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent-blue"
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-bg-card text-accent-blue"
            />
            设为默认简历
          </label>
          <Button type="submit" loading={uploading}>上传简历</Button>
        </form>
      </Card>

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        </div>
      ) : resumes.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-text-tertiary">暂无简历，上传第一份简历开始管理</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {resumes.map((r) => (
            <Card key={r.id} className={`${r.is_default ? 'border-l-4 border-l-accent-blue' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <a
                      href={r.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium text-text-primary hover:text-accent-blue transition-colors"
                    >
                      {r.original_name}
                    </a>
                    {r.is_default && <Badge variant="blue" className="text-2xs">默认</Badge>}
                  </div>
                  <p className="text-xs text-text-tertiary">
                    {formatSize(r.file_size)} · 上传于 {new Date(r.created_at).toLocaleDateString('zh-CN')}
                  </p>
                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.tags.map((tag, i) => (
                        <Badge key={i} variant="default" className="text-2xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  {r.notes && <p className="mt-1 text-xs text-text-secondary">{r.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!r.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefault(r.id)}>设为默认</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-red-500">删除</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

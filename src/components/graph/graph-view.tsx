'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphNode } from '@/types';
import { WeightPanel } from './weight-panel';
import { useToast } from '@/components/ui/toast';

interface StackItem {
  tag_id: number;
  slug: string;
  label: string;
  group_name: string;
  children?: StackItem[];
}

interface TrackItem {
  id: string;
  label: string;
  stacks: StackItem[];
}

interface DirectionItem {
  id: string;
  label: string;
  tracks: TrackItem[];
}

export function GraphView() {
  const { success, error } = useToast();
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [tagWeights, setTagWeights] = useState<Map<number, number>>(new Map());
  const [activeDirectionId, setActiveDirectionId] = useState<string>('');
  const [expandedTrackIds, setExpandedTrackIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [expandedStackIds, setExpandedStackIds] = useState<Set<number>>(new Set());
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 加载分类树（方向 -> 赛道 -> 技术栈）
  useEffect(() => {
    async function loadTaxonomy() {
      try {
        const res = await fetch('/api/graph/taxonomy', { credentials: 'include' });
        const data = await res.json();
        const loadedDirections = (data.directions || []) as DirectionItem[];
        setDirections(loadedDirections);

        if (loadedDirections.length > 0) {
          setActiveDirectionId(loadedDirections[0].id);
          const firstTrackIds = loadedDirections[0].tracks.slice(0, 2).map((t) => t.id);
          setExpandedTrackIds(new Set(firstTrackIds));
        }
      } catch (error) {
        console.error('Failed to load taxonomy:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTaxonomy();
  }, []);

  useEffect(() => {
    if (!activeDirectionId) return;
    const activeDirection = directions.find((dir) => dir.id === activeDirectionId);
    if (!activeDirection) return;
    const defaultExpanded = activeDirection.tracks.slice(0, 2).map((track) => `${activeDirection.id}:${track.id}`);
    setExpandedTrackIds(new Set(defaultExpanded));
  }, [activeDirectionId, directions]);

  // 加载标签权重
  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/graph/preferences', { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        const prefs = data.prefs || [];
        const weights = new Map<number, number>();
        const selected = new Set<number>();
        for (const pref of prefs) {
          weights.set(pref.tag_id, pref.weight);
          if (pref.weight > 0) {
            selected.add(pref.tag_id);
          }
        }
        setTagWeights(weights);
        setSelectedTagIds(selected);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    }
    loadPreferences();
  }, []);

  const toggleTrackExpanded = useCallback((trackKey: string) => {
    setExpandedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackKey)) {
        next.delete(trackKey);
      } else {
        next.add(trackKey);
      }
      return next;
    });
  }, []);

  // 点击技术栈切换选中状态
  const handleStackClick = useCallback(
    (stack: StackItem) => {
      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        if (next.has(stack.tag_id)) {
          next.delete(stack.tag_id);
        } else {
          next.add(stack.tag_id);
          if (!tagWeights.has(stack.tag_id)) {
            setTagWeights((w) => new Map(w).set(stack.tag_id, 0.5));
          }
        }
        return next;
      });
    },
    [tagWeights],
  );

  const toggleStackExpanded = useCallback((tagId: number) => {
    setExpandedStackIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  // 滑块变化处理（300ms 防抖）
  const handleWeightChange = useCallback(
    (tagId: number, weight: number) => {
      setTagWeights((prev) => new Map(prev).set(tagId, weight));

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/graph/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              tag_weights: [{ tag_id: tagId, weight }],
            }),
          });
          if (!res.ok) {
            throw new Error(`save failed: ${res.status}`);
          }
          setSaveState('success');
          setSaveMessage('已自动保存');
          success('技术偏好已自动保存');
      } catch (err) {
        console.error('Failed to save weight:', err);
        setSaveState('error');
        setSaveMessage('自动保存失败，请点击“保存全部”重试');
        error('自动保存失败');
        }
      }, 300);
    },
    [error, success],
  );

  // 一次性保存所有权重
  const handleSaveAll = useCallback(async () => {
    const weights = Array.from(selectedTagIds).map((tagId) => ({
      tag_id: tagId,
      weight: tagWeights.get(tagId) ?? 0.5,
    }));

    try {
      setSaveState('saving');
      setSaveMessage('保存中...');
      const res = await fetch('/api/graph/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tag_weights: weights, replace_all: true }),
      });
      if (!res.ok) {
        throw new Error(`save failed: ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || (weights.length > 0 && (data.updated_count ?? 0) <= 0)) {
        throw new Error('save acknowledged but no rows updated');
      }
      setSaveState('success');
      setSaveMessage('保存成功');
      success('技术偏好保存成功');
    } catch (err) {
      console.error('Failed to save all weights:', err);
      setSaveState('error');
      setSaveMessage('保存失败，请稍后重试');
      error('技术偏好保存失败');
    }
  }, [error, selectedTagIds, success, tagWeights]);

  const collectSelectedNodes = useCallback(
    (stack: StackItem, trackLabel: string, selected: Array<{ node: GraphNode; weight: number }>) => {
      if (selectedTagIds.has(stack.tag_id)) {
        selected.push({
          node: {
            id: stack.tag_id,
            parent_id: null,
            level: 3,
            label: `${stack.label} · ${trackLabel}`,
            tag_id: stack.tag_id,
            sort_order: 0,
            created_at: '',
          },
          weight: tagWeights.get(stack.tag_id) ?? 0.5,
        });
      }

      for (const child of stack.children ?? []) {
        collectSelectedNodes(child, `${trackLabel} / ${stack.label}`, selected);
      }
    },
    [selectedTagIds, tagWeights],
  );

  // 获取选中的节点信息
  const getSelectedNodes = useCallback((): Array<{ node: GraphNode; weight: number }> => {
    const selected: Array<{ node: GraphNode; weight: number }> = [];
    for (const direction of directions) {
      for (const track of direction.tracks) {
        for (const stack of track.stacks) {
          collectSelectedNodes(stack, track.label, selected);
        }
      }
    }
    return selected;
  }, [collectSelectedNodes, directions]);

  const renderStackNode = useCallback((stack: StackItem, depth: number = 0) => {
    const isSelected = selectedTagIds.has(stack.tag_id);
    const isExpanded = expandedStackIds.has(stack.tag_id);
    const hasChildren = (stack.children?.length ?? 0) > 0;

    return (
      <div
        key={stack.tag_id}
        className={`rounded-md border border-border p-2 ${depth > 0 ? 'bg-bg-secondary/50' : 'bg-bg-card'}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleStackClick(stack)}
            className={`rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
              isSelected
                ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                : 'border-border bg-bg-card text-text-primary hover:border-accent-blue/50'
            }`}
          >
            {stack.label}
          </button>
          {hasChildren && (
            <button
              onClick={() => toggleStackExpanded(stack.tag_id)}
              className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary"
            >
              {isExpanded ? '收起三级' : `展开三级 (${stack.children?.length ?? 0})`}
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-2 ml-2 space-y-2 border-l border-border pl-3">
            {stack.children?.map((child) => renderStackNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedStackIds, handleStackClick, selectedTagIds, toggleStackExpanded]);

  const activeDirection = directions.find((dir) => dir.id === activeDirectionId) ?? null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-secondary">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden rounded-md border border-border">
      {/* 左侧图谱区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <p className="mb-2 text-xs text-text-tertiary">第 1 层：先选大方向</p>
          <div className="flex flex-wrap gap-2">
            {directions.map((dir) => (
              <button
                key={dir.id}
                onClick={() => setActiveDirectionId(dir.id)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  activeDirectionId === dir.id
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-border bg-bg-card text-text-primary hover:border-accent-blue/50'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>

        {activeDirection && (
          <div className="space-y-3">
            <p className="text-xs text-text-tertiary">第 2 层：赛道，第 3 层：展开技术栈细分能力点</p>
            {activeDirection.tracks.map((track) => {
              const trackKey = `${activeDirection.id}:${track.id}`;
              const expanded = expandedTrackIds.has(trackKey);
              return (
                <div key={trackKey} className="rounded-md border border-border bg-bg-card p-3">
                  <button
                    onClick={() => toggleTrackExpanded(trackKey)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {track.label} ({track.stacks.length})
                    </span>
                    <span className="text-text-tertiary">{expanded ? '−' : '+'}</span>
                  </button>

                  {expanded && (
                    <div className="mt-3 grid gap-2">
                      {track.stacks.map((stack) => renderStackNode(stack))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!activeDirection && (
          <p className="text-sm text-text-secondary">暂无可用技术栈，请检查 tags 数据。</p>
        )}
        <div className="mt-4 text-xs text-text-tertiary">
          已选技术栈：{selectedTagIds.size}
        </div>
        {saveState !== 'idle' && (
          <div className={`mt-2 text-xs ${saveState === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      {/* 右侧权重面板 */}
      <div className="w-[280px] border-l border-border">
        <WeightPanel
          selectedNodes={getSelectedNodes()}
          tagWeights={tagWeights}
          onWeightChange={handleWeightChange}
          onSaveAll={handleSaveAll}
        />
      </div>
    </div>
  );
}

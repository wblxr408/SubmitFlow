'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphNode } from '@/types';
import { WeightPanel } from './weight-panel';

interface TagWeight {
  tag_id: number;
  weight: number;
  tag_label?: string;
  tag_slug?: string;
}

export function GraphView() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [tagWeights, setTagWeights] = useState<Map<number, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 加载节点数据
  useEffect(() => {
    async function loadNodes() {
      try {
        const res = await fetch('/api/graph/nodes');
        const data = await res.json();
        setNodes(data.nodes || []);
      } catch (error) {
        console.error('Failed to load nodes:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadNodes();
  }, []);

  // 加载标签权重
  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/graph/preferences');
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

  // 收集所有 L3 节点用于展示
  const flattenL3Nodes = useCallback((nodeList: GraphNode[]): GraphNode[] => {
    const result: GraphNode[] = [];
    for (const node of nodeList) {
      if (node.level === 3 && node.tag_id !== null) {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        result.push(...flattenL3Nodes(node.children));
      }
    }
    return result;
  }, []);

  // 根据 L3 节点获取其 L1/L2 父节点信息
  const getNodePath = useCallback(
    (nodeId: number, nodeList: GraphNode[]): { l1: string; l2: string } | null => {
      for (const node of nodeList) {
        if (node.id === nodeId) {
          return { l1: node.label, l2: '' };
        }
        if (node.children) {
          for (const child of node.children) {
            if (child.id === nodeId) {
              return { l1: node.label, l2: child.label };
            }
            if (child.children) {
              for (const l3 of child.children) {
                if (l3.id === nodeId) {
                  return { l1: node.label, l2: child.label };
                }
              }
            }
          }
        }
      }
      return null;
    },
    [],
  );

  // 点击 L3 节点切换选中状态
  const handleL3Click = useCallback(
    (node: GraphNode) => {
      if (node.tag_id === null) return;

      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.tag_id!)) {
          next.delete(node.tag_id!);
        } else {
          next.add(node.tag_id!);
          if (!tagWeights.has(node.tag_id!)) {
            setTagWeights((w) => new Map(w).set(node.tag_id!, 0.5));
          }
        }
        return next;
      });
    },
    [tagWeights],
  );

  // 滑块变化处理（300ms 防抖）
  const handleWeightChange = useCallback(
    (tagId: number, weight: number) => {
      setTagWeights((prev) => new Map(prev).set(tagId, weight));

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(async () => {
        try {
          await fetch('/api/graph/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tag_weights: [{ tag_id: tagId, weight }],
            }),
          });
        } catch (error) {
          console.error('Failed to save weight:', error);
        }
      }, 300);
    },
    [],
  );

  // 一次性保存所有权重
  const handleSaveAll = useCallback(async () => {
    const weights = Array.from(tagWeights.entries()).map(([tag_id, weight]) => ({
      tag_id,
      weight,
    }));

    try {
      await fetch('/api/graph/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_weights: weights }),
      });
    } catch (error) {
      console.error('Failed to save all weights:', error);
    }
  }, [tagWeights]);

  // 获取选中的节点信息
  const getSelectedNodes = useCallback((): Array<{ node: GraphNode; weight: number }> => {
    const allL3Nodes = flattenL3Nodes(nodes);
    const selected: Array<{ node: GraphNode; weight: number }> = [];

    for (const node of allL3Nodes) {
      if (node.tag_id !== null && selectedTagIds.has(node.tag_id)) {
        selected.push({
          node,
          weight: tagWeights.get(node.tag_id!) ?? 0.5,
        });
      }
    }

    return selected;
  }, [nodes, selectedTagIds, tagWeights, flattenL3Nodes]);

  if (isLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <p className="text-text-secondary">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-md border border-border">
      {/* 左侧图谱区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {nodes.map((l1Node) => (
            <div key={l1Node.id} className="space-y-3">
              {/* Level 1: 大方向 */}
              <div className="rounded-md border-2 border-border bg-bg-card p-3 font-bold text-text-primary">
                {l1Node.label}
              </div>

              {/* Level 2: 中类 */}
              {l1Node.children && l1Node.children.length > 0 && (
                <div className="ml-4 flex flex-wrap gap-2">
                  {l1Node.children.map((l2Node) => (
                    <div key={l2Node.id} className="space-y-2">
                      <div className="rounded-md border border-border bg-bg-card p-2.5 font-medium text-text-primary">
                        {l2Node.label}
                      </div>

                      {/* Level 3: 细分岗位 */}
                      {l2Node.children && l2Node.children.length > 0 && (
                        <div className="ml-4 flex flex-wrap gap-2">
                          {l2Node.children.map((l3Node) => {
                            const isSelected =
                              l3Node.tag_id !== null && selectedTagIds.has(l3Node.tag_id!);
                            return (
                              <button
                                key={l3Node.id}
                                onClick={() => handleL3Click(l3Node)}
                                className={`
                                  rounded-md border p-2 text-sm transition-colors
                                  ${
                                    isSelected
                                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                                      : 'border-border bg-bg-card text-text-primary hover:border-accent-blue/50'
                                  }
                                `}
                              >
                                {l3Node.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
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

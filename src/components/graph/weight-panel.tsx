'use client';

import type { GraphNode } from '@/types';
import { Button } from '@/components/ui/button';

interface WeightPanelProps {
  selectedNodes: Array<{ node: GraphNode; weight: number }>;
  tagWeights: Map<number, number>;
  onWeightChange: (tagId: number, weight: number) => void;
  onSaveAll: () => void;
}

export function WeightPanel({
  selectedNodes,
  tagWeights,
  onWeightChange,
  onSaveAll,
}: WeightPanelProps) {
  if (selectedNodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <p className="mb-2 text-sm text-text-secondary">暂无选中的技术栈</p>
        <p className="text-xs text-text-tertiary">
          选择左侧技术栈或展开第三级细分节点后添加
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 标题 */}
      <div className="border-b border-border p-3">
        <h3 className="text-sm font-semibold text-text-primary">
          标签权重 ({selectedNodes.length})
        </h3>
      </div>

      {/* 权重列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {selectedNodes.map(({ node, weight }) => (
            <div key={node.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {node.label}
                </span>
                <span className="text-sm tabular-nums text-text-secondary">
                  {weight.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weight}
                onChange={(e) =>
                  node.tag_id !== null && onWeightChange(node.tag_id, parseFloat(e.target.value))
                }
                className="h-2 w-full cursor-pointer rounded-full bg-border accent-accent-blue"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="border-t border-border p-3">
        <Button onClick={onSaveAll} className="w-full">
          保存全部
        </Button>
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { GraphNode } from '@/types';

const log = createLogger('api/graph/nodes');

interface GraphNodeRow {
  id: number;
  parent_id: number | null;
  level: number;
  label: string;
  tag_id: number | null;
  sort_order: number;
  created_at: string;
}

export async function GET() {
  try {
    const rows = await query<GraphNodeRow>(
      `SELECT id, parent_id, level, label, tag_id, sort_order, created_at
       FROM graph_nodes
       ORDER BY level, sort_order, label`,
    );

    const tree = buildTree(rows);
    return NextResponse.json({ nodes: tree });
  } catch (err) {
    log.error({ err }, 'Failed to load graph nodes');
    return NextResponse.json({ error: '加载图谱节点失败' }, { status: 500 });
  }
}

function buildTree(rows: GraphNodeRow[]): GraphNode[] {
  const map = new Map<number, GraphNode>();
  const roots: GraphNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, level: row.level as 1 | 2 | 3, children: [] });
  }
  for (const node of map.values()) {
    if (node.parent_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parent_id);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      }
    }
  }
  return roots;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parent_id, level, label, tag_id, sort_order } = body;

    if (!label || !level) {
      return NextResponse.json({ error: 'label and level are required' }, { status: 400 });
    }

    const row = await query<{ id: number }>(
      `INSERT INTO graph_nodes (parent_id, level, label, tag_id, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [parent_id ?? null, level, label, tag_id ?? null, sort_order ?? 0],
    );

    log.debug({ id: row[0]?.id, label }, 'Created graph node');
    return NextResponse.json(row[0], { status: 201 });
  } catch (err) {
    log.error({ err }, 'Failed to create graph node');
    return NextResponse.json({ error: '创建节点失败' }, { status: 500 });
  }
}

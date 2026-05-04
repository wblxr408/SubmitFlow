import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import type { AgentSession, AgentMessage, AiTaskType } from '@/types';
import { AIOrchestrator } from '@/server/ai';

const DEFAULT_PROFILE_ID = 1;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, session_id, message, provider_id, model_name } = body;

  if (action === 'create_session') {
    const row = await queryOne<AgentSession>(
      `INSERT INTO agent_sessions (profile_id, provider_id, model_name, result_json)
       VALUES ($1, $2, $3, '{}')
       RETURNING *`,
      [DEFAULT_PROFILE_ID, provider_id ?? null, model_name ?? null],
    );
    return NextResponse.json({ session: row });
  }

  if (action === 'send_message') {
    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }
    const session = await queryOne<AgentSession>(
      `SELECT * FROM agent_sessions WHERE id = $1 AND profile_id = $2`,
      [session_id, DEFAULT_PROFILE_ID],
    );
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    await query(
      `INSERT INTO agent_messages (session_id, role, content)
       VALUES ($1, 'user', $2)`,
      [session_id, message],
    );
    const messages = await query<AgentMessage>(
      `SELECT * FROM agent_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [session_id],
    );
    const orchestrator = new AIOrchestrator(DEFAULT_PROFILE_ID);
    const systemPrompt = `你是一个 CS/AI 方向的求职顾问。请通过对话帮助用户明确适合的实习/校招方向，并最终生成一份结构化的用户画像，包含：编程语言熟练度、技术栈偏好、项目经验、目标城市、目标实习类型、感兴趣方向、不感兴趣方向。请以 JSON 格式输出最终画像。`;
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    let reply = '';
    try {
      const result = await orchestrator.chat({ model: session.model_name ?? 'gpt-4o', messages: chatMessages });
      reply = result.content;
    } catch (err) {
      reply = `AI 服务暂时不可用: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
    await query(
      `INSERT INTO agent_messages (session_id, role, content)
       VALUES ($1, 'assistant', $2)`,
      [session_id, reply],
    );
    const isFinal = reply.includes('{') && reply.includes('}');
    if (isFinal) {
      try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const resultJson = JSON.parse(jsonMatch[0]);
          await execute(
            `UPDATE agent_sessions SET summary = $1, result_json = $2, updated_at = NOW()
             WHERE id = $3`,
            [reply.slice(0, 200), JSON.stringify(resultJson), session_id],
          );
        }
      } catch {
        // ignore parse errors
      }
    }
    return NextResponse.json({ reply, is_final: isFinal });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  if (!sessionId) {
    const sessions = await query<AgentSession>(
      `SELECT id, summary, created_at, updated_at FROM agent_sessions
       WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [DEFAULT_PROFILE_ID],
    );
    return NextResponse.json({ sessions });
  }
  const session = await queryOne<AgentSession>(
    `SELECT * FROM agent_sessions WHERE id = $1 AND profile_id = $2`,
    [parseInt(sessionId, 10), DEFAULT_PROFILE_ID],
  );
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  const messages = await query<AgentMessage>(
    `SELECT * FROM agent_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId],
  );
  return NextResponse.json({ session, messages });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  try {
    await execute(
      `DELETE FROM agent_sessions WHERE id = $1 AND profile_id = $2`,
      [parseInt(sessionId, 10), DEFAULT_PROFILE_ID],
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: '删除会话失败' }, { status: 500 });
  }
}

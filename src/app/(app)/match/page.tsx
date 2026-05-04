'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AgentSession, AgentMessage, AgentProfileResult } from '@/types';
import { GraphView } from '@/components/graph/graph-view';

// ============================================================
// Types
// ============================================================
interface SessionSummary {
  id: number;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage extends AgentMessage {
  parsedProfile?: AgentProfileResult | null;
}

// ============================================================
// Helpers
// ============================================================
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function extractJsonFromText(text: string): { pureText: string; json: AgentProfileResult | null } {
  const jsonPattern = /\{[\s\S]*\}/;
  const match = text.match(jsonPattern);

  if (!match) return { pureText: text, json: null };

  try {
    const parsed = JSON.parse(match[0]) as AgentProfileResult;
    const pureText = text.replace(match[0], '').trim();
    return { pureText, json: parsed };
  } catch {
    return { pureText: text, json: null };
  }
}

function parseMessageContent(content: string): ChatMessage['parsedProfile'] {
  const { json } = extractJsonFromText(content);
  return json ?? null;
}

// ============================================================
// ProfileCard — renders parsed JSON as structured card
// ============================================================
function ProfileCard({ profile }: { profile: AgentProfileResult }) {
  return (
    <div className="mt-3 space-y-3">
      {profile.summary && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">摘要</p>
          <p className="text-sm text-text-secondary">{profile.summary}</p>
        </div>
      )}

      {profile.tag_weights && profile.tag_weights.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
            技能偏好权重
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.tag_weights.map((item, idx) => (
              <Badge key={idx} variant="blue" className="font-normal">
                #{item.tag_id} ×{item.weight.toFixed(1)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {profile.target_cities && profile.target_cities.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
            目标城市
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.target_cities.map((city) => (
              <Badge key={city} variant="green">
                {city}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {profile.internship_types && profile.internship_types.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
            实习类型
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.internship_types.map((type) => (
              <Badge key={type} variant="yellow">
                {type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {profile.interested_directions && profile.interested_directions.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
            感兴趣方向
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.interested_directions.map((dir) => (
              <Badge key={dir} variant="blue">
                {dir}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {profile.uninterested_directions && profile.uninterested_directions.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
            不感兴趣方向
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.uninterested_directions.map((dir) => (
              <Badge key={dir} variant="red">
                {dir}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MessageBubble — single chat message
// ============================================================
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-3 shadow-card ${
          isUser
            ? 'bg-text-primary text-white rounded-br-md'
            : 'bg-bg-card text-text-primary rounded-bl-md border border-border'
        }`}
      >
        {/* Plain text part */}
        {extractJsonFromText(message.content).pureText && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {extractJsonFromText(message.content).pureText}
          </p>
        )}

        {/* Parsed JSON profile card */}
        {message.parsedProfile && <ProfileCard profile={message.parsedProfile} />}

        {/* Timestamp */}
        <p
          className={`text-2xs mt-1.5 ${
            isUser ? 'text-white/50 text-right' : 'text-text-tertiary'
          }`}
        >
          {new Date(message.created_at).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// WelcomePanel — shown when no session selected
// ============================================================
function WelcomePanel() {
  const tips = [
    '介绍你的技术栈和项目经验',
    '说说你的目标城市和实习偏好',
    '描述你感兴趣的 AI / 后端 / 前端方向',
    'AI 会综合分析并生成你的专属画像',
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-8">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent-blue/10">
        <span className="text-3xl">◈</span>
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">AI 建档助手</h2>
      <p className="text-sm text-text-secondary mb-8 max-w-sm">
        通过自然对话，帮助你明确适合的 CS/AI 实习和校招方向，并生成结构化画像用于精准推荐
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md text-left">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-bg-card border border-border p-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-blue/10 text-2xs font-semibold text-accent-blue">
              {i + 1}
            </span>
            <p className="text-xs text-text-secondary leading-snug">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function MatchPage() {
  const [activeTab, setActiveTab] = useState<'tree' | 'chat'>('tree');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Load session list
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/match/session');
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // silent fail
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load active session messages
  const loadSessionMessages = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/match/session?session_id=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();

      const msgs: ChatMessage[] = (data.messages ?? []).map((m: AgentMessage) => ({
        ...m,
        parsedProfile: parseMessageContent(m.content),
      }));
      setMessages(msgs);
      setActiveSession(data.session);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select session
  const handleSelectSession = (sessionId: number) => {
    setActiveSession((prev) => (prev?.id === sessionId ? prev : null));
    setMessages([]);
    loadSessionMessages(sessionId);
  };

  // Create new session
  const handleNewSession = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch('/api/match/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_session' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const session: AgentSession = data.session;

      const newSummary: SessionSummary = {
        id: session.id,
        summary: null,
        created_at: session.created_at,
        updated_at: session.updated_at,
      };
      setSessions((prev) => [newSummary, ...prev]);
      setActiveSession(session);
      setMessages([]);

      // Auto-send welcome message
      setIsSending(true);
      const replyRes = await fetch('/api/match/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          session_id: session.id,
          message: '你好，我是一名 CS/AI 方向的学生，想找暑期实习，请帮我明确方向。',
        }),
      });
      if (replyRes.ok) {
        const replyData = await replyRes.json();
        const userMsg: ChatMessage = {
          id: Date.now(),
          session_id: session.id,
          role: 'user',
          content: '你好，我是一名 CS/AI 方向的学生，想找暑期实习，请帮我明确方向。',
          created_at: new Date().toISOString(),
          parsedProfile: null,
        };
        const assistantMsg: ChatMessage = {
          id: Date.now() + 1,
          session_id: session.id,
          role: 'assistant',
          content: replyData.reply,
          created_at: new Date().toISOString(),
          parsedProfile: parseMessageContent(replyData.reply),
        };
        setMessages([userMsg, assistantMsg]);

        // Refresh sessions to get summary
        loadSessions();
      }
    } catch {
      // silent fail
    } finally {
      setIsSending(false);
    }
  };

  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() || !activeSession || isSending) return;

    const userText = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: ChatMessage = {
      id: Date.now(),
      session_id: activeSession.id,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
      parsedProfile: null,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await fetch('/api/match/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          session_id: activeSession.id,
          message: userText,
        }),
      });

      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: activeSession.id,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
        parsedProfile: parseMessageContent(data.reply),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update session summary locally
      if (data.is_final) {
        setActiveSession((prev) =>
          prev ? { ...prev, summary: userText.slice(0, 80) } : prev,
        );
        loadSessions();
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: activeSession.id,
        role: 'assistant',
        content: '发送失败，请稍后重试。',
        created_at: new Date().toISOString(),
        parsedProfile: null,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden rounded-lg border border-border bg-bg-card shadow-card">
        {/* ── Left sidebar: session list ── */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-border">
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <span className="text-sm font-semibold text-text-primary">历史会话</span>
            <button
              onClick={handleNewSession}
              disabled={isSending}
              className="flex h-6 w-6 items-center justify-center rounded bg-accent-blue text-white text-xs hover:bg-blue-600 disabled:opacity-50 transition-colors"
              title="新建会话"
            >
              +
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-2">
            {isLoadingSessions ? (
              <div className="space-y-2 px-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded bg-bg-secondary"
                  />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-text-tertiary">暂无会话记录</p>
                <button
                  onClick={handleNewSession}
                  className="mt-2 text-xs text-accent-blue hover:underline"
                >
                  开始第一次对话
                </button>
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={`w-full text-left px-3 py-2.5 mb-0.5 transition-colors ${
                    activeSession?.id === s.id
                      ? 'bg-accent-blue/10 border border-accent-blue/30 rounded'
                      : 'hover:bg-bg-secondary rounded'
                  }`}
                >
                  <p
                    className={`text-sm truncate ${
                      activeSession?.id === s.id ? 'font-medium text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {s.summary?.slice(0, 40) || '新会话'}
                  </p>
                  <p className="text-2xs text-text-tertiary mt-0.5">
                    {formatRelativeTime(s.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Right: main area ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header with Tabs */}
          <div className="flex h-12 shrink-0 items-center border-b border-border px-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('tree')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'tree'
                    ? 'border-accent-blue text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                技术评估建档
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'chat'
                    ? 'border-accent-blue text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                AI 对话辅助
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'tree' ? (
              <div className="h-full">
                <GraphView />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Chat header */}
                {activeSession && (
                  <div className="flex h-12 shrink-0 items-center border-b border-border px-6 gap-3">
                    <span className="text-sm font-semibold text-text-primary">
                      {activeSession.summary?.slice(0, 50) || 'AI 建档对话'}
                    </span>
                    {activeSession.model_name && (
                      <Badge variant="default" className="text-2xs">
                        {activeSession.model_name}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {!activeSession && <WelcomePanel />}

                  {isLoading && activeSession && (
                    <div className="flex items-center gap-2 text-text-tertiary">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs">正在思考…</span>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="shrink-0 border-t border-border bg-bg-secondary/50 px-6 py-4">
                  {activeSession ? (
                    <div className="flex items-end gap-3">
                      <div className="flex-1 relative">
                        <textarea
                          ref={textareaRef}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
                          disabled={isSending}
                          rows={1}
                          className="w-full resize-none rounded-md border border-border bg-bg-card px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent-blue disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ maxHeight: '120px', minHeight: '38px' }}
                        />
                        {/* Char count */}
                        {inputValue.length > 0 && (
                          <span className="absolute bottom-2 right-10 text-2xs text-text-tertiary">
                            {inputValue.length}
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isSending}
                        loading={isSending}
                        variant="primary"
                        size="md"
                      >
                        {isSending ? '发送中' : '发送'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Button
                        onClick={handleNewSession}
                        disabled={isSending}
                        loading={isSending}
                        variant="primary"
                        size="md"
                      >
                        开始新的建档对话
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

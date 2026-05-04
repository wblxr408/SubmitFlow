# Agent Messenger

Agent 间运行时消息传递工具。

## 工作原理

所有 Agent 通过读写 `.claude/shared_state.json` 进行通信：

```
Agent A 写入消息 → shared_state.json → Agent B 读取消息
```

## 消息格式

```json
{
  "id": "msg-001",
  "from": "bug-hunter",
  "to": "orchestrator",
  "type": "finding|request|response|alert",
  "severity": "critical|high|medium|low|info",
  "payload": {
    "file": "train.py",
    "line": 45,
    "description": "梯度未清零",
    "suggestion": "添加 optimizer.zero_grad()"
  },
  "timestamp": "2026-04-02T11:30:00",
  "requires_response": true
}
```

## 使用方式

### 发送消息
Agent 在执行过程中将发现写入 `shared_state.json` 的 `messages` 数组。

### 读取消息
Agent 在执行前先检查 `shared_state.json` 中是否有发给自己的消息。

### 协调流程

```
1. Orchestrator 设置 session_id，清空旧消息
2. 启动 Agent A，A 执行并写入消息
3. Orchestrator 检查 A 的消息
4. 如果 A 需要 B 的输入，Orchestrator 启动 B 并传递 A 的消息
5. B 读取 A 的消息，执行分析，写入结果
6. Orchestrator 汇总所有消息，生成最终报告
```

## Agent 间依赖处理

如果 Bug Hunter 发现了一个问题需要 Code Reviewer 确认：

```json
{
  "from": "bug-hunter",
  "to": "code-reviewer",
  "type": "request",
  "payload": {
    "action": "verify",
    "finding_id": "BUG-001",
    "question": "这个梯度问题是 bug 还是设计如此？"
  }
}
```

Code Reviewer 收到后：

```json
{
  "from": "code-reviewer",
  "to": "bug-hunter",
  "type": "response",
  "payload": {
    "finding_id": "BUG-001",
    "verdict": "confirmed_bug",
    "reason": "训练循环确实缺少 zero_grad()"
  }
}
```

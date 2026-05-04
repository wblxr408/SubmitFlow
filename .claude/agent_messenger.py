"""
Agent 间运行时消息传递工具（集成学习记忆）

使用方式：
  from agent_messenger import Messenger
  
  messenger = Messenger("bug-hunter")
  messenger.send("orchestrator", "finding", {"file": "train.py"})
  messages = messenger.receive()
  
  # 学习功能
  memory = messenger.getMemory()
  memory.recordBugPattern("missing_zero_grad", "train.py", 45, "梯度未清零", "添加 zero_grad()")
  similar = memory.findSimilarBugs("zero_grad")
  hotPatterns = memory.getHotPatterns(5)
"""

import json
import os
import uuid
from datetime import datetime

from agent_memory import AgentMemory


SHARED_STATE_PATH = os.path.join(".claude", "shared_state.json")


def loadState():
  """加载共享状态

  Returns:
    dict: 共享状态对象
  """
  if not os.path.exists(SHARED_STATE_PATH):
    return _createEmptyState()
  with open(SHARED_STATE_PATH, "r", encoding="utf-8") as f:
    return json.load(f)


def saveState(state):
  """保存共享状态

  Args:
    state (dict): 要保存的状态
  """
  os.makedirs(os.path.dirname(SHARED_STATE_PATH), exist_ok=True)
  with open(SHARED_STATE_PATH, "w", encoding="utf-8") as f:
    json.dump(state, f, indent=2, ensure_ascii=False)


def _createEmptyState():
  """创建空状态

  Returns:
    dict: 空状态对象
  """
  return {
    "version": "1.0",
    "session_id": str(uuid.uuid4()),
    "agents": {},
    "messages": [],
    "findings": [],
    "status": "idle"
  }


class Messenger:
  """Agent 间消息传递器

  提供 Agent 之间的运行时消息传递能力。
  """

  def __init__(self, agentName):
    """初始化消息传递器

    Args:
      agentName (str): 当前 Agent 名称
    """
    self.agentName = agentName
    self.state = loadState()
    self._registerAgent()

  def _registerAgent(self):
    """注册当前 Agent 到共享状态"""
    self.state["agents"][self.agentName] = {
      "status": "active",
      "last_active": datetime.now().isoformat()
    }
    saveState(self.state)

  def send(self, toAgent, msgType, payload, requiresResponse=False):
    """发送消息给另一个 Agent

    Args:
      toAgent (str): 目标 Agent 名称
      msgType (str): 消息类型 (finding/request/response/alert)
      payload (dict): 消息内容
      requiresResponse (bool): 是否需要响应

    Returns:
      str: 消息 ID
    """
    msg = {
      "id": f"msg-{uuid.uuid4().hex[:8]}",
      "from": self.agentName,
      "to": toAgent,
      "type": msgType,
      "payload": payload,
      "timestamp": datetime.now().isoformat(),
      "requires_response": requiresResponse
    }

    # 添加严重性（如果有）
    if "severity" in payload:
      msg["severity"] = payload["severity"]

    self.state = loadState()
    self.state["messages"].append(msg)
    saveState(self.state)
    return msg["id"]

  def receive(self, unreadOnly=True):
    """接收发送给当前 Agent 的消息

    Args:
      unreadOnly (bool): 只返回未读消息

    Returns:
      list: 消息列表
    """
    self.state = loadState()
    messages = []
    for msg in self.state["messages"]:
      if msg["to"] == self.agentName:
        if not unreadOnly or not msg.get("read", False):
          messages.append(msg)
          msg["read"] = True

    saveState(self.state)
    return messages

  def addFinding(self, category, severity, file, line, description, suggestion):
    """添加发现结果

    Args:
      category (str): 分类 (bug/security/performance/style/test)
      severity (str): 严重性
      file (str): 文件路径
      line (int): 行号
      description (str): 问题描述
      suggestion (str): 修复建议
    """
    finding = {
      "id": f"{category.upper()}-{uuid.uuid4().hex[:6]}",
      "agent": self.agentName,
      "category": category,
      "severity": severity,
      "file": file,
      "line": line,
      "description": description,
      "suggestion": suggestion,
      "timestamp": datetime.now().isoformat()
    }

    self.state = loadState()
    self.state["findings"].append(finding)
    saveState(self.state)

    # 同时发送给 Orchestrator
    self.send("orchestrator", "finding", finding)

  def getFindings(self, filterAgent=None, filterSeverity=None):
    """获取发现结果

    Args:
      filterAgent (str, optional): 按 Agent 过滤
      filterSeverity (str, optional): 按严重性过滤

    Returns:
      list: 发现结果列表
    """
    self.state = loadState()
    findings = self.state["findings"]

    if filterAgent:
      findings = [f for f in findings if f["agent"] == filterAgent]

    if filterSeverity:
      findings = [f for f in findings if f["severity"] == filterSeverity]

    return findings

  def updateStatus(self, status):
    """更新 Agent 状态

    Args:
      status (str): 状态 (active/idle/completed/error)
    """
    self.state = loadState()
    self.state["agents"][self.agentName]["status"] = status
    self.state["agents"][self.agentName]["last_active"] = datetime.now().isoformat()
    saveState(self.state)

  def getMemory(self):
    """获取当前 Agent 的学习记忆系统

    Returns:
      AgentMemory: 记忆实例
    """
    return AgentMemory(self.agentName)

  def recordFindingWithLearning(self, category, severity, file, line, description, suggestion):
    """添加发现结果并同步记录到学习系统

    Args:
      category (str): 分类 (bug/security/performance/style/test)
      severity (str): 严重性
      file (str): 文件路径
      line (int): 行号
      description (str): 问题描述
      suggestion (str): 修复建议

    Returns:
      str: 发现 ID
    """
    # 1. 记录到消息系统
    findingId = self.addFinding(category, severity, file, line, description, suggestion)

    # 2. 同步到学习系统
    memory = self.getMemory()
    memory.recordBugPattern(
      pattern=f"{category}_{description[:30]}",
      file=file,
      line=line,
      description=description,
      fix=suggestion,
      severity=severity
    )

    return findingId

  def getHistoricalFix(self, bugDescription):
    """查询历史中是否已有类似问题的修复方案

    Args:
      bugDescription (str): bug 描述

    Returns:
      dict or None: 历史修复方案
    """
    memory = self.getMemory()
    similar = memory.findSimilarBugs(bugDescription)
    if similar:
      bestPattern = similar[0]["pattern"]
      return memory.getBestFix(bestPattern)
    return None

  def clearSession(self):
    """清除当前会话的所有消息和发现"""
    self.state = _createEmptyState()
    saveState(self.state)


# 便捷函数
def sendQuick(fromAgent, toAgent, msgType, payload):
  """快速发送消息（不需要实例化 Messenger）

  Args:
    fromAgent (str): 发送方
    toAgent (str): 接收方
    msgType (str): 消息类型
    payload (dict): 消息内容
  """
  messenger = Messenger(fromAgent)
  messenger.send(toAgent, msgType, payload)


if __name__ == "__main__":
  # 演示用法
  print("=== Agent Messenger + Learning Demo ===\n")

  # Bug Hunter 发送发现（带学习）
  bh = Messenger("bug-hunter")
  bh.recordFindingWithLearning(
    category="bug",
    severity="critical",
    file="train.py",
    line=45,
    description="训练循环中缺少 optimizer.zero_grad()",
    suggestion="在 loss.backward() 前添加 optimizer.zero_grad()"
  )
  print("[Bug Hunter] 已发送发现并记录到学习系统")

  # Orchestrator 接收消息
  orch = Messenger("orchestrator")
  messages = orch.receive()
  print(f"\n[Orchestrator] 收到 {len(messages)} 条消息:")
  for msg in messages:
    print(f"  - 来自: {msg['from']}, 类型: {msg['type']}")

  # Bug Hunter 查询历史修复方案
  historicalFix = bh.getHistoricalFix("梯度清零")
  if historicalFix:
    print(f"\n[Bug Hunter] 找到历史修复方案:")
    print(f"  原始: {historicalFix['original_code']}")
    print(f"  修复: {historicalFix['fixed_code']}")
  else:
    print("\n[Bug Hunter] 未找到历史修复方案，将作为新模式记录")

  # 获取 Bug Hunter 的记忆报告
  memory = bh.getMemory()
  report = memory.getMemoryReport()
  print(f"\n=== Bug Hunter 记忆报告 ===")
  print(f"Bug 模式数: {report['bug_patterns']['total']}")
  print(f"修复记录数: {report['fix_history']['total']}")
  print(f"准确率: {report['accuracy']['accuracy']:.1%}")

  # 热门模式
  hotPatterns = memory.getHotPatterns(3)
  if hotPatterns:
    print(f"\n热门 Bug 模式:")
    for p in hotPatterns:
      print(f"  - {p['pattern']} (出现 {p['count']} 次)")

  # 获取所有 Agent 评分
  allScores = memory.getAllAgentScores()
  if allScores:
    print(f"\n各 Agent 准确率:")
    for agent, score in allScores.items():
      print(f"  - {agent}: {score['accuracy']:.1%} ({score['correct']}/{score['total']})")

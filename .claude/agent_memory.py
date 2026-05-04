"""
Agent 学习记忆系统

提供 Agent 从经验中学习的能力，包括：
1. Bug 模式学习：识别高频 bug 类型
2. 修复历史：记录什么问题用什么方案解决
3. 反馈评分：追踪各 Agent 的准确率
4. 审查统计：分析审查效果

使用方式：
  from agent_memory import AgentMemory
  
  memory = AgentMemory("bug-hunter")
  
  # 记录发现的 bug
  memory.recordBugPattern(
    pattern="missing_zero_grad",
    file="train.py",
    line=45,
    description="梯度未清零",
    fix="添加 optimizer.zero_grad()"
  )
  
  # 查询历史模式（相似问题是否出现过）
  similar = memory.findSimilarBugs("optimizer.zero_grad")
  
  # 获取高频 bug 模式
  hotPatterns = memory.getHotPatterns(topN=5)
  
  # 记录反馈
  memory.recordFeedback(
    finding_id="BUG-001",
    was_correct=True,
    comment="确实是 bug，已修复"
  )
  
  # 获取 Agent 准确率
  accuracy = memory.getAccuracy()
"""

import json
import os
import uuid
from datetime import datetime
from collections import Counter


MEMORY_DIR = os.path.join(".claude", "memory")


def _loadJson(filename):
  """加载 JSON 文件

  Args:
    filename (str): 文件名

  Returns:
    dict: JSON 内容
  """
  path = os.path.join(MEMORY_DIR, filename)
  if not os.path.exists(path):
    return {}
  with open(path, "r", encoding="utf-8") as f:
    return json.load(f)


def _saveJson(filename, data):
  """保存 JSON 文件

  Args:
    filename (str): 文件名
    data (dict): 要保存的数据
  """
  os.makedirs(MEMORY_DIR, exist_ok=True)
  path = os.path.join(MEMORY_DIR, filename)
  with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)


class AgentMemory:
  """Agent 学习记忆系统

  每个 Agent 拥有自己的记忆实例，用于：
  - 记录发现的问题模式
  - 查询历史修复方案
  - 追踪准确率和改进方向
  """

  def __init__(self, agentName):
    """初始化记忆系统

    Args:
      agentName (str): Agent 名称 (bug-hunter/code-reviewer/security-auditor/performance-analyzer/test-writer)
    """
    self.agentName = agentName
    self.bugPatterns = _loadJson("bug_patterns.json")
    self.fixHistory = _loadJson("fix_history.json")
    self.feedback = _loadJson("agent_feedback.json")
    self.reviewStats = _loadJson("review_stats.json")

  # ==================== Bug 模式学习 ====================

  def recordBugPattern(self, pattern, file, line, description, fix, severity="medium"):
    """记录发现的 bug 模式

    Args:
      pattern (str): bug 模式标识符（如 "missing_zero_grad"）
      file (str): 文件路径
      line (int): 行号
      description (str): 问题描述
      fix (str): 修复方案
      severity (str): 严重性

    Returns:
      str: 记录 ID
    """
    record = {
      "id": f"pattern-{uuid.uuid4().hex[:8]}",
      "agent": self.agentName,
      "pattern": pattern,
      "file": file,
      "line": line,
      "description": description,
      "fix": fix,
      "severity": severity,
      "count": 1,
      "first_seen": datetime.now().isoformat(),
      "last_seen": datetime.now().isoformat(),
      "confirmed_bugs": 0,
      "false_positives": 0
    }

    # 检查是否已有相同模式
    existing = self._findPattern(pattern)
    if existing:
      existing["count"] += 1
      existing["last_seen"] = datetime.now().isoformat()
    else:
      if "patterns" not in self.bugPatterns:
        self.bugPatterns["patterns"] = []
      self.bugPatterns["patterns"].append(record)

    # 更新统计
    if "stats" not in self.bugPatterns:
      self.bugPatterns["stats"] = {"total_scans": 0, "bugs_found": 0, "false_positives": 0, "accuracy_rate": 0.0}
    self.bugPatterns["stats"]["bugs_found"] += 1

    _saveJson("bug_patterns.json", self.bugPatterns)
    return record["id"]

  def findSimilarBugs(self, keyword):
    """查找历史中相似的 bug

    Args:
      keyword (str): 搜索关键词

    Returns:
      list: 相似 bug 列表
    """
    results = []
    for p in self.bugPatterns.get("patterns", []):
      if (keyword.lower() in p["pattern"].lower() or
          keyword.lower() in p["description"].lower() or
          keyword.lower() in p["fix"].lower()):
        results.append(p)
    return sorted(results, key=lambda x: x["count"], reverse=True)

  def getHotPatterns(self, topN=5):
    """获取高频 bug 模式

    Args:
      topN (int): 返回前 N 个

    Returns:
      list: 高频模式列表
    """
    patterns = self.bugPatterns.get("patterns", [])
    return sorted(patterns, key=lambda x: x["count"], reverse=True)[:topN]

  def confirmBug(self, patternId):
    """确认一个 bug 是真实存在的

    Args:
      patternId (str): 模式 ID
    """
    for p in self.bugPatterns.get("patterns", []):
      if p["id"] == patternId:
        p["confirmed_bugs"] += 1
        break
    _saveJson("bug_patterns.json", self.bugPatterns)

  def markFalsePositive(self, patternId):
    """标记一个 bug 是误报

    Args:
      patternId (str): 模式 ID
    """
    for p in self.bugPatterns.get("patterns", []):
      if p["id"] == patternId:
        p["false_positives"] += 1
        break
    self.bugPatterns["stats"]["false_positives"] += 1
    _saveJson("bug_patterns.json", self.bugPatterns)

  # ==================== 修复历史 ====================

  def recordFix(self, bugPattern, file, originalCode, fixedCode, success=True):
    """记录一次修复操作

    Args:
      bugPattern (str): bug 模式标识符
      file (str): 文件路径
      originalCode (str): 原始代码
      fixedCode (str): 修复后代码
      success (bool): 修复是否成功

    Returns:
      str: 记录 ID
    """
    record = {
      "id": f"fix-{uuid.uuid4().hex[:8]}",
      "agent": self.agentName,
      "bug_pattern": bugPattern,
      "file": file,
      "original_code": originalCode,
      "fixed_code": fixedCode,
      "success": success,
      "timestamp": datetime.now().isoformat()
    }

    if "fixes" not in self.fixHistory:
      self.fixHistory["fixes"] = []
    self.fixHistory["fixes"].append(record)

    # 更新统计
    if "stats" not in self.fixHistory:
      self.fixHistory["stats"] = {"total_fixes": 0, "successful_fixes": 0, "failed_fixes": 0, "success_rate": 0.0}
    self.fixHistory["stats"]["total_fixes"] += 1
    if success:
      self.fixHistory["stats"]["successful_fixes"] += 1
    else:
      self.fixHistory["stats"]["failed_fixes"] += 1

    total = self.fixHistory["stats"]["total_fixes"]
    if total > 0:
      self.fixHistory["stats"]["success_rate"] = self.fixHistory["stats"]["successful_fixes"] / total

    _saveJson("fix_history.json", self.fixHistory)
    return record["id"]

  def getFixForPattern(self, bugPattern):
    """获取某个 bug 模式的历史修复方案

    Args:
      bugPattern (str): bug 模式标识符

    Returns:
      list: 历史修复方案
    """
    fixes = [f for f in self.fixHistory.get("fixes", [])
             if f["bug_pattern"] == bugPattern and f["success"]]
    return sorted(fixes, key=lambda x: x["timestamp"], reverse=True)

  def getBestFix(self, bugPattern):
    """获取最佳修复方案（最新的成功修复）

    Args:
      bugPattern (str): bug 模式标识符

    Returns:
      dict or None: 最佳修复方案
    """
    fixes = self.getFixForPattern(bugPattern)
    return fixes[0] if fixes else None

  # ==================== 反馈与准确率 ====================

  def recordFeedback(self, findingId, wasCorrect, comment=""):
    """记录对某个发现的反馈

    Args:
      findingId (str): 发现 ID
      wasCorrect (bool): 是否正确
      comment (str): 反馈备注
    """
    record = {
      "id": f"fb-{uuid.uuid4().hex[:8]}",
      "agent": self.agentName,
      "finding_id": findingId,
      "was_correct": wasCorrect,
      "comment": comment,
      "timestamp": datetime.now().isoformat()
    }

    if "feedback" not in self.feedback:
      self.feedback["feedback"] = []
    self.feedback["feedback"].append(record)

    # 更新 Agent 评分
    if "agent_scores" not in self.feedback:
      self.feedback["agent_scores"] = {}
    if self.agentName not in self.feedback["agent_scores"]:
      self.feedback["agent_scores"][self.agentName] = {"correct": 0, "total": 0, "accuracy": 0.0}

    score = self.feedback["agent_scores"][self.agentName]
    score["total"] += 1
    if wasCorrect:
      score["correct"] += 1
    score["accuracy"] = score["correct"] / score["total"]

    _saveJson("agent_feedback.json", self.feedback)

  def getAccuracy(self):
    """获取当前 Agent 的准确率

    Returns:
      dict: 准确率信息
    """
    scores = self.feedback.get("agent_scores", {})
    return scores.get(self.agentName, {"correct": 0, "total": 0, "accuracy": 0.0})

  def getAllAgentScores(self):
    """获取所有 Agent 的评分

    Returns:
      dict: 各 Agent 评分
    """
    return self.feedback.get("agent_scores", {})

  # ==================== 审查统计 ====================

  def recordReview(self, filesReviewed, issuesFound, issuesFixed):
    """记录一次审查

    Args:
      filesReviewed (int): 审查文件数
      issuesFound (int): 发现问题数
      issuesFixed (int): 修复问题数
    """
    record = {
      "id": f"review-{uuid.uuid4().hex[:8]}",
      "agent": self.agentName,
      "files_reviewed": filesReviewed,
      "issues_found": issuesFound,
      "issues_fixed": issuesFixed,
      "timestamp": datetime.now().isoformat()
    }

    if "reviews" not in self.reviewStats:
      self.reviewStats["reviews"] = []
    self.reviewStats["reviews"].append(record)

    # 更新统计
    if "stats" not in self.reviewStats:
      self.reviewStats["stats"] = {"total_reviews": 0, "issues_found": 0, "issues_fixed": 0, "avg_issues_per_review": 0.0}
    self.reviewStats["stats"]["total_reviews"] += 1
    self.reviewStats["stats"]["issues_found"] += issuesFound
    self.reviewStats["stats"]["issues_fixed"] += issuesFixed

    total = self.reviewStats["stats"]["total_reviews"]
    if total > 0:
      self.reviewStats["stats"]["avg_issues_per_review"] = self.reviewStats["stats"]["issues_found"] / total

    _saveJson("review_stats.json", self.reviewStats)

  def getReviewTrend(self, lastN=10):
    """获取最近 N 次审查的趋势

    Args:
      lastN (int): 最近 N 次

    Returns:
      list: 审查记录
    """
    reviews = self.reviewStats.get("reviews", [])
    agentReviews = [r for r in reviews if r["agent"] == self.agentName]
    return sorted(agentReviews, key=lambda x: x["timestamp"], reverse=True)[:lastN]

  # ==================== 辅助方法 ====================

  def _findPattern(self, pattern):
    """查找已存在的模式

    Args:
      pattern (str): 模式标识符

    Returns:
      dict or None: 已存在的模式
    """
    for p in self.bugPatterns.get("patterns", []):
      if p["pattern"] == pattern:
        return p
    return None

  def getMemoryReport(self):
    """获取记忆报告

    Returns:
      dict: 记忆报告
    """
    return {
      "agent": self.agentName,
      "bug_patterns": {
        "total": len(self.bugPatterns.get("patterns", [])),
        "hot_patterns": self.getHotPatterns(3),
        "stats": self.bugPatterns.get("stats", {})
      },
      "fix_history": {
        "total": len(self.fixHistory.get("fixes", [])),
        "stats": self.fixHistory.get("stats", {})
      },
      "accuracy": self.getAccuracy(),
      "review_stats": self.reviewStats.get("stats", {})
    }

  def clearMemory(self):
    """清除当前 Agent 的所有记忆"""
    # 从 bug_patterns 中移除该 Agent 的记录
    self.bugPatterns["patterns"] = [p for p in self.bugPatterns.get("patterns", [])
                                     if p["agent"] != self.agentName]

    # 从 fix_history 中移除该 Agent 的记录
    self.fixHistory["fixes"] = [f for f in self.fixHistory.get("fixes", [])
                                 if f["agent"] != self.agentName]

    # 从 feedback 中移除该 Agent 的记录
    self.feedback["feedback"] = [f for f in self.feedback.get("feedback", [])
                                  if f["agent"] != self.agentName]
    if self.agentName in self.feedback.get("agent_scores", {}):
      self.feedback["agent_scores"][self.agentName] = {"correct": 0, "total": 0, "accuracy": 0.0}

    # 从 review_stats 中移除该 Agent 的记录
    self.reviewStats["reviews"] = [r for r in self.reviewStats.get("reviews", [])
                                    if r["agent"] != self.agentName]

    _saveJson("bug_patterns.json", self.bugPatterns)
    _saveJson("fix_history.json", self.fixHistory)
    _saveJson("agent_feedback.json", self.feedback)
    _saveJson("review_stats.json", self.reviewStats)


if __name__ == "__main__":
  # 演示用法
  print("=== Agent Memory Demo ===\n")

  # Bug Hunter 学习
  bh = AgentMemory("bug-hunter")

  # 记录发现的 bug 模式
  bh.recordBugPattern(
    pattern="missing_zero_grad",
    file="train.py",
    line=45,
    description="训练循环中缺少 optimizer.zero_grad()",
    fix="在 loss.backward() 前添加 optimizer.zero_grad()",
    severity="critical"
  )
  print("[Bug Hunter] 记录了 bug 模式: missing_zero_grad")

  # 再次发现相同模式（计数 +1）
  bh.recordBugPattern(
    pattern="missing_zero_grad",
    file="train2.py",
    line=30,
    description="训练循环中缺少 optimizer.zero_grad()",
    fix="在 loss.backward() 前添加 optimizer.zero_grad()",
    severity="critical"
  )
  print("[Bug Hunter] 再次发现相同模式，计数 +1")

  # 查询历史模式
  similar = bh.findSimilarBugs("zero_grad")
  print(f"\n[Bug Hunter] 查找 'zero_grad' 相关历史: {len(similar)} 条")
  for s in similar:
    print(f"  - 模式: {s['pattern']}, 出现次数: {s['count']}")

  # 记录修复
  bh.recordFix(
    bugPattern="missing_zero_grad",
    file="train.py",
    originalCode="loss.backward()\noptimizer.step()",
    fixedCode="optimizer.zero_grad()\nloss.backward()\noptimizer.step()",
    success=True
  )
  print("\n[Bug Hunter] 记录了修复成功")

  # 获取最佳修复方案
  bestFix = bh.getBestFix("missing_zero_grad")
  if bestFix:
    print(f"\n[Bug Hunter] 最佳修复方案:")
    print(f"  原始: {bestFix['original_code']}")
    print(f"  修复: {bestFix['fixed_code']}")

  # 记录反馈
  bh.recordFeedback("BUG-001", wasCorrect=True, comment="确实是 bug")
  print("\n[Bug Hunter] 收到正面反馈")

  # 获取准确率
  accuracy = bh.getAccuracy()
  print(f"\n[Bug Hunter] 当前准确率: {accuracy['accuracy']:.1%}")

  # 获取记忆报告
  report = bh.getMemoryReport()
  print(f"\n=== 记忆报告 ===")
  print(f"Agent: {report['agent']}")
  print(f"Bug 模式数: {report['bug_patterns']['total']}")
  print(f"修复记录数: {report['fix_history']['total']}")
  print(f"准确率: {report['accuracy']['accuracy']:.1%}")

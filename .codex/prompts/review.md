# Review - 多智能体审查

触发多智能体联合审查流程。

## 流程

1. 获取变更内容（git diff）
2. 并行触发 5 个 Agent：
   - Bug Hunter: 细微 bug
   - Code Reviewer: 代码质量
   - Security Auditor: 安全审查
   - Performance Analyzer: 性能分析
   - Test Writer: 测试覆盖
3. Orchestrator 汇总报告
4. 按严重性排序
5. 提供修改建议

## 审查维度

### 代码质量
- camelCase 函数名
- UPPER_SNAKE_CASE 常量
- 完整 JSDoc docstring
- 2 空格缩进

### 安全问题
- torch.load 安全参数
- 无硬编码敏感信息
- 路径无遍历风险

### 性能影响
- 无冗余计算
- 内存管理正确
- GPU 利用率充分

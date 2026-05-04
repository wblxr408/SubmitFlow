# Review Command

触发多智能体联合审查流程。

## 使用方式
```
/review
/review [file_path]
/review [commit_hash]
```

## 流程

1. **获取变更内容**
   - 无参数：审查 `git diff` 中的所有变更
   - 指定文件：审查指定文件的全部内容
   - 指定 commit：审查该 commit 的变更

2. **多智能体并行审查**
   
   并行触发以下 Agent：
   - **Bug Hunter**: 检测细微 bug、边界条件、类型错误
   - **Code Reviewer**: 代码风格、命名规范、文档完整性
   - **Security Auditor**: 安全漏洞、注入风险、依赖安全
   - **Performance Analyzer**: 性能瓶颈、内存问题、GPU 利用率
   - **Test Writer**: 测试覆盖分析、缺失测试场景

3. **汇总报告**
   
   Orchestrator 汇总所有 Agent 报告，生成最终审查报告：
   - 按严重性排序：Critical > High > Medium > Low > Info
   - 去重合并相似问题
   - 提供具体的修改建议

4. **执行修改**（可选）
   
   如果发现问题，询问用户是否执行修复，然后由 Refactorer 执行修改。

## 审查维度

### 代码质量
- 函数命名是否符合 camelCase 规范
- 常量是否使用 UPPER_SNAKE_CASE
- 是否有完整的 JSDoc 风格 docstring
- 缩进是否使用 2 空格
- 导入顺序是否规范

### 安全问题
- 文件操作是否有路径遍历风险
- torch.load 是否使用安全参数
- 是否存在硬编码敏感信息
- 输入验证是否完整

### 性能影响
- 是否有冗余计算
- 内存管理是否正确
- GPU 利用率是否充分
- 数据加载是否高效

## 输出示例

```markdown
## 🔍 Multi-Agent Review Report

### Summary
- **Files**: 3 files reviewed
- **Issues**: Critical(1), High(2), Medium(3), Low(1)

### 🔴 Critical
- [BUG-001] 训练循环中未清零梯度 (train.py:45)

### 🟠 High  
- [SEC-001] torch.load 未使用安全参数 (utils.py:78)
- [PERF-001] 推理时未禁用梯度计算 (predict.py:23)

### 🟡 Medium
- [REVIEW-001] 缺少 docstring (data.py:12)
- [BUG-002] 边界条件未处理 (features.py:56)
- [TEST-001] 核心函数无测试 (model.py:34)

### 🟢 Low
- [REVIEW-002] 建议使用 f-string (utils.py:15)

### Recommended Actions
1. 立即修复梯度清零问题
2. 添加 torch.load 安全参数
3. 在推理代码中添加 torch.no_grad()
```

# Deep Review Command

触发深度多智能体联合审查，进行更全面的代码分析。

## 使用方式
```
/deep-review
/deep-review [directory]
```

## 与 /review 的区别

| 维度 | /review | /deep-review |
|------|---------|--------------|
| 范围 | 仅 git diff | 全部相关代码 |
| 迭代 | 单轮 | 多轮迭代 |
| 时间 | 快速 | 完整 |
| 适用 | 日常提交 | 重大重构前 |

## 流程

### Phase 1: 全面扫描
1. 扫描项目所有 Python 文件
2. 建立代码依赖关系图
3. 识别核心模块和高风险区域

### Phase 2: 多轮 Agent 审查

**Round 1 - 基础审查**
- Bug Hunter: 语法和逻辑错误
- Code Reviewer: 风格和规范
- Security Auditor: 安全漏洞

**Round 2 - 深度分析**
- Performance Analyzer: 性能瓶颈分析
- Test Writer: 测试覆盖缺口
- Refactorer: 架构改进建议

**Round 3 - 交叉验证**
- 各 Agent 互相审查其他 Agent 的建议
- 发现 Agent 间的潜在冲突
- 生成最终共识报告

### Phase 3: 综合评估
- 代码健康度评分（0-100）
- 风险热力图（按文件和模块）
- 改进优先级矩阵

## 输出示例

```markdown
## 🔬 Deep Multi-Agent Review Report

### Code Health Score: 72/100

### Risk Heatmap
| Module | Critical | High | Medium | Low |
|--------|----------|------|--------|-----|
| model.py | 0 | 2 | 3 | 1 |
| train.py | 1 | 1 | 2 | 0 |
| data.py | 0 | 0 | 4 | 2 |

### Cross-Agent Findings
- Bug Hunter 和 Performance Analyzer 同时标记了 train.py:45 的梯度问题
- Security Auditor 和 Code Reviewer 建议统一异常处理

### Priority Matrix
1. **Must Fix**: 梯度清零、安全加载
2. **Should Fix**: 测试覆盖、性能优化
3. **Nice to Have**: 代码风格、文档完善

### Architecture Recommendations
- 建议将训练逻辑抽取为独立模块
- 建议统一配置管理方式
- 建议增加模型检查点管理
```

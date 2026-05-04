# Fix Issue Command

自动分析并修复代码问题。

## 使用方式
```
/fix-issue
/fix-issue [issue_id]
/fix-issue --severity critical
```

## 流程

1. **问题识别**
   - 无参数：运行 /review 获取问题列表
   - 指定 issue_id：修复特定问题
   - 按严重性筛选：只修复指定级别

2. **修复策略选择**
   - Bug Hunter 的 bug → 直接修复
   - Code Reviewer 的风格问题 → 自动格式化
   - Security Auditor 的漏洞 → 保守修复
   - Performance Analyzer 的性能问题 → 提供优化版本
   - Refactorer 的重构建议 → 询问后执行

3. **修复执行**
   - 由 Refactorer 执行修改
   - 保持 API 兼容性
   - 添加注释说明修改原因

4. **验证**
   - 重新运行 /review 验证修复
   - 确保没有引入新问题
   - 如有问题，回滚并报告

## 安全策略

- Critical/High 问题：自动修复
- Medium 问题：修复后确认
- Low/Info 问题：仅提供建议，不自动修改

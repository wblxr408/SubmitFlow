# CTR 项目 - 轻量级配置（低 Token 消耗版）

## 使用场景
- 日常编码、小改动审查
- 不需要多智能体协作
- Token 预算有限时使用

## 激活方式
在对话开头加上：`@light` 或 `使用轻量模式`

---

## 编码规范
- 2 空格缩进
- 函数 camelCase，常量 UPPER_SNAKE_CASE，类 PascalCase
- 每个函数必须有 JSDoc docstring

## 必查项（5 条核心规则）
1. `optimizer.zero_grad()` 在 `loss.backward()` 前
2. 推理用 `model.eval()` + `@torch.no_grad()`
3. `torch.load` 必须加 `weights_only=True`
4. `model.to(DEVICE)` 和 `data.to(DEVICE)` 一致
5. 边界条件：空值、除零、数组越界

## 审查输出格式
```
[严重性] 文件:行 - 问题描述 → 修复建议
```

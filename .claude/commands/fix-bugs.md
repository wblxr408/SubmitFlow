# Fix Bugs Command

专门用于检测和修复细微 bug 的命令。结合 Bug Hunter 的深度分析能力。

## 使用方式
```
/fix-bugs
/fix-bugs --deep
/fix-bugs [file_path]
```

## 流程

### Phase 1: 深度 Bug 扫描
Bug Hunter Agent 执行全面扫描：
1. 变量生命周期追踪
2. 数据流分析
3. 边界条件检查
4. PyTorch 特定问题检测

### Phase 2: 修复建议生成
对每个发现的 bug：
1. 分析根本原因
2. 生成修复方案
3. 评估修复风险
4. 提供修复代码

### Phase 3: 自动修复
Refactorer Agent 执行修复：
1. 应用修复方案
2. 添加保护性代码
3. 更新相关测试

### Phase 4: 验证
1. 重新运行 Bug Hunter 扫描
2. 运行相关单元测试
3. 确认修复无副作用

## 检测重点

### 隐蔽 Bug 类型
- **Off-by-one**: 循环边界错误
- **Race condition**: 并发/异步问题
- **Resource leak**: 文件/连接未关闭
- **Type coercion**: 隐式类型转换
- **State pollution**: 全局/类变量污染
- **NaN propagation**: 数值计算中的 NaN/Inf
- **Gradient explosion**: 梯度计算异常

### PyTorch 特定
- `model.train()` / `model.eval()` 切换遗漏
- 梯度累积中的 `zero_grad()` 遗漏
- `device` 不匹配导致的 CPU/GPU 数据传输
- `DataLoader` 多进程兼容性
- `torch.save` 序列化安全问题

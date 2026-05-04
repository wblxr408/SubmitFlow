# Bug Detection Skill

## 描述
深度 Bug 检测技能，专注于发现隐蔽的逻辑错误和边界问题。

## 触发条件
- `/review` 或 `/fix-bugs` 命令
- Bug Hunter Agent 被调用
- 用户报告了可疑的 bug

## 检测方法

### 1. 数据流分析

追踪变量从定义到使用的完整路径：

```python
def analyzeDataFlow(code):
  """分析代码中的数据流

  检查：
  - 变量是否在使用前定义
  - 变量是否在使用后被修改
  - 变量的作用域是否正确
  """
  pass
```

### 2. 类型推断

```python
# 问题：隐式类型转换
result = x + y  # x 是 int，y 是 float

# 问题：Tensor dtype 不一致
a = torch.tensor([1, 2, 3])  # int64
b = torch.tensor([1.0, 2.0, 3.0])  # float32
c = a + b  # 隐式转换
```

### 3. 边界条件检查

```python
# 问题：Off-by-one
for i in range(len(items)):  # 正确
  process(items[i])

for i in range(len(items) - 1):  # 可能遗漏最后一个
  process(items[i])

# 问题：空输入
def processData(data):
  mean = sum(data) / len(data)  # 空列表会 ZeroDivisionError
```

### 4. PyTorch 特定检测

```python
# 问题：模型模式未切换
def evaluate(model, data):
  predictions = model(data)  # 缺少 model.eval()
  # dropout 和 batchnorm 仍处于训练模式

# 问题：梯度未清零
def train(model, data, optimizer):
  loss = model(data).sum()
  loss.backward()
  optimizer.step()
  # 缺少 optimizer.zero_grad()

# 问题：推理时未禁用梯度
def predict(model, data):
  return model(data)  # 应该在 torch.no_grad() 中

# 问题：设备不匹配
model = model.cuda()
data = data.cpu()  # 会隐式传输，但效率低
output = model(data)

# 问题：NaN 传播
loss = torch.log(predictions)  # 如果 predictions 有 0，会产生 -inf
```

### 5. 并发问题检测

```python
# 问题：DataLoader 在 Windows 上的多进程
loader = DataLoader(dataset, num_workers=4)  # Windows 需要在 if __name__ == '__main__' 中

# 问题：共享状态修改
global_counter = 0
def worker():
  global global_counter
  global_counter += 1  # 非线程安全
```

## 检测规则库

```python
BUG_PATTERNS = {
  "missing_zero_grad": {
    "pattern": r"loss\.backward\(\).*?optimizer\.step\(\)",
    "check": "optimizer.zero_grad() 在 backward() 前调用",
    "severity": "critical"
  },
  "missing_model_eval": {
    "pattern": r"def (evaluate|predict|test)\(",
    "check": "函数开始处有 model.eval()",
    "severity": "high"
  },
  "missing_no_grad": {
    "pattern": r"def (evaluate|predict|test)\(",
    "check": "推理函数使用 @torch.no_grad()",
    "severity": "medium"
  },
  "unsafe_load": {
    "pattern": r"torch\.load\((?!.*weights_only)",
    "check": "torch.load 使用 weights_only=True",
    "severity": "high"
  },
  "device_mismatch": {
    "pattern": r"\.to\(DEVICE\)",
    "check": "模型和数据都移到同一设备",
    "severity": "medium"
  }
}
```

## 输出格式

```markdown
## Bug Detection Report

### [BUG-001] Critical
- **File**: train.py
- **Line**: 45
- **Pattern**: missing_zero_grad
- **Description**: optimizer.zero_grad() 缺失，梯度会累积
- **Code**: 
  ```python
  loss.backward()
  optimizer.step()
  ```
- **Fix**: 
  ```python
  optimizer.zero_grad()
  loss.backward()
  optimizer.step()
  ```

### [BUG-002] High
- **File**: evaluate.py
- **Line**: 23
- **Pattern**: missing_model_eval
- **Description**: 评估函数未切换模型模式
- **Fix**: 在函数开始添加 model.eval()
```

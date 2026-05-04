# CTR 预测项目 - Codex 指令

## 项目概述
CTR (Click-Through Rate) 预测项目，基于 PyTorch 深度学习框架。

## 核心原则
1. 代码质量优先
2. 安全性零容忍
3. 性能可测量
4. 测试全覆盖

## 编码规范

### 缩进与格式
- 使用 2 空格缩进
- 行长度最多 120 字符
- 函数之间空 2 行

### 命名规范
- 函数：camelCase（如 `processData`）
- 类：PascalCase（如 `CTRModel`）
- 常量：UPPER_SNAKE_CASE（如 `DEVICE`）
- 私有方法：_camelCase（如 `_initWeights`）

### Docstring（JSDoc 风格）
每个函数必须包含：
- 函数描述
- Args：参数类型和描述
- Returns：返回值类型和描述
- Raises：可能抛出的异常

```python
def processData(dataframe, columns):
  """处理输入数据框

  Args:
    dataframe (pd.DataFrame): 输入数据框
    columns (list): 需要处理的列

  Returns:
    pd.DataFrame: 处理后的数据框

  Raises:
    ValueError: 数据框为空时
  """
```

## PyTorch 规范

### 模型定义
- 继承 `nn.Module`
- 使用 `DEVICE` 常量管理设备
- 权重初始化在 `_initWeights()` 中

### 训练循环必须包含
```python
optimizer.zero_grad()    # 梯度清零
loss.backward()          # 反向传播
optimizer.step()         # 更新参数
```

### 评估必须包含
```python
model.eval()             # 切换到评估模式
with torch.no_grad():    # 禁用梯度计算
  predictions = model(data)
```

### 模型保存/加载
```python
# 保存
torch.save({
  "model_state_dict": model.state_dict(),
  "optimizer_state_dict": optimizer.state_dict(),
}, path)

# 加载（安全方式）
checkpoint = torch.load(path, map_location=DEVICE, weights_only=True)
```

## 环境要求
- Python 3.8+
- PyTorch 1.10+
- conda 环境：used_pytorch
- 依赖：见 requirements.txt

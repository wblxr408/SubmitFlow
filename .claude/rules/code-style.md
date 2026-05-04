# Code Style Rules

## 缩进与格式

- **缩进**：使用 2 空格（非 4 空格，非 Tab）
- **行长度**：最多 120 字符
- **空行**：函数之间空 2 行，类方法之间空 1 行
- **空格**：运算符两侧各一个空格

## 命名规范

| 类型 | 风格 | 示例 |
|------|------|------|
| 函数/方法 | camelCase | `processData`, `trainModel` |
| 类名 | PascalCase | `CTRModel`, `DataLoader` |
| 常量 | UPPER_SNAKE_CASE | `DEVICE`, `LEARNING_RATE` |
| 私有方法 | _camelCase | `_initWeights`, `_computeLoss` |
| 模块/文件 | snake_case | `data_loader.py`, `train.py` |

## Docstring 规范

每个函数必须有 JSDoc 风格的 docstring：

```python
def functionName(param1, param2):
  """函数简短描述（一行）

  更详细的描述（可选），解释函数的作用、使用场景等。

  Args:
    param1 (type): 参数1描述
    param2 (type): 参数2描述

  Returns:
    type: 返回值描述

  Raises:
    ExceptionType: 异常描述

  Example:
    >>> result = functionName("a", 123)
    >>> print(result)
    'a123'
  """
```

## 导入顺序

```python
# 1. 标准库
import os
import sys

# 2. 第三方库
import numpy as np
import pandas as pd
import torch
import torch.nn as nn

# 3. 项目内部模块
from models.deepfm import DeepFM
from utils.data_loader import loadData
```

各组之间空一行分隔。

## PyTorch 特定规范

```python
import torch
import torch.nn as nn

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class CTRModel(nn.Module):
  """CTR 预测模型基类

  所有 CTR 模型应继承此类，实现 forward 方法。
  """

  def __init__(self, numFeatures, embedDim):
    """初始化模型

    Args:
      numFeatures (int): 特征数量
      embedDim (int): 嵌入维度
    """
    super().__init__()
    self._initWeights()

  def _initWeights(self):
    """初始化模型权重"""
    for module in self.modules():
      if isinstance(module, nn.Linear):
        nn.init.xavier_uniform_(module.weight)

  def forward(self, x):
    """前向传播

    Args:
      x (torch.Tensor): 输入特征张量

    Returns:
      torch.Tensor: 预测结果
    """
    pass
```

## 类型标注

推荐使用类型标注（Python 3.8+）：

```python
from typing import List, Dict, Optional, Tuple

def processData(
  dataframe: pd.DataFrame,
  columns: List[str],
  normalize: bool = True
) -> Tuple[pd.DataFrame, Dict[str, float]]:
  """处理数据并返回结果和统计信息"""
  pass
```

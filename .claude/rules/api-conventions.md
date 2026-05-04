# API Conventions

本项目 API 设计规范。

## 文件组织

```
projects/
├── baseline/
│   ├── models/          # 模型定义
│   ├── features/        # 特征工程
│   ├── utils/           # 工具函数
│   ├── configs/         # 配置文件
│   └── tests/           # 测试
└── [other_project]/
```

## 命名约定

### 模型相关
- 模型类：`PascalCase`（如 `DeepFM`, `WideAndDeep`）
- 模型文件：`snake_case.py`（如 `deepfm.py`）
- 配置类：`PascalCase` + `Config`（如 `ModelConfig`）

### 函数相关
- 数据处理：`camelCase`（如 `loadData`, `processFeatures`）
- 训练函数：`camelCase`（如 `trainEpoch`, `evaluateModel`）
- 工具函数：`camelCase`（如 `saveCheckpoint`, `loadConfig`）

### 常量
- 设备：`DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")`
- 路径：`DATA_DIR`, `CHECKPOINT_DIR`, `OUTPUT_DIR`
- 超参数：`LEARNING_RATE`, `BATCH_SIZE`, `NUM_EPOCHS`

## 函数签名约定

```python
def trainModel(model, trainLoader, valLoader, config):
  """训练模型并返回最佳检查点

  Args:
    model (nn.Module): 要训练的模型
    trainLoader (DataLoader): 训练数据加载器
    valLoader (DataLoader): 验证数据加载器
    config (dict): 训练配置

  Returns:
    nn.Module: 训练完成的最佳模型
    dict: 训练历史记录

  Raises:
    RuntimeError: 当 CUDA 不可用时抛出
    ValueError: 当配置参数无效时抛出
  """
```

## 配置管理

- 使用 YAML 文件存储配置
- 配置类使用 dataclass
- 支持命令行覆盖

```python
@dataclass
class TrainConfig:
  learningRate: float = 0.001
  batchSize: int = 256
  numEpochs: int = 100
  device: str = "cuda"
```

## 错误处理

- 使用具体的异常类型
- 提供清晰的错误消息
- 记录详细的错误日志

```python
if not torch.cuda.is_available():
  raise RuntimeError(
    f"CUDA not available. Current device: {DEVICE}. "
    "Please check your GPU installation."
  )
```

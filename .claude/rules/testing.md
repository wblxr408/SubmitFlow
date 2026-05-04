# Testing Rules

## 测试框架

- 使用 `pytest` 作为测试框架
- 测试文件命名：`test_*.py`
- 测试函数命名：`test_functionName_scenario`

## 测试目录结构

```
projects/baseline/
├── models/
│   ├── deepfm.py
│   └── test_deepfm.py
├── features/
│   ├── processor.py
│   └── test_processor.py
└── tests/
    ├── conftest.py      # 共享 fixtures
    ├── test_integration.py
    └── test_training.py
```

## 测试分类

### 单元测试（Unit Tests）
- 测试单个函数或方法
- 不依赖外部资源
- 执行速度快

```python
def test_processData_normalInput():
  """测试正常输入的数据处理"""
  df = pd.DataFrame({"a": [1, 2, 3]})
  result = processData(df, ["a"])
  assert len(result) == 3
  assert result["a"].mean() == pytest.approx(0.0, abs=1e-6)
```

### 边界测试（Boundary Tests）
- 测试边界条件
- 测试空输入
- 测试极值

```python
def test_processData_emptyInput():
  """测试空输入时抛出 ValueError"""
  df = pd.DataFrame()
  with pytest.raises(ValueError, match="empty"):
    processData(df, [])

def test_processData_singleElement():
  """测试单元素输入"""
  df = pd.DataFrame({"a": [1.0]})
  result = processData(df, ["a"])
  assert len(result) == 1
```

### 集成测试（Integration Tests）
- 测试模块间交互
- 测试完整流程

```python
def test_trainingPipeline():
  """测试完整训练流程"""
  config = createTestConfig()
  model = createModel(config)
  trainLoader = createDataLoader(config)
  
  history = trainModel(model, trainLoader, config)
  
  assert "loss" in history
  assert history["loss"][-1] < history["loss"][0]
```

### PyTorch 特定测试

```python
def test_modelOutputShape():
  """测试模型输出形状"""
  model = CTRModel(numFeatures=10, embedDim=8)
  x = torch.randn(32, 10)
  output = model(x)
  assert output.shape == (32, 1)

def test_modelGradientFlow():
  """测试梯度是否正常流动"""
  model = CTRModel(numFeatures=10, embedDim=8)
  x = torch.randn(32, 10)
  loss = model(x).sum()
  loss.backward()
  
  for param in model.parameters():
    assert param.grad is not None
    assert not torch.isnan(param.grad).any()

def test_modelDeviceConsistency():
  """测试模型在不同设备上行为一致"""
  model = CTRModel(numFeatures=10, embedDim=8)
  x = torch.randn(32, 10)
  
  model_cpu = model.cpu()
  output_cpu = model_cpu(x)
  
  if torch.cuda.is_available():
    model_gpu = model.cuda()
    x_gpu = x.cuda()
    output_gpu = model_gpu(x_gpu)
    assert torch.allclose(output_cpu, output_gpu.cpu(), atol=1e-5)
```

## Fixtures

```python
# conftest.py
import pytest
import torch

@pytest.fixture
def sampleData():
  """提供测试用的样本数据"""
  return {
    "features": torch.randn(100, 10),
    "labels": torch.randint(0, 2, (100,)).float()
  }

@pytest.fixture
def trainedModel():
  """提供已训练的模型"""
  model = CTRModel(numFeatures=10, embedDim=8)
  # 快速训练几个 epoch
  return model
```

## 测试覆盖率要求

- 核心模型函数：> 90%
- 数据处理函数：> 80%
- 工具函数：> 70%
- 配置加载：> 60%

## 运行测试

```bash
# 运行所有测试
pytest

# 运行特定文件
pytest tests/test_model.py

# 运行并显示覆盖率
pytest --cov=models --cov-report=html

# 只运行单元测试
pytest -m unit

# 只运行集成测试
pytest -m integration
```

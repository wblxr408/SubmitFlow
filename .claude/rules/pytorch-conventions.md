# PyTorch Conventions

本项目 PyTorch 使用规范。

## 模型定义

### 基本结构

```python
import torch
import torch.nn as nn

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class ModelName(nn.Module):
  """模型描述

  详细描述模型的架构和用途。
  """

  def __init__(self, config):
    """初始化模型

    Args:
      config (dict/ModelConfig): 模型配置
    """
    super().__init__()
    self.config = config
    self._buildLayers()
    self._initWeights()
    self.to(DEVICE)

  def _buildLayers(self):
    """构建模型层"""
    pass

  def _initWeights(self):
    """初始化权重"""
    for module in self.modules():
      if isinstance(module, nn.Linear):
        nn.init.xavier_uniform_(module.weight)
        if module.bias is not None:
          nn.init.zeros_(module.bias)

  def forward(self, features):
    """前向传播

    Args:
      features (torch.Tensor): 输入特征

    Returns:
      torch.Tensor: 模型预测
    """
    pass
```

## 训练循环

```python
def trainEpoch(model, trainLoader, optimizer, criterion):
  """训练一个 epoch

  Args:
    model (nn.Module): 模型
    trainLoader (DataLoader): 训练数据加载器
    optimizer (Optimizer): 优化器
    criterion (Loss): 损失函数

  Returns:
    float: 平均损失
  """
  model.train()
  totalLoss = 0.0
  
  for batch in trainLoader:
    features, labels = batch
    features = features.to(DEVICE)
    labels = labels.to(DEVICE)
    
    optimizer.zero_grad()
    predictions = model(features)
    loss = criterion(predictions, labels)
    loss.backward()
    optimizer.step()
    
    totalLoss += loss.item()
  
  return totalLoss / len(trainLoader)

@torch.no_grad()
def evaluateModel(model, valLoader, criterion):
  """评估模型

  Args:
    model (nn.Module): 模型
    valLoader (DataLoader): 验证数据加载器
    criterion (Loss): 损失函数

  Returns:
    dict: 评估指标
  """
  model.eval()
  totalLoss = 0.0
  allPredictions = []
  allLabels = []
  
  for batch in valLoader:
    features, labels = batch
    features = features.to(DEVICE)
    labels = labels.to(DEVICE)
    
    predictions = model(features)
    loss = criterion(predictions, labels)
    
    totalLoss += loss.item()
    allPredictions.append(predictions)
    allLabels.append(labels)
  
  predictions = torch.cat(allPredictions)
  labels = torch.cat(allLabels)
  
  return {
    "loss": totalLoss / len(valLoader),
    "auc": computeAUC(predictions, labels)
  }
```

## 模型保存/加载

```python
CHECKPOINT_DIR = "checkpoints"
BEST_MODEL_PATH = os.path.join(CHECKPOINT_DIR, "best_model.pt")

def saveCheckpoint(model, optimizer, epoch, metrics, path=BEST_MODEL_PATH):
  """保存模型检查点

  Args:
    model (nn.Module): 模型
    optimizer (Optimizer): 优化器
    epoch (int): 当前 epoch
    metrics (dict): 评估指标
    path (str): 保存路径
  """
  os.makedirs(os.path.dirname(path), exist_ok=True)
  torch.save({
    "epoch": epoch,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "metrics": metrics
  }, path)

def loadCheckpoint(model, optimizer=None, path=BEST_MODEL_PATH):
  """加载模型检查点

  Args:
    model (nn.Module): 模型
    optimizer (Optimizer, optional): 优化器
    path (str): 检查点路径

  Returns:
    dict: 检查点信息

  Raises:
    FileNotFoundError: 当检查点文件不存在时
  """
  if not os.path.exists(path):
    raise FileNotFoundError(f"Checkpoint not found: {path}")
  
  checkpoint = torch.load(path, map_location=DEVICE, weights_only=True)
  model.load_state_dict(checkpoint["model_state_dict"])
  
  if optimizer is not None:
    optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
  
  return checkpoint
```

## 随机种子

```python
def setSeed(seed=42):
  """设置随机种子以确保可重复性

  Args:
    seed (int): 随机种子
  """
  torch.manual_seed(seed)
  torch.cuda.manual_seed_all(seed)
  np.random.seed(seed)
  import random
  random.seed(seed)
  torch.backends.cudnn.deterministic = True
  torch.backends.cudnn.benchmark = False
```

## DataLoader

```python
def createDataLoader(dataset, batchSize, shuffle=True, numWorkers=0):
  """创建 DataLoader

  Args:
    dataset (Dataset): 数据集
    batchSize (int): 批大小
    shuffle (bool): 是否打乱
    numWorkers (int): 工作进程数（Windows 上建议为 0）

  Returns:
    DataLoader: 数据加载器
  """
  return DataLoader(
    dataset,
    batch_size=batchSize,
    shuffle=shuffle,
    num_workers=numWorkers,
    pin_memory=torch.cuda.is_available()
  )
```

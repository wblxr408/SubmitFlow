# Deploy Skill

## 描述
自动化模型部署技能，包含训练、打包、验证流程。

## 触发条件
- 用户请求部署模型
- `/deploy` 命令

## 工作流程

### 1. Pre-deploy 验证
```bash
# 检查环境
python check_deps.py

# 运行测试
pytest tests/

# 运行代码审查
# (触发 /review)
```

### 2. 模型准备
```bash
# 训练模型（如果需要）
python train.py --config config.yaml

# 验证模型
python evaluate.py --checkpoint checkpoints/best_model.pt

# 导出模型
python export.py --checkpoint checkpoints/best_model.pt --output models/
```

### 3. 部署验证
```bash
# 加载测试
python -c "import torch; model = torch.load('models/best_model.pt')"

# 推理测试
python inference.py --model models/best_model.pt --input data/test.csv
```

## 配置文件

```yaml
# deploy_config.yaml
deploy:
  model:
    checkpoint: "checkpoints/best_model.pt"
    export_format: "torchscript"  # or "onnx"
  
  environment:
    python_version: "3.8+"
    pytorch_version: "1.10+"
    cuda_version: "11.0"
  
  validation:
    test_data: "data/test.csv"
    expected_auc: 0.75
    max_latency_ms: 100
```

## 输出

- 部署报告：`reports/deploy_report.md`
- 模型文件：`models/`
- 推理脚本：`inference.py`

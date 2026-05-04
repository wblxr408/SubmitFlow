# Deploy Command

自动化部署流程，包含部署前检查和部署后验证。

## 使用方式
```
/deploy [environment]
```

## 支持环境
- `dev`: 开发环境
- `staging`: 测试环境
- `production`: 生产环境

## 流程

### Pre-deploy Checks
1. 运行 `/deep-review` 确保无 Critical/High 问题
2. 运行所有测试确保通过
3. 检查依赖版本一致性
4. 验证配置文件完整性

### Deploy Steps
1. 创建部署分支
2. 运行模型训练（如有更新）
3. 生成模型检查点
4. 打包部署产物
5. 推送到目标环境

### Post-deploy Verification
1. 运行冒烟测试
2. 检查模型推理输出
3. 监控系统资源使用
4. 验证日志输出

## 配置

部署配置定义在 `projects/*/config.yaml` 中：
```yaml
deploy:
  model_checkpoint: "checkpoints/best_model.pt"
  data_path: "data/processed"
  output_path: "outputs/predictions"
  device: "cuda"  # or "cpu"
```

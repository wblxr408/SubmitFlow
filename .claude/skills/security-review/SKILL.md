# Security Review Skill

## 描述
深度安全审查技能，专注于发现安全漏洞和风险。

## 触发条件
- `/review` 或 `/deep-review` 命令
- Security Auditor Agent 被调用
- 用户请求安全审查

## 审查维度

### 1. 文件操作安全
```python
# 危险：路径遍历
with open(os.path.join(user_input_dir, filename)) as f:
  pass

# 安全：规范化路径
safe_path = os.path.normpath(filepath)
if not safe_path.startswith(allowed_dir):
  raise ValueError("Invalid path")
```

### 2. PyTorch 安全
```python
# 危险：pickle 注入风险
model = torch.load("model.pt")

# 安全：使用 weights_only
model = torch.load("model.pt", weights_only=True)
```

### 3. 数据安全
```python
# 危险：日志泄露敏感信息
logger.info(f"User data: {user_data}")

# 安全：脱敏处理
logger.info(f"User data: {sanitize(user_data)}")
```

### 4. 配置安全
```python
# 危险：硬编码密钥
API_KEY = "sk-1234567890abcdef"

# 安全：环境变量
API_KEY = os.environ.get("API_KEY")
```

## 检查脚本

```python
def securityScan(filePath):
  """扫描文件中的安全问题

  Args:
    filePath (str): 文件路径

  Returns:
    list: 安全问题列表
  """
  issues = []
  
  with open(filePath) as f:
    content = f.read()
    lines = content.split('\n')
  
  for i, line in enumerate(lines, 1):
    # 检查 torch.load 安全
    if 'torch.load' in line and 'weights_only' not in line:
      issues.append({
        "line": i,
        "severity": "high",
        "message": "torch.load without weights_only parameter"
      })
    
    # 检查硬编码密钥
    if re.search(r'(api_key|secret|password)\s*=\s*["\'][^"\']{8,}', line, re.I):
      issues.append({
        "line": i,
        "severity": "critical",
        "message": "Possible hardcoded credential"
      })
    
    # 检查路径遍历
    if 'os.path.join' in line and '..' in line:
      issues.append({
        "line": i,
        "severity": "medium",
        "message": "Possible path traversal vulnerability"
      })
  
  return issues
```

## 输出格式

```markdown
## Security Audit Report

### Critical
- [SEC-001] Hardcoded API key in config.py:15

### High
- [SEC-002] Unsafe torch.load in utils.py:78
- [SEC-003] Missing input validation in data_loader.py:45

### Medium
- [SEC-004] Path traversal risk in file_handler.py:23

### Recommendations
1. Use environment variables for secrets
2. Add weights_only=True to torch.load
3. Validate all user inputs
```

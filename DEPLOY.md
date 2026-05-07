# SubmitFlow 部署文档

面向 CS/AI 在校学生的实习与校招信息聚合与投递追踪平台。

---

## 环境要求

| 依赖       | 版本      | 说明               |
| ---------- | --------- | ------------------ |
| Node.js    | >= 20.0.0 | 推荐 LTS 版本      |
| pnpm       | >= 8.0.0  | 包管理器           |
| PostgreSQL | >= 16.0   | 数据库             |
| Docker     | 最新版    | 容器化部署（可选） |
| Git        | 最新版    | 版本控制           |

---

## 快速启动（Windows）

```powershell
# Docker 一键启动（db + app + worker + 自动打开浏览器）
.\start-compose.ps1
```

**其他方式：**

```powershell
# 本地开发：自动安装依赖、启动数据库、运行迁移
.\scripts\start-dev.ps1

# Docker 部署（完整交互式）
.\scripts\start-docker.ps1

# 仅启动 PostgreSQL（本地已安装时）
.\start-pg.ps1
```

**启动前检查：**

```powershell
.\scripts\check-system.ps1
```

---

## Docker 构建注意事项

### 环境变量传递

Docker 构建时需要通过 `build.args` 传递敏感环境变量，否则 Next.js 静态页面生成会失败：

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - ENCRYPTION_KEY=${ENCRYPTION_KEY}
        - JWT_SECRET=${JWT_SECRET}
```

```dockerfile
# Dockerfile
FROM base AS builder
ARG ENCRYPTION_KEY
ARG JWT_SECRET
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY}
ENV JWT_SECRET=${JWT_SECRET}
```

### pnpm lockfile 同步

确保 `pnpm-lock.yaml` 与 `package.json` 同步，否则 Docker 构建会失败：

```bash
pnpm install
```

### 常见 Docker 构建错误

| 错误                                          | 解决方案                                     |
| --------------------------------------------- | -------------------------------------------- |
| `ERR_PNPM_OUTDATED_LOCKFILE`                  | 运行 `pnpm install` 同步 lockfile            |
| `JWT_SECRET environment variable is required` | 检查 docker-compose.yml 中的 build.args 配置 |
| `version is obsolete`                         | 删除 docker-compose.yml 中的 `version` 字段  |

---

## 手动部署（详细步骤）

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd SubmitFlow
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，必须填写的配置：

```env
# 数据库连接
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/submitflow

# 加密密钥（自动生成）
# 运行: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<生成的64位hex密钥>

# JWT 密钥（v1.3 新增，用于会话管理）
# 运行: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<生成的64位hex密钥>

# SMTP 配置（v1.3 新增，用于发送验证邮件）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<your-smtp-password>
```

### 4. 准备数据库

#### 选项 A：Docker PostgreSQL（推荐）

```bash
# 启动 PostgreSQL 容器
docker run -d `
  --name submitflow-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=submitflow `
  -p 5432:5432 `
  -v submitflow-postgres-data:/var/lib/postgresql/data `
  postgres:16-alpine

# 等待数据库就绪
docker exec submitflow-postgres pg_isready -U postgres
```

#### 选项 B：本地 PostgreSQL

```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE submitflow;
\q
```

### 5. 运行数据库迁移

```bash
pnpm run db:migrate
```

> Docker 部署时无需手动执行，app 容器启动时会自动运行迁移。

### 6. 启动服务

```bash
# 开发模式
pnpm dev          # 前端 + API（http://localhost:3208）
pnpm run worker   # 后台任务（另一个终端）

# 生产模式
pnpm build
pnpm start
```

---

## Docker Compose 部署

数据库迁移由 `app` 容器在启动时自动执行，无需手动操作。执行顺序：`schema.sql` → `seed.sql` → `migrations/001~011` → `companies-extended.sql`，脚本幂等，重复执行安全。

### 快速启动

```bash
# 一键启动（推荐）
cp .env.example .env
# 编辑 .env 填入必要配置
docker compose up --build
```

### 服务说明

| 服务   | 端口 | 说明                              |
| ------ | ---- | --------------------------------- |
| app    | 3208 | Next.js 应用（映射到容器内 3000） |
| db     | 5432 | PostgreSQL 数据库                 |
| worker | -    | 后台任务进程                      |

### 常用命令

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f
docker compose logs -f app    # 仅应用日志

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build

# 重置数据
docker compose down -v        # 删除数据卷
docker compose up -d          # 重新创建

# 查看服务状态
docker compose ps
```

---

## 一键启动脚本说明

### start-compose.ps1（根目录）

**Docker 一键启动脚本**，启动所有服务并自动打开浏览器。

```powershell
.\start-compose.ps1
```

> 直接在项目根目录运行即可，无需切换目录。

### check-system.ps1

系统环境检查脚本，验证以下项目：

- [x] Node.js 版本 (>= 18.0.0)
- [x] pnpm 包管理器
- [x] PostgreSQL 数据库
- [x] Docker 状态
- [x] 端口占用情况 (3208, 5432, 6379)
- [x] 项目文件完整性
- [x] 环境变量配置
- [x] 网络连接

**参数：**

- `-Verbose`: 显示详细输出

**使用：**

```powershell
.\scripts\check-system.ps1          # 运行检查
.\scripts\check-system.ps1 -Verbose  # 详细模式
```

### start-dev.ps1

本地开发环境一键启动脚本，自动完成：

1. 系统环境检查
2. 安装项目依赖
3. 配置环境变量（自动生成密钥）
4. 启动 PostgreSQL（可选 Docker）
5. 运行数据库迁移
6. 启动开发服务器
7. **自动打开浏览器访问 http://localhost:3208**

**参数：**

- `-SkipCheck`: 跳过系统检查
- `-SkipInstall`: 跳过依赖安装
- `-DockerDb`: 使用 Docker 运行 PostgreSQL
- `-ResetDb`: 重置数据库
- `-Verbose`: 显示详细输出

**使用：**

```powershell
.\scripts\start-dev.ps1                    # 完整启动
.\scripts\start-dev.ps1 -DockerDb         # 使用 Docker 数据库
.\scripts\start-dev.ps1 -SkipCheck        # 跳过检查快速启动
.\scripts\start-dev.ps1 -ResetDb          # 重置数据库
```

### start-docker.ps1

Docker 环境一键启动脚本，自动完成：

1. 检查 Docker 状态
2. 验证配置文件
3. 配置环境变量（自动生成密钥）
4. 构建 Docker 镜像
5. 启动所有服务（db → app → worker）
6. 等待 app 就绪（含自动迁移）
7. 健康检查 + 自动打开浏览器

**参数：**

- `-SkipBuild`: 跳过镜像构建
- `-ForceBuild`: 强制无缓存重建
- `-ResetData`: 重置数据卷
- `-Verbose`: 显示详细输出
- `-Help`: 显示帮助信息

**使用：**

```powershell
.\scripts\start-docker.ps1                # 一键启动
.\scripts\start-docker.ps1 -SkipBuild    # 跳过构建
.\scripts\start-docker.ps1 -ForceBuild   # 强制重建
.\scripts\start-docker.ps1 -ResetData    # 重置所有数据
```

---

## Vercel 部署

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 登录并部署

```bash
vercel login
vercel
```

### 3. 配置环境变量

在 Vercel Dashboard 中添加以下环境变量：

| 变量名                | 必填 | 说明                            |
| --------------------- | ---- | ------------------------------- |
| `DATABASE_URL`        | 是   | PostgreSQL 连接字符串           |
| `ENCRYPTION_KEY`      | 是   | 64位 hex 密钥                   |
| `JWT_SECRET`          | 是   | JWT 会话签名密钥（v1.3 新增）   |
| `JWT_EXPIRES_IN`      | 否   | Token 过期时间（默认 7d）       |
| `SMTP_HOST`           | 否   | SMTP 服务器（用于发送验证邮件） |
| `SMTP_PORT`           | 否   | SMTP 端口（默认 587）           |
| `SMTP_USER`           | 否   | SMTP 用户名                     |
| `SMTP_PASS`           | 否   | SMTP 密码                       |
| `OPENAI_API_KEY`      | 否   | OpenAI API Key                  |
| `ANTHROPIC_API_KEY`   | 否   | Anthropic API Key               |
| `GMAIL_CLIENT_ID`     | 否   | Gmail OAuth Client ID           |
| `GMAIL_CLIENT_SECRET` | 否   | Gmail OAuth Client Secret       |
| `FEISHU_WEBHOOK_URL`  | 否   | 飞书通知 Webhook                |

### 4. 配置数据库

Vercel Postgres 或外部 PostgreSQL：

```bash
# 使用 Vercel Postgres
vercel env add DATABASE_URL
```

---

## 生产环境部署

### 1. 构建生产版本

```bash
pnpm build
```

### 2. 启动生产服务器

```bash
pnpm start
```

### 3. 使用 PM2 管理进程

```bash
# 安装 PM2
npm i -g pm2

# 启动应用
pm2 start npm --name "submitflow" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs submitflow

# 重启
pm2 restart submitflow
```

### 4. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 若为本机 PM2 + pnpm start（默认 PORT=3000），请改为 http://localhost:3000
    location / {
        proxy_pass http://localhost:3208;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 数据库迁移管理

### 查看迁移状态

```bash
# 列出所有迁移文件
ls -la src/db/migrations/
```

### 回滚迁移（手动）

```bash
# 删除指定表
psql $DATABASE_URL -c "DROP TABLE IF EXISTS resumes CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS reminders CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS referrals CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS job_favorites CASCADE;"

# v1.3 迁移回滚（如需回滚用户系统）
psql $DATABASE_URL -c "DROP TABLE IF EXISTS users CASCADE;"
psql $DATABASE_URL -c "ALTER TABLE profiles DROP COLUMN IF EXISTS user_id;"
```

### 添加新迁移

1. 创建迁移文件（编号递增）：

```powershell
New-Item src/db/migrations/012_add_xxx.sql
```

2. 编写幂等 SQL：

```sql
CREATE TABLE IF NOT EXISTS xxx (...);
CREATE INDEX IF NOT EXISTS idx_xxx ON xxx(...);
```

3. 本地运行：

```bash
pnpm run db:migrate
```

Docker 环境下重启 app 容器即可自动执行新迁移：

```bash
docker compose restart app
```

---

## v1.2 → v1.3 升级指南

v1.3 包含重大更新：多用户认证系统、数据模型扩展、性能优化。

### 升级步骤

#### 1. 备份数据

```bash
# 备份数据库
pg_dump submitflow > backup_v1.2.sql

# 备份 .env 配置
cp .env .env.backup
```

#### 2. 更新代码

```bash
# 拉取最新代码
git pull

# 安装新依赖
pnpm install
```

#### 3. 添加新环境变量

在 `.env` 中新增以下变量：

```env
# JWT 会话密钥（v1.3 必须）
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# SMTP 配置（v1.3 必须，用于发送验证邮件）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<your-password>
```

#### 4. 运行数据库迁移

```bash
# v1.3 迁移脚本按顺序执行（001~011 全部包含）
pnpm run db:migrate
```

#### 5. 更新默认管理员密码

默认管理员账号：`admin@submitflow.local` / `admin123`

**生产环境必须修改默认密码！**

#### 6. 验证升级

```bash
# 启动服务
pnpm dev

# 访问 http://localhost:3208/login
# 使用默认账号登录验证
```

### 迁移脚本说明

|                                 | 脚本              | 说明                       |
| ------------------------------- | ----------------- | -------------------------- |
| `006_add_users.sql`             | 创建 users 表     | 支持邮箱注册/登录          |
| `007_add_user_profile_link.sql` | profiles 关联用户 | 一个用户对应一个 profile   |
| `008_add_company_fields.sql`    | 扩展公司表字段    | 新增行业、规模、总部城市等 |
| `009_optimize_indexes.sql`      | 索引优化          | 提升查询性能               |
| `010_add_default_user.sql`      | 创建默认管理员    | 默认账号用于初始登录       |

---

## 环境变量参考

| 变量名                | 必填 | 默认值                | 说明                         |
| --------------------- | ---- | --------------------- | ---------------------------- |
| `DATABASE_URL`        | 是   | -                     | PostgreSQL 连接字符串        |
| `ENCRYPTION_KEY`      | 是   | -                     | 64位 hex 密钥（AES-256-GCM） |
| `JWT_SECRET`          | 是   | ENCRYPTION_KEY 前32位 | JWT 会话签名密钥（v1.3）     |
| `JWT_EXPIRES_IN`      | 否   | 7d                    | Token 过期时间               |
| `SMTP_HOST`           | 否   | -                     | SMTP 服务器（发送验证邮件）  |
| `SMTP_PORT`           | 否   | 587                   | SMTP 端口                    |
| `SMTP_USER`           | 否   | -                     | SMTP 用户名                  |
| `SMTP_PASS`           | 否   | -                     | SMTP 密码                    |
| `OPENAI_API_KEY`      | 否   | -                     | OpenAI API Key               |
| `ANTHROPIC_API_KEY`   | 否   | -                     | Anthropic API Key            |
| `DEEPSEEK_API_KEY`    | 否   | -                     | DeepSeek API Key             |
| `ZHIPU_API_KEY`       | 否   | -                     | 智谱 AI Key                  |
| `QWEN_API_KEY`        | 否   | -                     | 阿里通义 Key                 |
| `MINIMAX_API_KEY`     | 否   | -                     | MiniMax Key                  |
| `MOONSHOT_API_KEY`    | 否   | -                     | 月之暗面 Key                 |
| `GMAIL_CLIENT_ID`     | 否   | -                     | Gmail OAuth Client ID        |
| `GMAIL_CLIENT_SECRET` | 否   | -                     | Gmail OAuth Client Secret    |
| `FEISHU_WEBHOOK_URL`  | 否   | -                     | 飞书通知 Webhook URL         |
| `NODE_ENV`            | 否   | development           | 运行环境                     |

---

## 故障排查

### 数据库连接失败

```bash
# 测试连接
psql $DATABASE_URL -c "SELECT 1;"

# Docker 容器内测试
docker exec submitflow-postgres psql -U postgres -d submitflow -c "SELECT 1;"

# 检查 DATABASE_URL 格式
# postgresql://user:password@host:port/database
```

### 端口被占用

```bash
# 查找占用端口的进程
Get-NetTCPConnection -LocalPort 3208

# 使用其他端口（覆盖 package.json 中的默认端口）
pnpm exec next dev -p 3000
```

### 迁移失败

```bash
# 查看详细错误
psql $DATABASE_URL -f src/db/migrations/xxx.sql -v ON_ERROR_STOP=1
```

### Docker 相关问题

```bash
# 查看 Docker 日志
docker compose logs -f

# 重启 Docker 服务
docker compose restart

# 清理未使用的资源
docker system prune -f
```

---

## 目录结构

```
SubmitFlow/
├── start-compose.ps1           # Docker 一键启动（推荐）
├── start-pg.ps1                # 启动本地 PostgreSQL
├── scripts/
│   ├── check-system.ps1       # 系统环境检查
│   ├── start-dev.ps1           # 本地开发启动
│   └── start-docker.ps1        # Docker 完整交互部署
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/             # React 组件
│   ├── lib/                    # 工具函数
│   ├── server/                 # 服务端逻辑
│   ├── db/                     # 数据库相关
│   │   ├── schema.sql         # 完整数据库 schema
│   │   ├── seed.sql           # 种子数据
│   │   └── migrations/         # 增量迁移
│   └── worker/                 # 后台任务
├── docker-compose.yml           # Docker 编排
├── Dockerfile                   # 应用镜像
├── Dockerfile.worker            # Worker 镜像
├── .env.example                 # 环境变量模板
└── package.json
```

---

## 技术支持

如有问题，请提交 Issue 或联系开发者。

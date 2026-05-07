# SubmitFlow

面向 CS/AI 在校学生的实习与校招信息聚合与投递追踪平台。

## v1.3 新特性

- **多用户认证**：邮箱注册/登录、JWT 会话、密码重置
- **公司池扩展**：500+ 家公司，支持 1000+ 有效岗位
- **推荐算法 V2**：六维评分（知名度 + 匹配度 + 城市 + 紧迫性 + 转正率 + 新鲜度）
- **城市精细化**：一线互通、新一线互通、同区域匹配
- **性能优化**：内存缓存层、数据库 CTE 查询、React Query 集成

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 · TypeScript · Tailwind CSS · React Query |
| 数据库 | PostgreSQL 16 |
| 定时调度 | node-cron（无 Redis 依赖） |
| 浏览器自动化 | Playwright |
| AI | 服务端统一编排层（支持 8 家服务商） |
| 容器 | Docker Compose（web + worker + postgres） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

> 注意：首次安装可能需要几分钟，请耐心等待。

### 2. 配置环境变量

复制配置文件并填写必要的值：

```bash
# Windows PowerShell
copy .env.example .env.local

# 或 Windows CMD
copy .env.example .env.local
```

#### 环境变量填写说明

打开 `.env.local` 文件，按以下说明填写：

| 变量名 | 是否必填 | 说明 | 示例 |
|--------|----------|------|------|
| `DATABASE_URL` | ✅ 必填 | PostgreSQL 数据库连接地址 | `postgresql://postgres:postgres@localhost:5432/submitflow` |
| `ENCRYPTION_KEY` | ✅ 必填 | 加密密钥（64位hex字符串） | 运行生成命令获取 |
| `JWT_SECRET` | 建议填 | JWT 签名密钥 | 运行生成命令获取 |
| `DEFAULT_ADMIN_EMAIL` | 建议改 | 默认管理员邮箱 | `admin@submitflow.local` |
| `DEFAULT_ADMIN_PASSWORD` | 建议改 | 默认管理员密码 | `admin123` |
| `SMTP_HOST` | 可选 | 邮件服务器 | `smtp.gmail.com` |
| `SMTP_USER` | 可选 | 邮件用户名 | `your-email@gmail.com` |
| `SMTP_PASS` | 可选 | 邮件密码/授权码 | `xxxx xxxx xxxx xxxx` |

**生成密钥（Windows PowerShell）：**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

复制输出的64位字符串，填入 `ENCRYPTION_KEY`。

**简化数据库连接（本地开发）：**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/submitflow
```

### 3. 安装并启动 PostgreSQL

#### 方式一：Docker（推荐）

```bash
docker run -d `
  --name submitflow-db `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=submitflow `
  -p 5432:5432 `
  postgres:16-alpine
```

#### 方式二：本地安装 PostgreSQL

1. 下载 [PostgreSQL 16](https://www.postgresql.org/download/windows/)
2. 安装时设置：
   - 端口：`5432`
   - 用户名：`postgres`
   - 密码：`postgres`
3. 创建数据库：

```sql
CREATE DATABASE submitflow;
```

### 4. 运行数据库迁移

```bash
npm run db:migrate
```

迁移脚本会自动执行：
1. 创建数据库表结构（schema.sql）
2. 填充初始数据（seed.sql）
3. 执行 v1.3 迁移脚本
4. 扩展公司数据（560家）

> 默认管理员账号：`admin@submitflow.local` / `admin123`

### 5. 启动开发服务器

**仅 Web 服务：**

```bash
npm run dev
```

访问 http://localhost:3208

**同时启动 Web + 后台任务（需要两个终端窗口）：**

```bash
# 终端 1 - Web 服务
npm run dev

# 终端 2 - 后台任务（抓取、通知等）
npm run worker
```

### 6. Docker 启动

**Windows 一键启动（推荐）：**

```powershell
# 一键启动所有服务 + 自动打开浏览器
.\start-compose.ps1
```

> 需要强制重建：`docker compose -f docker-compose.yml --env-file .env build --no-cache`

**Linux 服务器部署：**

```bash
cp .env.example .env
# 编辑 .env 填写所有密钥
docker compose up --build
```

## 项目结构

```
src/
├── app/                        # Next.js App Router
│   ├── (app)/                  # App 路由组（含侧边栏布局）
│   │   ├── page.tsx           # 首页
│   │   ├── jobs/
│   │   │   ├── page.tsx       # 岗位列表
│   │   │   └── [id]/page.tsx  # 岗位详情
│   │   ├── favorites/          # 我的收藏
│   │   ├── referrals/          # 内推管理
│   │   ├── recommendations/    # 推荐榜单
│   │   ├── applications/      # 投递记录
│   │   ├── resumes/            # 简历管理
│   │   ├── match/             # AI 建档对话
│   │   └── settings/
│   │       ├── page.tsx       # 设置概览
│   │       ├── profile/        # 个人资料
│   │       ├── reminders/      # 投递提醒
│   │       ├── ai/             # AI 服务商配置
│   │       └── integrations/   # Gmail / 飞书集成
│   ├── (auth)/                 # 认证路由组（无侧边栏）
│   │   ├── login/page.tsx     # 登录
│   │   ├── register/page.tsx  # 注册
│   │   ├── forgot-password/    # 忘记密码
│   │   └── verify-email/       # 邮箱验证
│   └── api/                    # REST API
│       ├── auth/               # 认证相关（登录/注册/登出/验证）
│       ├── health/             # 健康检查
│       ├── dashboard/         # 首页数据
│       ├── jobs/              # 岗位 CRUD
│       ├── companies/          # 公司列表/详情
│       ├── recommendations/   # 六维权重榜单
│       ├── applications/      # 投递追踪
│       ├── favorites/         # 收藏管理
│       ├── referrals/         # 内推管理
│       ├── reminders/         # 投递提醒
│       ├── resumes/           # 简历管理
│       ├── match/session/     # AI 对话
│       ├── graph/             # 知识图谱
│       ├── email/             # Gmail OAuth + 同步
│       ├── ai/                # 服务商配置 + 模型路由
│       ├── sources/           # 抓取来源管理
│       ├── referrals/import/  # 私域导入
│       └── notifications/     # 飞书通知
├── components/
│   ├── ui/                    # Button Card Badge Input Select Skeleton Toast EmptyState
│   ├── graph/                 # 知识图谱可视化（graph-view + weight-panel）
│   ├── sidebar.tsx            # 固定侧边栏（含用户菜单）
│   └── providers/             # ThemeProvider, QueryProvider
├── lib/                       # 核心工具库
│   ├── env.ts                # 环境变量校验
│   ├── logger.ts             # pino 结构化日志
│   ├── db.ts                 # pg 连接池 + transaction
│   ├── crypto.ts             # AES-256-GCM 加密
│   ├── auth.ts               # 认证核心服务（bcrypt + JWT）
│   ├── auth-context.ts       # 认证上下文
│   ├── cache.ts              # 内存缓存层
│   ├── errors.ts             # AppError 体系
│   ├── utils.ts              # cn()
│   └── hooks/                # React Query Hooks
├── server/                    # 业务逻辑层
│   ├── ai/                   # AI Orchestrator + Provider Adapters
│   ├── application/          # 投递状态机 + 事件历史
│   ├── recommendation/       # 六维评分算法 V2
│   ├── crawl/                # SourceAdapter 接口定义
│   └── notification/        # 飞书推送
├── types/                    # TypeScript 类型（与 schema 一一对应）
├── db/                       # schema.sql + seed.sql + migrations/
└── worker/                   # 定时调度入口（node-cron）
```

## 功能模块

### M0 · 基础架构
- [x] Docker Compose 部署（web + worker + postgres）
- [x] PostgreSQL schema（26 张表 + 枚举 + 索引）
- [x] AES-256-GCM 加密服务（所有敏感数据）
- [x] pino 结构化日志
- [x] 全局错误处理体系

### M1 · 岗位库
- [x] 多源抓取（SourceAdapter 接口）
- [x] 岗位列表（搜索/筛选）
- [x] 岗位详情（含投递入口）
- [x] 公司别名归并（GIN 索引）
- [x] 来源管理 API

### M2 · 投递追踪
- [x] 状态机（screening → written_test → interview → offer/rejected/withdrawn）
- [x] 事件历史时间线
- [x] 私有标签
- [x] Gmail OAuth 授权
- [x] 邮件解析 + 幂等写入

### M3 · 推荐榜单
- [x] 六维评分算法 V2（知名度 / 匹配度 / 城市 / 紧迫性 / 转正率 / 新鲜度）
- [x] 权重配置滑块
- [x] 预设模板（稳重型 / 海投型 / 精准型 / 新人型）
- [x] 榜单分层（Top20/50/100/200）
- [x] 仅看可内推筛选
- [x] 城市匹配精细化（一线互通、新一线互通、同区域）

### M4 · AI 建档
- [x] Agent 对话 UI（历史会话 / 消息气泡）
- [x] JSON 画像解析 + 结构化展示
- [x] 知识图谱可视化（三级节点）
- [x] 点击选标签 → 右侧权重滑块
- [x] 标签权重 PATCH/GET

### v1.3 · 用户与认证
- [x] 邮箱注册/登录（bcrypt 密码哈希）
- [x] JWT 会话管理（HTTP-only Cookie）
- [x] 密码重置（邮件链接验证）
- [x] 邮箱验证
- [x] 多用户数据隔离
- [x] 内存缓存层（SimpleCache，支持 TTL + 模式失效）

## API 路由

### 认证 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前用户 |
| POST | `/api/auth/verify` | 邮箱验证 |
| POST | `/api/auth/forgot-password` | 忘记密码 |
| POST | `/api/auth/reset-password` | 重置密码 |
| PATCH | `/api/auth/profile` | 更新个人资料 |

### 业务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/dashboard` | 首页数据面板 |
| GET/POST | `/api/jobs` | 岗位列表/创建 |
| GET | `/api/jobs/[id]` | 岗位详情 |
| GET | `/api/companies` | 公司列表（支持搜索/筛选） |
| GET | `/api/companies/[id]` | 公司详情 + 岗位统计 |
| GET | `/api/recommendations` | 推荐榜单（六维权重） |
| GET/POST | `/api/applications` | 投递列表/创建 |
| PATCH | `/api/applications/[id]` | 更新状态 |
| GET/POST | `/api/applications/[id]/tags` | 私有标签 |
| GET | `/api/applications?counts_only=true` | 各状态数量统计 |
| GET/POST/DELETE | `/api/favorites` | 收藏列表/添加/删除 |
| GET/PATCH/DELETE | `/api/favorites/[id]` | 收藏详情/更新/归档 |
| GET | `/api/favorites/check?job_ids=` | 批量检查收藏状态 |
| GET/POST/DELETE | `/api/referrals` | 内推列表/创建/删除 |
| POST | `/api/referrals/import` | 批量导入内推 |
| GET/POST | `/api/reminders` | 提醒列表/创建 |
| PATCH/DELETE | `/api/reminders/[id]` | 更新/删除提醒 |
| GET | `/api/reminders/check` | 即将到期的截止提醒 |
| GET/POST | `/api/resumes` | 简历列表/上传 |
| PATCH/DELETE | `/api/resumes/[id]` | 更新/删除简历 |
| GET/POST | `/api/match/session` | AI 建档对话 |
| DELETE | `/api/match/session?session_id=` | 删除会话 |
| GET | `/api/graph/nodes` | 知识图谱树 |
| POST | `/api/graph/nodes` | 创建图谱节点 |
| GET/PATCH/POST | `/api/graph/preferences` | 标签权重/方向偏好 |
| GET | `/api/email/connections` | Gmail 连接状态 |
| GET | `/api/email/callback` | OAuth 回调 |
| POST | `/api/email/sync` | 手动同步邮件 |
| DELETE | `/api/email/sync` | 断开 Gmail 连接 |
| GET/POST | `/api/ai/providers` | 服务商列表/添加 |
| GET/PATCH/DELETE | `/api/ai/providers/[id]` | 服务商配置管理 |
| GET | `/api/ai/models` | 可用模型目录 |
| GET/PUT | `/api/ai/routes/[taskType]` | 任务路由配置 |
| GET/POST | `/api/sources` | 抓取来源列表 |
| POST | `/api/crawl/run` | 触发抓取任务 |
| GET | `/api/export?type=applications` | 导出投递记录 CSV |
| GET | `/api/export?type=favorites` | 导出收藏列表 CSV |
| POST | `/api/notifications/test` | 发送测试通知 |

## 环境变量

### 必需

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `ENCRYPTION_KEY` | 64位 hex 密钥 |

### v1.3 新增

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | ENCRYPTION_KEY 前32位 | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | `7d` | Token 过期时间 |
| `SMTP_HOST` | - | SMTP 服务器 |
| `SMTP_PORT` | `587` | SMTP 端口 |
| `SMTP_USER` | - | SMTP 用户名 |
| `SMTP_PASS` | - | SMTP 密码 |

### 选做

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GOOGLE_CLIENT_ID` | Gmail OAuth |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth |
| `GOOGLE_REDIRECT_URI` | OAuth 回调地址 |
| `FEISHU_WEBHOOK_URL` | 飞书通知 |
| `LOG_LEVEL` | 日志级别（默认 info） |

## 注意事项

- Redis 接口已预留（docker-compose 中可取消注释），代码层使用 SimpleCache 替代
- Gmail OAuth 需要在 Google Cloud Console 创建 OAuth 2.0 客户端
- AI API Key 通过 AES-256-GCM 加密后存入数据库，不明文保存
- 生产环境建议通过反向代理（如 Caddy）添加基础认证保护 `/api/email/*` 等敏感路由

## Windows 开发环境常见问题

### Q1: npm install 报错 `node-gyp` 或 `bcrypt`

需要安装 Windows Build Tools：

```powershell
# 使用 PowerShell（管理员）
npm install --global windows-build-tools

# 或使用 Visual Studio Build Tools
```

### Q2: Docker 启动 PostgreSQL 报错

检查 Docker Desktop 是否正在运行：

```powershell
docker --version
docker ps
```

如果端口 5432 被占用：

```powershell
netstat -ano | findstr :5432
# 结束占用进程或修改 .env.local 中的端口
```

### Q3: 迁移脚本报错 `connection refused`

确保 PostgreSQL 已启动：

- **Docker 方式**：运行 `docker start submitflow-db`
- **本地安装**：确保 PostgreSQL 服务正在运行

### Q4: 访问 http://localhost:3208 一直加载

1. 检查终端是否有错误信息
2. 确保 `.env.local` 已创建且配置正确
3. 检查 `DATABASE_URL` 是否正确

### Q5: 生成 ENCRYPTION_KEY 报错

在 PowerShell 中运行：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

如果引号有问题，使用双引号：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Q6: 忘记管理员密码怎么办

重置数据库中的用户：

```sql
-- 连接数据库后执行
UPDATE users SET password_hash = '$2b$12$...' WHERE email = 'admin@submitflow.local';
-- 需要使用 bcrypt 加密的新密码
```

或删除所有用户重新迁移。

### Q7: 端口 3208 被占用

修改 `.env.local`：

```env
PORT=3209
```

或终止占用进程：

```powershell
netstat -ano | findstr :3208
taskkill /PID <进程ID> /F
```

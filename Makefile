.PHONY: dev build start setup migrate test lint clean docker-build docker-up docker-down

# 数据库连接字符串（本地开发）
DATABASE_URL ?= postgresql://postgres:postgres@localhost:5432/submitflow
export DATABASE_URL

# Node 环境
NODE_ENV ?= development
export NODE_ENV

# ============================================================
# 安装依赖
# ============================================================
setup:
	@echo "=== 安装依赖 ==="
	pnpm install
	@echo "请复制 .env.example 为 .env.local 并配置数据库连接"

# ============================================================
# 数据库迁移
# ============================================================
migrate:
	@echo "=== 运行数据库迁移 ==="
	@cat src/db/schema.sql src/db/seed.sql src/db/migrations/*.sql | psql "$(DATABASE_URL)"

migrate-schema:
	psql "$(DATABASE_URL)" -f src/db/schema.sql

migrate-seed:
	psql "$(DATABASE_URL)" -f src/db/seed.sql

migrate-001:
	psql "$(DATABASE_URL)" -f src/db/migrations/001_add_job_favorites.sql

migrate-002:
	psql "$(DATABASE_URL)" -f src/db/migrations/002_add_referrals.sql

migrate-003:
	psql "$(DATABASE_URL)" -f src/db/migrations/003_add_reminders.sql

migrate-004:
	psql "$(DATABASE_URL)" -f src/db/migrations/004_add_resumes.sql

# ============================================================
# 开发
# ============================================================
dev:
	@echo "=== 启动开发服务器 ==="
	pnpm dev

# ============================================================
# 构建
# ============================================================
build:
	@echo "=== 构建项目 ==="
	pnpm build

# ============================================================
# 生产启动
# ============================================================
start:
	@echo "=== 启动生产服务器 ==="
	pnpm start

# ============================================================
# PM2 管理
# ============================================================
pm2-start:
	@echo "=== 使用 PM2 启动 ==="
	pm2 start npm --name "submitflow" -- start

pm2-stop:
	pm2 stop submitflow

pm2-restart:
	pm2 restart submitflow

pm2-logs:
	pm2 logs submitflow

pm2-status:
	pm2 status

# ============================================================
# Docker
# ============================================================
docker-build:
	@echo "=== 构建 Docker 镜像 ==="
	docker build -t submitflow .

docker-up:
	@echo "=== 启动 Docker 服务 ==="
	docker-compose up -d

docker-down:
	@echo "=== 停止 Docker 服务 ==="
	docker-compose down

docker-logs:
	docker-compose logs -f app

# ============================================================
# 代码质量
# ============================================================
lint:
	@echo "=== 运行代码检查 ==="
	pnpm lint

test:
	@echo "=== 运行测试 ==="
	pnpm test

test-watch:
	pnpm test -- --watch

typecheck:
	@echo "=== 运行类型检查 ==="
	pnpm type-check

# ============================================================
# 清理
# ============================================================
clean:
	@echo "=== 清理构建产物 ==="
	rm -rf .next
	rm -rf node_modules/.cache
	@echo "清理完成"

# ============================================================
# 数据库操作
# ============================================================
db-console:
	psql "$(DATABASE_URL)"

db-reset:
	@echo "=== 重置数据库 ==="
	@echo "警告：此操作会删除所有数据！"
	@read -p "确认重置？(y/N): " confirm; \
	if [ "$$confirm" = "y" ]; then \
		psql "$(DATABASE_URL)" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"; \
		psql "$(DATABASE_URL)" -f src/db/schema.sql; \
		psql "$(DATABASE_URL)" -f src/db/seed.sql; \
		@cat src/db/migrations/*.sql | psql "$(DATABASE_URL)"; \
		echo "数据库已重置"; \
	else \
		echo "取消操作"; \
	fi

# ============================================================
# 帮助
# ============================================================
help:
	@echo "SubmitFlow Makefile 命令"
	@echo ""
	@echo "数据库操作："
	@echo "  make migrate          - 运行所有迁移"
	@echo "  make db-console      - 打开数据库控制台"
	@echo "  make db-reset        - 重置数据库（危险！）"
	@echo ""
	@echo "开发："
	@echo "  make setup           - 安装依赖"
	@echo "  make dev            - 启动开发服务器"
	@echo ""
	@echo "部署："
	@echo "  make build          - 构建项目"
	@echo "  make start          - 启动生产服务器"
	@echo "  make pm2-start      - 使用 PM2 启动"
	@echo "  make docker-build   - 构建 Docker 镜像"
	@echo "  make docker-up       - 启动 Docker 服务"
	@echo ""
	@echo "代码质量："
	@echo "  make lint           - 代码检查"
	@echo "  make test           - 运行测试"
	@echo "  make typecheck      - 类型检查"

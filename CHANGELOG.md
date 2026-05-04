# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-06

### Added

#### Module A: 用户登录与认证系统 (P0)
- Complete user authentication system with email/password
- JWT-based session management with HTTP-only cookies
- Email verification flow
- Password reset/forgot password flow
- User data isolation per user
- Role-based access control (user/admin)

#### Module B: 公司池扩充 (P0)
- 500+ company seed data covering major industries
- Industry classification (primary + secondary)
- Fame score system (0-100)
- Company size and scale information
- Enhanced company search (name, alias, brand)

#### Module C: 推荐算法精确化 (P1)
- City matching refinement (tier-1 city interop, same region bonus)
- Smoothed deadline scoring curve
- Non-linear fame score mapping with size bonus
- Freshness factor for new job posts
- 6-dimensional scoring: fame + match + city + deadline + conversion + freshness

#### Module D: 数据库查询优化 (P1)
- Composite indexes for common queries
- Hot city partial indexes
- Tag query optimization
- Simple in-memory cache layer with TTL
- Cache key helpers for common data types

#### Module E: 前端性能优化 (P2)
- React Query integration with QueryProvider
- Optimized stale time and garbage collection
- Disabled window focus refetch
- Configurable query retry

### Changed

#### Recommendation Engine
- Upgraded from v1 to v2 scoring system
- Extended region map with more cities
- Added 4 new ranking presets: 稳重型, 海投型, 精准型, 新人型
- Fixed tier range calculation

#### Tests
- Updated recommendation tests to match v2 algorithm
- Fixed mock implementation issues in application tracker tests
- All 66 tests passing

### Migration

For existing v1.2 users:
1. Run migration scripts in order: 006 → 007 → 008 → 009 → 010 → 011
2. A default admin user will be created from environment variables
3. Existing profile_id=1 data will be linked to the admin user

## [1.2.0] - 2026-04-05

### Completed M0-M4
- M0: 基础部署、数据模型、AI 编排层
- M1: 多源抓取、岗位库
- M2: 投递追踪、Gmail 同步
- M3: 推荐榜单、五维权重
- M4: Agent 建档、知识图谱

---

## [1.1.0] - 2026-04-04

### Initial Features
- Basic job tracking system
- Email integration
- Knowledge graph for user preferences

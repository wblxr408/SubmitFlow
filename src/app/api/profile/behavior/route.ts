/**
 * 行为记录 API v2
 * POST /api/profile/behavior - 记录用户行为
 *
 * v2 增强：
 * - 支持细粒度交互记录
 * - 支持负反馈（dismiss）
 * - 支持停留时间追踪
 * - 自动同步兴趣分数
 *
 * 用于：
 * - 职位浏览记录
 * - 收藏行为
 * - 投递记录
 * - 搜索行为
 * - 点击行为
 * - 忽略/滑走（负反馈）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { recordBehavior } from '@/server/profiling';
import { recordJobInteraction, recordDismiss, buildRecommendationContext } from '@/server/recommendation';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/behavior');

// v3 新增的交互类型
const INTERACTION_TYPES = [
  'view',           // 浏览
  'view_detail',    // 查看详情
  'search_result',  // 搜索结果点击
  'recommendation_shown',  // 推荐展示
  'recommendation_click',  // 推荐点击
  'apply',          // 投递
  'favorite',       // 收藏
  'dismiss',        // 忽略/负反馈
  // 原有行为类型
  'search',         // 搜索
  'click',          // 点击
  'ai_chat',        // AI对话
];

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext();
  if (!authContext) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const profileId = authContext.profileId;

  try {
    const body = await request.json();
    const {
      behavior_type,
      target_type,
      target_id,
      target_title,
      metadata,
      // v2 新增字段
      interaction_type,
      job_id,
      session_id,
      referrer,
      position_index,
      dwell_time_ms,
      dismiss_reason,
      batch_job_ids,
    } = body;

    // 处理细粒度交互记录（v3）
    if (interaction_type && job_id) {
      // 验证交互类型
      if (!INTERACTION_TYPES.includes(interaction_type)) {
        return NextResponse.json(
          { error: `interaction_type 必须是以下值之一: ${INTERACTION_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      // 特殊处理：负反馈
      if (interaction_type === 'dismiss') {
        await recordDismiss(profileId, job_id, dismiss_reason);
        log.debug({ profileId, job_id, dismiss_reason }, 'Job dismissed');
      }

      // 记录细粒度交互
      await recordJobInteraction(profileId, job_id, interaction_type, {
        sessionId: session_id,
        referrer,
        positionIndex: position_index,
        dwellTimeMs: dwell_time_ms,
        metadata: metadata ?? {},
      });

      log.debug({ profileId, job_id, interaction_type }, 'Job interaction recorded');
      return NextResponse.json({
        success: true,
        message: '交互已记录',
        interaction_type,
      });
    }

    // 批量处理负反馈
    if (batch_job_ids && Array.isArray(batch_job_ids) && batch_job_ids.length > 0) {
      for (const jid of batch_job_ids) {
        await recordDismiss(profileId, jid, dismiss_reason);
      }
      log.debug({ profileId, count: batch_job_ids.length, dismiss_reason }, 'Batch jobs dismissed');
      return NextResponse.json({
        success: true,
        message: `已忽略 ${batch_job_ids.length} 个岗位`,
        count: batch_job_ids.length,
      });
    }

    // 原有行为记录（保持向后兼容）
    if (behavior_type) {
      const validTypes = ['view', 'search', 'apply', 'favorite', 'click', 'ai_chat'];
      if (!validTypes.includes(behavior_type)) {
        return NextResponse.json(
          { error: `behavior_type 必须是以下值之一: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      await recordBehavior({
        profileId,
        behaviorType: behavior_type,
        targetType: target_type ?? undefined,
        targetId: target_id ?? undefined,
        targetTitle: target_title ?? undefined,
        metadata: metadata ?? {},
      });

      log.debug({ profileId, behavior_type, target_type, target_id }, 'Behavior recorded');
      return NextResponse.json({
        success: true,
        message: '行为已记录',
      });
    }

    return NextResponse.json(
      { error: '缺少必要参数: behavior_type 或 (interaction_type + job_id)' },
      { status: 400 }
    );
  } catch (err) {
    log.error({ err, profileId }, 'Failed to record behavior');
    return NextResponse.json(
      { error: '记录行为失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile/behavior - 获取用户行为统计摘要
 */
export async function GET(request: NextRequest) {
  const authContext = await getAuthContext();
  if (!authContext) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const profileId = authContext.profileId;

  try {
    // 获取推荐上下文（包含交互统计）
    const context = await buildRecommendationContext(profileId);

    return NextResponse.json({
      interactionCount: context.recentInteractions.length,
      dismissedCount: context.dismissedJobs.length,
      similarUsersCount: context.similarUsersCount,
      isColdStart: context.isColdStart,
      activityScore: context.activityScore,
      topInterests: context.interests.slice(0, 10),
    });
  } catch (err) {
    log.error({ err, profileId }, 'Failed to get behavior summary');
    return NextResponse.json(
      { error: '获取行为摘要失败' },
      { status: 500 }
    );
  }
}

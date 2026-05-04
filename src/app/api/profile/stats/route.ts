/**
 * 用户画像 API v2
 * GET /api/profile/stats - 获取用户画像统计
 * GET /api/profile/interests - 获取用户兴趣标签（支持衰减）
 * GET /api/profile/behavior - 获取用户行为历史
 * GET /api/profile/history - 获取搜索历史
 * GET /api/profile/summary - 获取完整画像摘要
 *
 * v2 增强：
 * - 支持兴趣衰减因子
 * - 支持交互历史
 * - 支持负反馈统计
 * - 支持推荐上下文
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import {
  getUserProfileStats,
  getUserInterests,
  getUserBehaviors,
  getSearchHistory,
  clearSearchHistory,
  calculateActivityScore,
} from '@/server/profiling';
import { buildRecommendationContext, getTopInterests as getTopInterestsFromProfiling } from '@/server/recommendation';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/profile');

/**
 * 获取用户画像统计
 * GET /api/profile/stats
 *
 * Query params:
 * - action: stats | interests | behavior | history | clear-history | summary
 * - type: company | position | industry | skill | city (for interests)
 * - min_score: minimum interest score (default: 0)
 * - limit: max results (default: 50)
 * - behavior_type: filter by behavior type
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'stats';

  const authContext = await getAuthContext();
  if (!authContext) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const profileId = authContext.profileId;

  try {
    switch (action) {
      case 'stats': {
        // 获取画像统计
        const stats = await getUserProfileStats(profileId);
        const activityScore = await calculateActivityScore(profileId);
        return NextResponse.json({
          ...stats,
          activityScore,
        });
      }

      case 'interests': {
        // 获取兴趣标签（支持衰减）
        const type = searchParams.get('type') as 'company' | 'position' | 'industry' | 'skill' | 'city' | undefined;
        const minScore = parseFloat(searchParams.get('min_score') ?? '0');
        const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
        const includeDecay = searchParams.get('include_decay') === 'true';

        const interests = await getUserInterests(profileId, { type, minScore, limit });

        // 增强返回数据：添加衰减信息
        if (includeDecay) {
          const enhancedInterests = interests.map(interest => ({
            ...interest,
            effectiveScore: interest.score * (interest.decayFactor ?? 1),
            decayDays: interest.lastBehaviorAt
              ? Math.ceil((Date.now() - new Date(interest.lastBehaviorAt).getTime()) / (1000 * 60 * 60 * 24))
              : null,
          }));
          return NextResponse.json({
            interests: enhancedInterests,
            summary: {
              totalCount: interests.length,
              topSkills: interests.filter(i => i.interestType === 'skill').slice(0, 5),
              topCompanies: interests.filter(i => i.interestType === 'company').slice(0, 5),
              topCities: interests.filter(i => i.interestType === 'city').slice(0, 5),
            },
          });
        }

        return NextResponse.json({ interests });
      }

      case 'behavior': {
        // 获取行为历史
        const behaviorType = searchParams.get('behavior_type') as 'view' | 'search' | 'apply' | 'favorite' | 'click' | 'ai_chat' | undefined;
        const behaviorLimit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));

        const behaviors = await getUserBehaviors(profileId, { type: behaviorType, limit: behaviorLimit });
        return NextResponse.json({ behaviors });
      }

      case 'history': {
        // 获取搜索历史
        const historyLimit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
        const history = await getSearchHistory(profileId, historyLimit);
        return NextResponse.json({ history });
      }

      case 'clear-history': {
        // 清除搜索历史
        await clearSearchHistory(profileId);
        return NextResponse.json({ success: true, message: '搜索历史已清除' });
      }

      case 'summary': {
        // 获取完整画像摘要（v2 新增）
        const context = await buildRecommendationContext(profileId);
        const stats = await getUserProfileStats(profileId);

        return NextResponse.json({
          // 基础信息
          profile: {
            id: context.profile.id,
            targetCities: context.profile.targetCities,
            internshipTypes: context.profile.internshipTypes,
          },
          // 活跃度
          activity: {
            score: context.activityScore,
            totalBehaviors: stats.totalBehaviors,
            active7d: stats.active7d,
            isColdStart: context.isColdStart,
          },
          // 兴趣标签
          interests: {
            total: context.interests.length,
            skills: context.interests.filter(i => i.interestType === 'skill').slice(0, 10),
            companies: context.interests.filter(i => i.interestType === 'company').slice(0, 5),
            cities: context.interests.filter(i => i.interestType === 'city').slice(0, 5),
            industries: context.interests.filter(i => i.interestType === 'industry').slice(0, 5),
          },
          // 交互统计
          interactions: {
            recentCount: context.recentInteractions.length,
            dismissedCount: context.dismissedJobs.length,
            similarUsersCount: context.similarUsersCount,
          },
          // 行为统计
          behaviors: {
            viewCount: stats.viewCount,
            searchCount: stats.searchCount,
            favoriteCount: stats.favoriteCount,
            applyCount: stats.applyCount,
            searchHistoryCount: stats.searchHistoryCount,
            aiInteractionCount: stats.aiInteractionCount,
          },
          // 推荐洞察
          insights: {
            topInterest: context.interests[0] ?? null,
            preferredCity: context.interests.find(i => i.interestType === 'city')?.interestKey ?? null,
            preferredSkills: context.interests
              .filter(i => i.interestType === 'skill')
              .slice(0, 3)
              .map(i => i.interestKey),
            recommendedAction: getRecommendedAction(context),
          },
        });
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (err) {
    log.error({ err, profileId, action }, 'Profile API error');
    return NextResponse.json({ error: '获取用户画像失败' }, { status: 500 });
  }
}

/**
 * 根据画像上下文生成推荐操作建议
 */
function getRecommendedAction(context: {
  isColdStart: boolean;
  activityScore: number;
  interests: Array<{ interestType: string; interestKey: string; score: number }>;
}): string {
  if (context.isColdStart) {
    return '完善您的目标城市和偏好标签，以获得更精准的推荐';
  }

  if (context.activityScore < 30) {
    return '您最近比较活跃，继续浏览和收藏心仪的岗位吧';
  }

  if (context.interests.length < 3) {
    return '您的兴趣标签较少，建议多收藏感兴趣的岗位来完善画像';
  }

  if (context.interests.some(i => i.score > 0.8)) {
    return '您有明确的兴趣方向，推荐系统已充分了解您的偏好';
  }

  return '继续探索新的岗位，推荐会越来越精准';
}

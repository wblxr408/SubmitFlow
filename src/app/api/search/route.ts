/**
 * 增强搜索 API
 * GET /api/search
 *
 * 支持：
 * - 全文搜索（tsvector）
 * - 模糊搜索（pg_trgm）
 * - 搜索建议
 * - 智能搜索（基于用户画像）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import {
  fullTextSearch,
  fuzzySearch,
  getSearchSuggestions,
  intelligentSearch,
} from '@/server/search';
import { recordSearch } from '@/server/profiling';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/search');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query_ = searchParams.get('q') ?? '';
  const type = searchParams.get('type') ?? 'fulltext'; // fulltext | fuzzy | suggest | intelligent
  const city = searchParams.get('city') ?? '';
  const industry = searchParams.get('industry') ?? '';
  const internshipType = searchParams.get('internship_type') ?? '';
  const hasReferral = searchParams.get('has_referral') === 'true';
  const tagsParam = searchParams.get('tags') ?? '';
  const tags = tagsParam ? tagsParam.split(',').map(Number) : [];
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('page_size') ?? '20', 10));
  const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '10', 10));

  // 获取用户上下文（可选）
  const authContext = await getAuthContext();
  const profileId = authContext?.profileId;

  try {
    let result;

    switch (type) {
      case 'fuzzy':
        // 模糊搜索：用于搜索建议
        result = await fuzzySearch(query_, 'all', limit);
        return NextResponse.json({
          type: 'fuzzy',
          ...result,
        });

      case 'suggest':
        // 搜索建议
        result = await getSearchSuggestions(query_, 'all', limit);
        return NextResponse.json({
          type: 'suggest',
          suggestions: result,
        });

      case 'intelligent':
        // 智能搜索（需要登录）
        if (!profileId) {
          return NextResponse.json(
            { error: '需要登录才能使用智能搜索' },
            { status: 401 }
          );
        }
        result = await intelligentSearch(profileId, {
          keyword: query_,
          page,
          pageSize,
          filters: { city, industry, internshipType, hasReferral, tags },
        });
        // 记录搜索历史
        await recordSearch(profileId, query_, 'jobs', result.total);
        return NextResponse.json({
          type: 'intelligent',
          ...result,
        });

      case 'fulltext':
      default:
        // 全文搜索（默认）
        result = await fullTextSearch({
          keyword: query_,
          page,
          pageSize,
          filters: { city, industry, internshipType, hasReferral, tags },
        });
        // 记录搜索历史（需要登录）
        if (profileId) {
          await recordSearch(profileId, query_, 'jobs', result.total);
        }
        return NextResponse.json({
          type: 'fulltext',
          ...result,
        });
    }
  } catch (err) {
    log.error({ err, query: query_, type }, 'Search failed');
    return NextResponse.json(
      { error: '搜索失败，请稍后重试' },
      { status: 500 }
    );
  }
}

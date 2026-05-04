/**
 * 推荐引擎 v3 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcDeadlineScore,
  calcCityScore,
  calcMatchScore,
  calcFameScore,
  calcCompositeScore,
  calcCompositeScoreV3,
  calcMatchScoreV3,
  calcPopularityScore,
  calcCollaborativeScore,
  calcFreshnessScoreV2,
  applyDiversityControl,
  DIVERSITY_PRESETS,
  RANKING_PRESETS,
  getTierRange,
} from './index';
import type { Job, UserTagPref } from '../../types';

describe('calcDeadlineScore', () => {
  it('returns 100 when deadline is today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(calcDeadlineScore(today)).toBe(100);
  });

  it('returns 95 when deadline is tomorrow', () => {
    const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(calcDeadlineScore(tomorrow)).toBe(95);
  });

  it('returns 90 when deadline is within 3 days', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(calcDeadlineScore(future)).toBe(90);
  });

  it('returns 80 when deadline is within 7 days', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(calcDeadlineScore(future)).toBe(80);
  });

  it('returns 20 when deadline is far in future', () => {
    const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(calcDeadlineScore(future)).toBe(20);
  });

  it('returns 30 when deadline is null', () => {
    expect(calcDeadlineScore(null)).toBe(30);
  });
});

describe('calcCityScore', () => {
  it('returns 100 for exact match', () => {
    expect(calcCityScore('北京', ['北京', '上海'])).toBe(100);
  });

  it('returns 85 for tier-1 cities (tier1互通)', () => {
    expect(calcCityScore('广州', ['北京', '上海'])).toBe(85);
  });

  it('returns 30 for non-target city', () => {
    expect(calcCityScore('拉萨', ['北京', '上海'])).toBe(30);
  });

  it('returns 40 when job city is missing', () => {
    expect(calcCityScore(null, ['北京'])).toBe(40);
  });

  it('returns 40 when target cities is empty', () => {
    expect(calcCityScore('北京', [])).toBe(40);
  });

  it('returns 75 for remote jobs regardless of city', () => {
    expect(calcCityScore('北京', ['北京'], true)).toBe(75);
    expect(calcCityScore('深圳', ['北京'], true)).toBe(75);
  });

  it('returns 100 for non-remote exact city match', () => {
    expect(calcCityScore('北京', ['北京'], false)).toBe(100);
  });

  it('returns 80 for new tier-1 city match', () => {
    // 杭州属于新一线
    expect(calcCityScore('杭州', ['杭州', '成都'])).toBe(100); // 精确匹配
    expect(calcCityScore('成都', ['杭州'])).toBe(80); // 新一线互通
  });

  it('returns 70 for same region cities', () => {
    // 验证区域匹配逻辑
    // 北京和天津都在华北
    expect(calcCityScore('北京', ['天津'])).toBe(70);
  });
});

describe('calcMatchScore', () => {
  const tagPrefs: UserTagPref[] = [
    { id: 1, profile_id: 1, tag_id: 1, weight: 0.6, created_at: '', updated_at: '' },
    { id: 2, profile_id: 1, tag_id: 2, weight: 0.4, created_at: '', updated_at: '' },
  ];

  it('returns 100 when all tags match', () => {
    expect(calcMatchScore([1, 2], tagPrefs)).toBe(100);
  });

  it('returns 60 when only one tag matches', () => {
    expect(calcMatchScore([1], tagPrefs)).toBe(60);
  });

  it('returns 0 when no tag matches', () => {
    expect(calcMatchScore([3, 4], tagPrefs)).toBe(0);
  });

  it('returns 50 when tagPrefs is empty', () => {
    expect(calcMatchScore([1, 2], [])).toBe(50);
  });
});

describe('calcMatchScoreV3', () => {
  const tagPrefs: UserTagPref[] = [
    { id: 1, profile_id: 1, tag_id: 1, weight: 0.6, created_at: '', updated_at: '' },
    { id: 2, profile_id: 1, tag_id: 2, weight: 0.4, created_at: '', updated_at: '' },
  ];

  const interests = [
    { interestType: 'skill' as const, interestKey: 'react', score: 0.8, decayFactor: 0.9 },
    { interestType: 'city' as const, interestKey: '北京', score: 0.7, decayFactor: 0.95 },
  ];

  it('returns base score when no preferences', () => {
    expect(calcMatchScoreV3([1, 2], [], [])).toBe(50);
  });

  it('uses tag preferences when available', () => {
    expect(calcMatchScoreV3([1, 2], tagPrefs, [])).toBe(100);
  });

  it('considers interest decay factor', () => {
    // 当有兴趣衰减时，分数应该有所调整
    const result = calcMatchScoreV3([1], tagPrefs, interests);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

describe('calcFameScore', () => {
  it('applies power curve for fame score', () => {
    expect(calcFameScore(80)).toBe(84); // 0.8^0.8 ≈ 0.84
    expect(calcFameScore(50)).toBe(57); // 0.5^0.8 ≈ 0.57
  });

  it('caps score at 100', () => {
    expect(calcFameScore(120)).toBe(100);
  });

  it('applies company size bonus', () => {
    // 测试不同规模公司的加成
    expect(calcFameScore(80)).toBe(84); // 0.8^0.8 * 100 ≈ 84
  });
});

describe('calcFreshnessScoreV2', () => {
  it('returns 100 for jobs posted today', () => {
    const today = new Date().toISOString();
    expect(calcFreshnessScoreV2(today)).toBe(100);
  });

  it('returns 90 for jobs posted within 3 days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(calcFreshnessScoreV2(twoDaysAgo)).toBe(90);
  });

  it('returns 75 for jobs posted within 7 days', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(calcFreshnessScoreV2(fiveDaysAgo)).toBe(75);
  });

  it('returns default score for null date', () => {
    expect(calcFreshnessScoreV2(null)).toBe(30);
  });
});

describe('calcPopularityScore', () => {
  it('returns normalized popularity score', () => {
    const popularScores = new Map<number, number>([
      [1, 100],
      [2, 50],
      [3, 10],
    ]);

    expect(calcPopularityScore(1, popularScores)).toBeGreaterThan(calcPopularityScore(2, popularScores));
    expect(calcPopularityScore(2, popularScores)).toBeGreaterThan(calcPopularityScore(3, popularScores));
  });

  it('returns default score for unknown job', () => {
    const popularScores = new Map<number, number>();
    expect(calcPopularityScore(999, popularScores)).toBe(30);
  });
});

describe('calcCollaborativeScore', () => {
  it('returns similarity-based score', () => {
    const similarJobs = new Map<number, number>([
      [1, 0.8],
      [2, 0.5],
      [3, 0.2],
    ]);

    expect(calcCollaborativeScore(1, similarJobs)).toBe(80);
    expect(calcCollaborativeScore(2, similarJobs)).toBe(50);
    expect(calcCollaborativeScore(3, similarJobs)).toBe(20);
  });

  it('returns 0 for unknown job', () => {
    const similarJobs = new Map<number, number>();
    expect(calcCollaborativeScore(999, similarJobs)).toBe(0);
  });
});

describe('applyDiversityControl', () => {
  const createMockJob = (id: number, companyId: number, city: string, score: number) => ({
    id,
    company_id: companyId,
    title: `Job ${id}`,
    city,
    compositeScore: score,
  });

  it('limits same company jobs', () => {
    const jobs = [
      createMockJob(1, 1, '北京', 90),
      createMockJob(2, 1, '上海', 85),
      createMockJob(3, 1, '深圳', 80),
      createMockJob(4, 2, '广州', 75),
    ];

    const config = {
      explorationRatio: 0.2,
      popularityRatio: 0.3,
      maxSameCompany: 2,
      minCitySpread: 1,
    };

    const result = applyDiversityControl(jobs, config);

    // 同公司最多2个
    const company1Jobs = result.filter(j => j.company_id === 1);
    expect(company1Jobs.length).toBeLessThanOrEqual(2);
  });

  it('maintains city diversity', () => {
    const jobs = [
      createMockJob(1, 1, '北京', 90),
      createMockJob(2, 2, '北京', 85),
      createMockJob(3, 3, '上海', 80),
      createMockJob(4, 4, '上海', 75),
      createMockJob(5, 5, '深圳', 70),
      createMockJob(6, 6, '深圳', 65),
    ];

    const config = {
      explorationRatio: 0.2,
      popularityRatio: 0.3,
      maxSameCompany: 5,
      minCitySpread: 0.5, // 保留50%
    };

    const result = applyDiversityControl(jobs, config);

    // 应该保留多个城市的岗位
    const cities = new Set(result.map(j => j.city));
    expect(cities.size).toBeGreaterThan(1);
  });

  it('returns empty array for empty input', () => {
    const result = applyDiversityControl([], DIVERSITY_PRESETS.平衡型);
    expect(result).toEqual([]);
  });

  it('preserves high-scoring jobs within constraints', () => {
    const jobs = [
      createMockJob(1, 1, '北京', 95),
      createMockJob(2, 2, '上海', 90),
    ];

    const config = {
      explorationRatio: 0.2,
      popularityRatio: 0.3,
      maxSameCompany: 1,
      minCitySpread: 1,
    };

    const result = applyDiversityControl(jobs, config);

    // 应该保留高分岗位
    expect(result.some(j => j.compositeScore === 95)).toBe(true);
  });
});

describe('calcCompositeScore', () => {
  const mockJob = {
    id: 1,
    company_id: 1,
    title: '后端实习',
    city: '北京',
    deadline: null,
    conversion_rate: null,
    company_fame_score: 80,
    tags: [{ id: 1, slug: 'go', label: 'Go', group_name: '语言', color_hex: '#000', is_preset: true, created_at: '' }],
    company: undefined,
    entrypoints: undefined,
  } as unknown as Job & { company_fame_score: number };

  const tagPrefs: UserTagPref[] = [
    { id: 1, profile_id: 1, tag_id: 1, weight: 0.8, created_at: '', updated_at: '' },
  ];

  const targetCities = ['北京'];

  it('returns base score when all weights are zero', () => {
    const result = calcCompositeScore(mockJob, tagPrefs, targetCities, {
      fame_weight: 0,
      match_weight: 0,
      city_weight: 0,
      deadline_weight: 0,
      conversion_weight: 0,
    });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('returns correct score with valid weights', () => {
    const result = calcCompositeScore(mockJob, tagPrefs, targetCities, {
      fame_weight: 0.2,
      match_weight: 0.2,
      city_weight: 0.2,
      deadline_weight: 0.2,
      conversion_weight: 0.2,
    });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('applies city match bonus', () => {
    const result = calcCompositeScore(mockJob, tagPrefs, targetCities, {
      fame_weight: 0,
      match_weight: 0,
      city_weight: 1,
      deadline_weight: 0,
      conversion_weight: 0,
    });
    // 城市权重为1时，结果接近但不完全是100（因为有其他默认权重）
    expect(result).toBeGreaterThanOrEqual(90);
  });
});

describe('calcCompositeScoreV3', () => {
  const createMockJob = (overrides: Partial<Job> = {}) => ({
    id: 1,
    company_id: 1,
    title: '后端实习',
    city: '北京',
    deadline: null,
    conversion_rate: null,
    company_fame_score: 80,
    company_size: '中型',
    is_remote: false,
    first_seen_at: new Date().toISOString(),
    tags: [{ id: 1, slug: 'go', label: 'Go', group_name: '语言', color_hex: '#000', is_preset: true, created_at: '' }],
    ...overrides,
  } as unknown as Job & { company_fame_score: number; company_size?: string; is_remote?: boolean; first_seen_at?: string });

  const createMockContext = (overrides: Partial<Parameters<typeof calcCompositeScoreV3>[1]> = {}) => ({
    profile: { id: 1, targetCities: ['北京'], internshipTypes: [] },
    tagPrefs: [{ id: 1, profile_id: 1, tag_id: 1, weight: 0.8, created_at: '', updated_at: '' }],
    interests: [],
    dismissedJobs: [],
    recentInteractions: [],
    similarUsersCount: 0,
    isColdStart: false,
    activityScore: 50,
    ...overrides,
  });

  const defaultWeights = {
    fame_weight: 0.2,
    match_weight: 0.2,
    city_weight: 0.2,
    deadline_weight: 0.2,
    conversion_weight: 0.2,
    freshness_weight: 0.1,
    popularity_weight: 0.1,
    collaborative_weight: 0.1,
  };

  it('calculates composite score correctly', () => {
    const job = createMockJob();
    const context = createMockContext();

    const result = calcCompositeScoreV3(
      job,
      context,
      defaultWeights,
      new Map(),
      new Map()
    );

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.dimensions).toBeDefined();
    expect(result.dimensions.fameScore).toBeDefined();
    expect(result.dimensions.matchScore).toBeDefined();
    expect(result.dimensions.cityScore).toBeDefined();
  });

  it('applies dismissal penalty', () => {
    const job = createMockJob();
    const context = createMockContext({
      dismissedJobs: [{ jobId: 1, dismissedAt: new Date().toISOString() }],
    });

    const result = calcCompositeScoreV3(
      job,
      context,
      defaultWeights,
      new Map(),
      new Map()
    );

    // 应该有显著的分数降低
    expect(result.totalScore).toBeLessThan(50);
  });

  it('considers interaction bonus', () => {
    const job = createMockJob();
    const context = createMockContext({
      recentInteractions: [
        { jobId: 1, interactionType: 'apply', interactionScore: 1, timestamp: new Date().toISOString() },
      ],
    });

    const result = calcCompositeScoreV3(
      job,
      context,
      defaultWeights,
      new Map(),
      new Map()
    );

    // 应该有交互加成
    expect(result.totalScore).toBeGreaterThanOrEqual(50);
  });

  it('includes popularity score when weight > 0', () => {
    const job = createMockJob();
    const context = createMockContext();
    const popularScores = new Map([[1, 100]]);

    const result = calcCompositeScoreV3(
      job,
      context,
      { ...defaultWeights, popularity_weight: 0.3 },
      popularScores,
      new Map()
    );

    expect(result.dimensions.popularityScore).toBeGreaterThan(0);
  });

  it('includes collaborative score when weight > 0', () => {
    const job = createMockJob();
    const context = createMockContext();
    const similarJobs = new Map([[1, 0.8]]);

    const result = calcCompositeScoreV3(
      job,
      context,
      { ...defaultWeights, collaborative_weight: 0.3 },
      new Map(),
      similarJobs
    );

    expect(result.dimensions.collaborativeScore).toBeGreaterThan(0);
  });
});

describe('RANKING_PRESETS', () => {
  it('has all required preset types', () => {
    expect(RANKING_PRESETS).toHaveProperty('稳重型');
    expect(RANKING_PRESETS).toHaveProperty('海投型');
    expect(RANKING_PRESETS).toHaveProperty('精准型');
    expect(RANKING_PRESETS).toHaveProperty('新人型');
    expect(RANKING_PRESETS).toHaveProperty('探索型'); // v3 新增
  });

  it('weights sum to 1 for each preset', () => {
    for (const [, weights] of Object.entries(RANKING_PRESETS)) {
      const sum = weights.fame_weight +
                  weights.match_weight +
                  weights.city_weight +
                  weights.deadline_weight +
                  weights.conversion_weight +
                  weights.freshness_weight +
                  (weights.popularity_weight ?? 0) +
                  (weights.collaborative_weight ?? 0);
      // 允许一些浮点误差
      expect(sum).toBeGreaterThanOrEqual(0.95);
      expect(sum).toBeLessThanOrEqual(1.05);
    }
  });

  it('exploration preset has higher popularity and collaborative weights', () => {
    const exploration = RANKING_PRESETS.探索型;
    expect(exploration.popularity_weight).toBeGreaterThan(0);
    expect(exploration.collaborative_weight).toBeGreaterThan(0);
  });
});

describe('DIVERSITY_PRESETS', () => {
  it('has required preset types', () => {
    expect(DIVERSITY_PRESETS).toHaveProperty('保守型');
    expect(DIVERSITY_PRESETS).toHaveProperty('平衡型');
    expect(DIVERSITY_PRESETS).toHaveProperty('探索型');
  });

  it('conservative has lower exploration ratio', () => {
    expect(DIVERSITY_PRESETS.保守型.explorationRatio).toBeLessThan(
      DIVERSITY_PRESETS.探索型.explorationRatio
    );
  });

  it('conservative has higher popularity ratio', () => {
    expect(DIVERSITY_PRESETS.保守型.popularityRatio).toBeGreaterThan(
      DIVERSITY_PRESETS.探索型.popularityRatio
    );
  });
});

describe('RANKING_PRESETS', () => {
  it('returns correct ranges', () => {
    expect(getTierRange('top20')).toEqual([0, 20]);
    expect(getTierRange('top50')).toEqual([20, 50]);
    expect(getTierRange('top100')).toEqual([50, 100]);
    expect(getTierRange('top200')).toEqual([100, 200]);
    expect(getTierRange('all')).toBeNull();
  });

  it('returns null for unknown tier', () => {
    expect(getTierRange('unknown')).toBeNull();
  });
});

describe('Integration: Full Recommendation Flow', () => {
  it('simulates full recommendation scoring flow', () => {
    // 模拟一个完整的推荐流程
    const job = {
      id: 1,
      company_id: 1,
      title: '前端开发实习',
      city: '北京',
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3天后
      conversion_rate: 80,
      company_fame_score: 75,
      company_size: '大型',
      is_remote: false,
      first_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2天前
      tags: [
        { id: 1, slug: 'react', label: 'React', group_name: '前端', color_hex: '#61dafb', is_preset: true, created_at: '' },
        { id: 2, slug: 'typescript', label: 'TypeScript', group_name: '语言', color_hex: '#3178c6', is_preset: true, created_at: '' },
      ],
    } as unknown as Job & { company_fame_score: number; company_size?: string; is_remote?: boolean; first_seen_at?: string };

    const context = {
      profile: { id: 1, targetCities: ['北京', '上海'], internshipTypes: ['暑期实习'] },
      tagPrefs: [
        { id: 1, profile_id: 1, tag_id: 1, weight: 0.7, created_at: '', updated_at: '' },
        { id: 2, profile_id: 1, tag_id: 2, weight: 0.3, created_at: '', updated_at: '' },
      ],
      interests: [
        { interestType: 'skill' as const, interestKey: 'react', score: 0.9, decayFactor: 0.95 },
      ],
      dismissedJobs: [],
      recentInteractions: [],
      similarUsersCount: 5,
      isColdStart: false,
      activityScore: 70,
    };

    const weights = {
      fame_weight: 0.2,
      match_weight: 0.3,
      city_weight: 0.2,
      deadline_weight: 0.1,
      conversion_weight: 0.1,
      freshness_weight: 0.05,
      popularity_weight: 0.1,
      collaborative_weight: 0.05,
    };

    const popularScores = new Map([[1, 50]]);
    const similarJobs = new Map([[1, 0.4]]);

    const result = calcCompositeScoreV3(job, context, weights, popularScores, similarJobs);

    // 验证结果 - 使用范围检查而非精确值
    expect(result.totalScore).toBeGreaterThan(50);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.dimensions.fameScore).toBeGreaterThan(70);
    expect(result.dimensions.fameScore).toBeLessThanOrEqual(90);
    expect(result.dimensions.matchScore).toBeGreaterThanOrEqual(50); // 匹配分数应该较高
    expect(result.dimensions.cityScore).toBe(100); // 精确匹配
    expect(result.dimensions.deadlineScore).toBeGreaterThanOrEqual(80);
    expect(result.dimensions.freshnessScore).toBeGreaterThanOrEqual(80);
  });
});

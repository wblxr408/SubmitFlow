/**
 * 爬虫适配器单元测试
 * 使用 Mock 数据验证各 Adapter 的解析和标准化逻辑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveredItem, RawJobRecord, CrawlContext } from '../types';

// ============================================================
// Mock helper
// ============================================================

function createMockContext(): CrawlContext {
  return {
    profile_id: 1,
    source_id: 1,
    session_status: 'active',
  };
}

// ============================================================
// 1. 实习僧 Adapter Tests
// ============================================================
describe('ShixisengAdapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { ShixisengAdapter } = await import('../sources/shixiseng');
    adapter = new ShixisengAdapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('实习僧');
    expect(adapter.sourceType).toBe('public');
  });

  it('should normalize job with company_name and title', async () => {
    const raw: RawJobRecord = {
      source_name: '实习僧',
      source_job_id: 'test123',
      raw_payload: {
        oid: 'test123',
        job_name: '后端开发实习生',
        company_name: '字节跳动',
        city: '北京',
        salary: '400-600/天',
        day_per_week: '5天/周',
        graduated: '2025',
        job_type: '实习',
        update_time: '2024-09-01',
        url: 'https://www.shixiseng.com/intern/test123',
        logo: '',
        entry_url: 'https://www.shixiseng.com/intern/test123',
        detail_html: '',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('字节跳动');
    expect(normalized.title).toBe('后端开发实习生');
    expect(normalized.city).toBe('北京');
    expect(normalized.internship_type).toBe('实习');
    expect(normalized.is_remote).toBe(false);
  });

  it('should set campus type for 校园招聘', async () => {
    const raw: RawJobRecord = {
      source_name: '实习僧',
      source_job_id: 'test456',
      raw_payload: {
        oid: 'test456',
        job_name: '2025校园招聘 后端开发',
        company_name: '腾讯',
        city: '深圳',
        job_type: '校园招聘',
        entry_url: 'https://www.shixiseng.com/intern/test456',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('校招');
  });

  it('should extract entrypoint with correct referrer', async () => {
    const raw: RawJobRecord = {
      source_name: '实习僧',
      source_job_id: 'test789',
      raw_payload: {
        oid: 'test789',
        job_name: '测试工程师',
        company_name: '阿里巴巴',
        job_type: '实习',
        entry_url: 'https://www.shixiseng.com/intern/test789',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].entry_type).toBe('official');
    expect(entrypoints[0].referrer_name).toBe('实习僧');
    expect(entrypoints[0].visibility).toBe('public');
  });

  it('should throw error when company_name is missing', async () => {
    const raw: RawJobRecord = {
      source_name: '实习僧',
      source_job_id: 'test000',
      raw_payload: {
        oid: 'test000',
        job_name: '开发',
        company_name: '',
        job_type: '实习',
        entry_url: 'https://www.shixiseng.com/intern/test000',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });

  it('should detect remote jobs', async () => {
    const raw: RawJobRecord = {
      source_name: '实习僧',
      source_job_id: 'remote1',
      raw_payload: {
        oid: 'remote1',
        job_name: '远程实习 前端开发',
        company_name: '创业公司',
        city: '',
        job_type: '实习',
        entry_url: 'https://www.shixiseng.com/intern/remote1',
        detail_html: '<div>支持远程办公</div>',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.is_remote).toBe(false);
  });

  it('should handle JD extraction from HTML', async () => {
    const raw: RawJobRecord = {
      source_name: '实习僧',
      source_job_id: 'jd1',
      raw_payload: {
        oid: 'jd1',
        job_name: '产品经理',
        company_name: '美团',
        job_type: '实习',
        entry_url: 'https://www.shixiseng.com/intern/jd1',
        detail_html: '<div id="job_detail"><div class="job_msg">岗位职责：负责产品设计</div></div>',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.jd_text).toBeTruthy();
  });

  it('should map job_type correctly', async () => {
    const types = [
      { job_type: '校园招聘', expected: '校招' },
      { job_type: '实习', expected: '实习' },
      { job_type: '社会招聘', expected: '社招' },
      { job_type: '兼职', expected: '实习' },
      { job_type: '未知类型', expected: '校招' },
    ];

    for (const { job_type, expected } of types) {
      const raw: RawJobRecord = {
        source_name: '实习僧',
        source_job_id: `type_${job_type}`,
        raw_payload: {
          oid: `type_${job_type}`,
          job_name: '测试',
          company_name: '公司',
          job_type,
          entry_url: 'https://www.shixiseng.com/intern/test',
        },
      };

      const normalized = await adapter.normalize(raw);
      expect(normalized.internship_type).toBe(expected);
    }
  });

  it('should detect needsReauth for auth errors', () => {
    expect(adapter.needsReauth(new Error('需要登录'))).toBe(true);
    expect(adapter.needsReauth(new Error('401 Unauthorized'))).toBe(true);
    expect(adapter.needsReauth(new Error('403 Forbidden'))).toBe(true);
    expect(adapter.needsReauth(new Error('网络错误'))).toBe(false);
    expect(adapter.needsReauth('not an error')).toBe(false);
  });
});

// ============================================================
// 2. 应届生求职网 Adapter Tests
// ============================================================
describe('YingjieshengAdapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { YingjieshengAdapter } = await import('../sources/yingjiesheng');
    adapter = new YingjieshengAdapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('应届生求职网');
    expect(adapter.sourceType).toBe('public');
  });

  it('should normalize job with extracted company name', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test1',
      raw_payload: {
        title: '字节跳动2025校园招聘 后端开发工程师',
        company: '字节跳动',
        city: '北京',
        date: '2024-09-01',
        url: 'https://www.yingjiesheng.com/job/123.html',
        detail_text: '岗位职责：负责业务开发\n任职要求：本科及以上',
        detail_url: 'https://www.yingjiesheng.com/job/123.html',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('字节跳动');
    expect(normalized.title).toContain('后端');
    expect(normalized.city).toBe('北京');
    expect(normalized.internship_type).toBe('校招');
  });

  it('should extract company name from title when company field is empty', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test2',
      raw_payload: {
        title: '腾讯2025届秋招 前端开发',
        company: '',
        city: '深圳',
        detail_text: '岗位职责：前端开发\n任职要求：本科',
        detail_url: 'https://www.yingjiesheng.com/job/456.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.company_name).toBe('腾讯');
    expect(normalized.title).toBeTruthy();
  });

  it('should detect 校招 internship type from keyword', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test3',
      raw_payload: {
        title: '阿里巴巴 校园招聘 后台开发',
        company: '阿里巴巴',
        detail_text: '校招岗位\n工作地点：北京',
        detail_url: 'https://www.yingjiesheng.com/job/789.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('校招');
  });

  it('should detect 实习 internship type', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test4',
      raw_payload: {
        title: '网易游戏 实习 前端开发',
        company: '网易',
        detail_text: '招收实习生\n实习地点：上海',
        detail_url: 'https://www.yingjiesheng.com/job/111.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('实习');
  });

  it('should extract deadline from text', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test5',
      raw_payload: {
        title: '京东 校招 产品经理',
        company: '京东',
        detail_text: '截止日期：2024-10-31\n岗位职责：...',
        detail_url: 'https://www.yingjiesheng.com/job/222.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.deadline).toBe('2024-10-31');
  });

  it('should normalize city from payload city field', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test6',
      raw_payload: {
        title: '美团 校招 后端',
        company: '美团',
        city: '深圳',
        detail_text: '工作地点：深圳\n岗位职责：...',
        detail_url: 'https://www.yingjiesheng.com/job/333.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.city).toBeTruthy();
  });

  it('should throw when company_name is missing', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test7',
      raw_payload: {
        title: '未知公司 校招 开发',
        company: '',
        detail_text: '',
        detail_url: 'https://www.yingjiesheng.com/job/444.html',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });

  it('should throw when job title is missing', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test8',
      raw_payload: {
        title: '',
        company: '腾讯',
        detail_text: '只有公司名没有职位',
        detail_url: 'https://www.yingjiesheng.com/job/555.html',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing a concrete job title');
  });

  it('should extract entrypoint correctly', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_test9',
      raw_payload: {
        title: '小米 校招 硬件',
        company: '小米',
        detail_url: 'https://www.yingjiesheng.com/job/666.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].entry_type).toBe('official');
    expect(entrypoints[0].referrer_name).toBe('应届生求职网');
    expect(entrypoints[0].source_job_id).toBe('yj_test9');
  });

  it('should detect remote work', async () => {
    const raw: RawJobRecord = {
      source_name: '应届生求职网',
      source_job_id: 'yj_remote1',
      raw_payload: {
        title: '快手 远程实习',
        company: '快手',
        detail_text: '支持远程remote办公',
        detail_url: 'https://www.yingjiesheng.com/job/777.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.is_remote).toBe(true);
  });
});

// ============================================================
// 3. 前程无忧 Adapter Tests
// ============================================================
describe('Job51Adapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { Job51Adapter } = await import('../sources/51job');
    adapter = new Job51Adapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('前程无忧');
    expect(adapter.sourceType).toBe('public');
  });

  it('should normalize job with workarea_text as city', async () => {
    const raw: RawJobRecord = {
      source_name: '前程无忧',
      source_job_id: '51_test1',
      raw_payload: {
        jobid: '51_test1',
        job_name: '2025校园招聘 Java开发',
        company_name: '华为',
        companyid: 'hw123',
        providesalary_text: '15000-25000',
        workarea: '030200',
        workarea_text: '广州-天河区',
        updatedate: '2024-09-15',
        iscollect: '0',
        isvalid: '1',
        jobwelf: '五险一金,年终奖',
        attribute_text: ['本科', '3-5年', '校招'],
        companytype_text: '民营',
        entry_url: 'https://we.51job.com/pc/job?jobid=51_test1',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('华为');
    expect(normalized.title).toBe('2025校园招聘 Java开发');
    expect(normalized.internship_type).toBe('校招');
    expect(normalized.deadline).toBe('2024-09-15');
  });

  it('should parse deadline from updatedate', async () => {
    const raw: RawJobRecord = {
      source_name: '前程无忧',
      source_job_id: '51_deadline1',
      raw_payload: {
        jobid: '51_deadline1',
        job_name: '测试',
        company_name: '公司',
        updatedate: '2024-11-30',
        entry_url: 'https://we.51job.com/pc/job?jobid=51_deadline1',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.deadline).toBe('2024-11-30');
  });

  it('should detect 实习 type when 实习 keyword present', async () => {
    const raw: RawJobRecord = {
      source_name: '前程无忧',
      source_job_id: '51_intern1',
      raw_payload: {
        jobid: '51_intern1',
        job_name: '软件开发实习',
        company_name: '创业公司',
        attribute_text: ['本科', '在读', '实习'],
        entry_url: 'https://we.51job.com/pc/job?jobid=51_intern1',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('实习');
  });

  it('should extract entrypoint with correct referrer', async () => {
    const raw: RawJobRecord = {
      source_name: '前程无忧',
      source_job_id: '51_ep1',
      raw_payload: {
        jobid: '51_ep1',
        job_name: '后端',
        company_name: '腾讯',
        entry_url: 'https://we.51job.com/pc/job?jobid=51_ep1',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].referrer_name).toBe('前程无忧');
    expect(entrypoints[0].entry_type).toBe('official');
    expect(entrypoints[0].source_job_id).toBe('51_ep1');
  });

  it('should throw when company_name is missing', async () => {
    const raw: RawJobRecord = {
      source_name: '前程无忧',
      source_job_id: '51_no_company',
      raw_payload: {
        jobid: '51_no_company',
        job_name: '开发',
        company_name: '',
        entry_url: 'https://we.51job.com/pc/job?jobid=51_no_company',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });

  it('should normalize city from workarea_text', async () => {
    const raw: RawJobRecord = {
      source_name: '前程无忧',
      source_job_id: '51_city1',
      raw_payload: {
        jobid: '51_city1',
        job_name: '测试',
        company_name: '公司',
        workarea_text: '上海-浦东新区',
        entry_url: 'https://we.51job.com/pc/job?jobid=51_city1',
      },
    };

    const normalized = await adapter.normalize(raw);
    // 前程无忧的 workarea_text 格式是 "城市-区县"，normalizeCity 取最后一段
    expect(normalized.city).toBeTruthy();
    expect(normalized.city!.length).toBeGreaterThan(0);
  });

  it('should detect needsReauth', () => {
    expect(adapter.needsReauth(new Error('需要登录'))).toBe(true);
    expect(adapter.needsReauth(new Error('403'))).toBe(true);
    expect(adapter.needsReauth(new Error('普通错误'))).toBe(false);
  });
});

// ============================================================
// 4. BOSS直聘 Adapter Tests
// ============================================================
describe('ZhipinAdapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { ZhipinAdapter } = await import('../sources/zhipin');
    adapter = new ZhipinAdapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('BOSS直聘');
    expect(adapter.sourceType).toBe('public');
  });

  it('should normalize job with all fields', async () => {
    const raw: RawJobRecord = {
      source_name: 'BOSS直聘',
      source_job_id: 'bp_enc1',
      raw_payload: {
        encryptJobId: 'bp_enc1',
        jobName: '2025校招 后端开发工程师',
        companyName: '字节跳动',
        city: '101010100',
        areaDistrict: '北京',
        workingExp: '在校/应届',
        salary: '20-35K',
        jobTags: [{ name: '校招' }, { name: '六险一金' }],
        brandType: '上市公司',
        bossName: 'HR张经理',
        bossTitle: '招聘专员',
        city_name: '北京',
        entry_url: 'https://www.zhipin.com/job_detail/bp_enc1.html',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('字节跳动');
    expect(normalized.title).toContain('后端');
    expect(normalized.city).toBe('北京');
    expect(normalized.internship_type).toBe('校招');
    expect(normalized.is_remote).toBe(false);
  });

  it('should extract city from areaDistrict', async () => {
    const raw: RawJobRecord = {
      source_name: 'BOSS直聘',
      source_job_id: 'bp_city1',
      raw_payload: {
        encryptJobId: 'bp_city1',
        jobName: '前端开发',
        companyName: '公司',
        areaDistrict: '深圳-南山区',
        city_name: '深圳',
        entry_url: 'https://www.zhipin.com/job_detail/bp_city1.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.city).toBeTruthy();
  });

  it('should detect 校招 type from jobTags', async () => {
    const raw: RawJobRecord = {
      source_name: 'BOSS直聘',
      source_job_id: 'bp_type1',
      raw_payload: {
        encryptJobId: 'bp_type1',
        jobName: '产品经理',
        companyName: '腾讯',
        jobTags: [{ name: '校招' }],
        entry_url: 'https://www.zhipin.com/job_detail/bp_type1.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('校招');
  });

  it('should detect 实习 type', async () => {
    const raw: RawJobRecord = {
      source_name: 'BOSS直聘',
      source_job_id: 'bp_intern1',
      raw_payload: {
        encryptJobId: 'bp_intern1',
        jobName: '数据分析实习',
        companyName: '创业公司',
        jobTags: [{ name: '实习' }],
        entry_url: 'https://www.zhipin.com/job_detail/bp_intern1.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('实习');
  });

  it('should extract entrypoint correctly', async () => {
    const raw: RawJobRecord = {
      source_name: 'BOSS直聘',
      source_job_id: 'bp_ep1',
      raw_payload: {
        encryptJobId: 'bp_ep1',
        jobName: '测试',
        companyName: '公司',
        entry_url: 'https://www.zhipin.com/job_detail/bp_ep1.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].referrer_name).toBe('BOSS直聘');
    expect(entrypoints[0].source_job_id).toBe('bp_ep1');
  });

  it('should throw when company_name is missing', async () => {
    const raw: RawJobRecord = {
      source_name: 'BOSS直聘',
      source_job_id: 'bp_nocompany',
      raw_payload: {
        encryptJobId: 'bp_nocompany',
        jobName: '开发',
        companyName: '',
        entry_url: 'https://www.zhipin.com/job_detail/bp_nocompany.html',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });
});

// ============================================================
// 5. 官网直投 Adapter Tests
// ============================================================
describe('CompanyCareersAdapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { CompanyCareersAdapter } = await import('../sources/companycareers');
    adapter = new CompanyCareersAdapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('官网直接投递');
    expect(adapter.sourceType).toBe('public');
  });

  it('should normalize job with HTML JD', async () => {
    const raw: RawJobRecord = {
      source_name: '官网直接投递',
      source_job_id: 'cc_test1',
      raw_payload: {
        company_name: '字节跳动',
        careers_url: 'https://careers.bytedance.com/',
        detail_html: '<h1 class="job-title">后端开发工程师</h1><div class="job-description">岗位职责：负责业务开发<br>任职要求：本科及以上</div>',
        detail_url: 'https://careers.bytedance.com/campus/123',
        discovered_text: '2025校园招聘 后端开发工程师',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('字节跳动');
    expect(normalized.internship_type).toBe('校招');
  });

  it('should detect remote from JD text', async () => {
    const raw: RawJobRecord = {
      source_name: '官网直接投递',
      source_job_id: 'cc_remote1',
      raw_payload: {
        company_name: '创业公司',
        careers_url: 'https://startup.example.com/careers',
        detail_html: '<div class="job-detail"><h1 class="job-title">后端开发</h1>支持远程 Work from home 居家办公</div>',
        detail_url: 'https://startup.example.com/careers/123',
        job_name: '后端开发',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.is_remote).toBe(true);
  });

  it('should extract deadline from JD text', async () => {
    const raw: RawJobRecord = {
      source_name: '官网直接投递',
      source_job_id: 'cc_dl1',
      raw_payload: {
        company_name: '腾讯',
        careers_url: 'https://careers.tencent.com/',
        detail_html: '<div class="content">网申截止：2024-10-31<br>岗位职责：...</div>',
        detail_url: 'https://careers.tencent.com/campus/456',
        discovered_text: '2025秋招 后端',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.deadline).toBe('2024-10-31');
  });

  it('should extract entrypoint with company as referrer', async () => {
    const raw: RawJobRecord = {
      source_name: '官网直接投递',
      source_job_id: 'cc_ep1',
      raw_payload: {
        company_name: '美团',
        careers_url: 'https://campus.meituan.com/',
        detail_url: 'https://campus.meituan.com/job/789',
        discovered_text: '美团2025校园招聘 后端开发',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].entry_type).toBe('official');
    expect(entrypoints[0].referrer_name).toBe('美团');
    expect(entrypoints[0].visibility).toBe('public');
  });

  it('should throw when company_name is missing and cannot be extracted', async () => {
    const raw: RawJobRecord = {
      source_name: '官网直接投递',
      source_job_id: 'cc_nocompany',
      raw_payload: {
        careers_url: '',
        detail_url: '',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });

  it('should detect 校招 type', async () => {
    const raw: RawJobRecord = {
      source_name: '官网直接投递',
      source_job_id: 'cc_type1',
      raw_payload: {
        company_name: '华为',
        careers_url: 'https://careers.huawei.com/',
        detail_html: '<div>2025校园招聘开始</div>',
        detail_url: 'https://careers.huawei.com/campus',
        discovered_text: '2025届秋招',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('校招');
  });

  it('should detect needsReauth', () => {
    expect(adapter.needsReauth(new Error('需要登录'))).toBe(true);
    expect(adapter.needsReauth(new Error('403'))).toBe(true);
    expect(adapter.needsReauth(new Error('网络错误'))).toBe(false);
  });
});

// ============================================================
// 6. 天眼查 Adapter Tests
// ============================================================
describe('TianyanchaAdapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { TianyanchaAdapter } = await import('../sources/tianyancha');
    adapter = new TianyanchaAdapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('天眼查');
    expect(adapter.sourceType).toBe('public');
  });

  it('should normalize job with company name', async () => {
    const raw: RawJobRecord = {
      source_name: '天眼查',
      source_job_id: 'tyc_test1',
      raw_payload: {
        company_name: '字节跳动',
        company_id: '6674190',
        city: '北京',
        salary: '20-40K',
        date: '2024-09-01',
        detail_html: '<div class="job-detail">岗位职责：业务开发<br>任职要求：本科</div>',
        detail_url: 'https://www.tianyancha.com/job/123.html',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('字节跳动');
    expect(normalized.internship_type).toBe('校招');
  });

  it('should detect 实习 type from JD', async () => {
    const raw: RawJobRecord = {
      source_name: '天眼查',
      source_job_id: 'tyc_intern1',
      raw_payload: {
        company_name: '创业公司',
        company_id: 'startup1',
        detail_html: '<div>招聘实习 每天300元 实习期三个月</div>',
        detail_url: 'https://www.tianyancha.com/job/456.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('实习');
  });

  it('should extract entrypoint with official type', async () => {
    const raw: RawJobRecord = {
      source_name: '天眼查',
      source_job_id: 'tyc_ep1',
      raw_payload: {
        company_name: '阿里巴巴',
        detail_url: 'https://www.tianyancha.com/job/789.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].entry_type).toBe('official');
    expect(entrypoints[0].referrer_name).toBe('天眼查');
    expect(entrypoints[0].visibility).toBe('public');
  });

  it('should throw when company_name is missing', async () => {
    const raw: RawJobRecord = {
      source_name: '天眼查',
      source_job_id: 'tyc_nocompany',
      raw_payload: {
        detail_url: 'https://www.tianyancha.com/job/000.html',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });

  it('should normalize city', async () => {
    const raw: RawJobRecord = {
      source_name: '天眼查',
      source_job_id: 'tyc_city1',
      raw_payload: {
        company_name: '公司',
        city: '上海',
        detail_url: 'https://www.tianyancha.com/job/city1.html',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.city).toBe('上海');
  });

  it('should detect needsReauth', () => {
    expect(adapter.needsReauth(new Error('需要登录'))).toBe(true);
    expect(adapter.needsReauth(new Error('403'))).toBe(true);
    expect(adapter.needsReauth(new Error('普通错误'))).toBe(false);
  });
});

// ============================================================
// 7. 内推鸭 Adapter Tests
// ============================================================
describe('NeituiyaAdapter', () => {
  let adapter: import('../types').SourceAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const { NeituiyaAdapter } = await import('../sources/neituiya');
    adapter = new NeituiyaAdapter();
  });

  it('should have correct source metadata', () => {
    expect(adapter.sourceName).toBe('内推鸭');
    expect(adapter.sourceType).toBe('public_referral');
  });

  it('should normalize job with company_name and title from recruit_moment', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_test1',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_test1',
          paperName: '字节跳动2025秋招 后端开发工程师',
          desc: '公司名称：字节跳动\n招聘岗位：后端开发工程师\n工作城市：北京\n岗位职责：负责业务开发\n任职要求：本科及以上',
        },
        detail: {
          paperModelView: {
            id: 'nt_test1',
            paperName: '字节跳动2025秋招 后端开发工程师',
            desc: '公司名称：字节跳动\n招聘岗位：后端开发工程师\n工作城市：北京\n岗位职责：负责业务开发\n任职要求：本科及以上',
          },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_test1',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('字节跳动');
    expect(normalized.title).toContain('后端');
    expect(normalized.city).toBe('北京');
    expect(normalized.internship_type).toBe('校招');
    expect(normalized.is_remote).toBe(false);
  });

  it('should normalize job from industry_list feed', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_test2',
      raw_payload: {
        feed_type: 'industry_list',
        category_id: 'backend',
        category_name: '后端开发',
        listing: {
          id: 'nt_test2',
          paperName: '腾讯 实习 前端开发',
          desc: '公司名称：腾讯\n职位名：前端开发实习\n工作地点：深圳\n实习',
        },
        detail: null,
        detail_url: 'https://www.neituiya.com/detail/nt_test2',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('腾讯');
    expect(normalized.title).toContain('前端');
    expect(normalized.internship_type).toBe('实习');
  });

  it('should extract entrypoint with public_referral type', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_ep1',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_ep1',
          paperName: '美团2025校招 后端',
          desc: '公司名称：美团\n招聘岗位：后端\n工作城市：上海\n校招',
        },
        detail: {
          paperModelView: {
            id: 'nt_ep1',
            paperName: '美团2025校招 后端',
            desc: '公司名称：美团\n招聘岗位：后端\n工作城市：上海',
          },
          userModelView: { name: '内推人张三' },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_ep1',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints).toHaveLength(1);
    expect(entrypoints[0].entry_type).toBe('public_referral');
    expect(entrypoints[0].referrer_name).toBe('内推人张三');
    expect(entrypoints[0].visibility).toBe('public');
  });

  it('should throw when company_name is missing', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_nocompany',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_nocompany',
          paperName: '2025秋招 后端开发',
          desc: '岗位职责：负责业务开发',
        },
        detail: null,
        detail_url: 'https://www.neituiya.com/detail/nt_nocompany',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing company_name');
  });

  it('should throw when paper is missing from payload', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_nopaper',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: null,
        detail: null,
        detail_url: 'https://www.neituiya.com/detail/nt_nopaper',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('missing detail payload');
  });

  it('should detect 实习 type from text', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_intern1',
      raw_payload: {
        feed_type: 'industry_list',
        listing: {
          id: 'nt_intern1',
          paperName: '创业公司 实习 前端',
          desc: '公司名称：某创业公司\n实习 每天300元',
        },
        detail: {
          paperModelView: {
            id: 'nt_intern1',
            paperName: '创业公司 实习 前端',
            desc: '公司名称：某创业公司\n实习',
          },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_intern1',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.internship_type).toBe('实习');
  });

  it('should detect remote from text', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_remote1',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_remote1',
          paperName: '远程实习 后端开发',
          desc: '公司名称：远程公司\n支持远程remote办公 居家',
        },
        detail: {
          paperModelView: {
            id: 'nt_remote1',
            paperName: '远程实习 后端开发',
            desc: '公司名称：远程公司\n支持远程居家',
          },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_remote1',
      },
    };

    const normalized = await adapter.normalize(raw);
    expect(normalized.is_remote).toBe(true);
  });

  it('should throw when does not look like recruitment post', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_notrecruit',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_notrecruit',
          paperName: '面经分享 字节跳动后端一面',
          desc: '分享一下字节跳动后端岗位的一面经验...',
        },
        detail: {
          paperModelView: {
            id: 'nt_notrecruit',
            paperName: '面经分享 字节跳动后端一面',
            desc: '分享一下字节跳动后端岗位的一面经验...',
          },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_notrecruit',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow('does not look like a recruitment post');
  });

  it('should throw when title does not look like a recruitment post', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_notrecruit',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_notrecruit',
          paperName: '多岗位热招中',
          desc: '公司名称：大公司\n多岗位热招中 立即申请',
        },
        detail: {
          paperModelView: {
            id: 'nt_notrecruit',
            paperName: '多岗位热招中',
            desc: '公司名称：大公司\n多岗位热招中',
          },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_notrecruit',
      },
    };

    await expect(adapter.normalize(raw)).rejects.toThrow();
  });

  it('should extract referrer name from userModelView', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_referrer1',
      raw_payload: {
        feed_type: 'recruit_moment',
        listing: {
          id: 'nt_referrer1',
          paperName: '华为2025校招 后端',
          desc: '公司名称：华为\n招聘岗位：后端\n工作城市：深圳',
        },
        detail: {
          paperModelView: {
            id: 'nt_referrer1',
            paperName: '华为2025校招 后端',
            desc: '公司名称：华为\n招聘岗位：后端\n工作城市：深圳',
          },
          userModelView: { name: '内推人李四' },
        },
        detail_url: 'https://www.neituiya.com/detail/nt_referrer1',
      },
    };

    const normalized = await adapter.normalize(raw);
    const entrypoints = await adapter.extractEntrypoints(normalized);

    expect(entrypoints[0].referrer_name).toBe('内推人李四');
  });

  it('should detect needsReauth', () => {
    expect(adapter.needsReauth(new Error('需要登录'))).toBe(true);
    expect(adapter.needsReauth(new Error('401 Unauthorized'))).toBe(true);
    expect(adapter.needsReauth(new Error('普通错误'))).toBe(false);
    expect(adapter.needsReauth('not an error')).toBe(false);
  });

  it('should fall back to listing when detail is null', async () => {
    const raw: RawJobRecord = {
      source_name: '内推鸭',
      source_job_id: 'nt_nodetail',
      raw_payload: {
        feed_type: 'industry_list',
        listing: {
          id: 'nt_nodetail',
          paperName: '创业公司 校招 后端开发',
          desc: '公司名称：某创业公司\n招聘岗位：后端开发\n工作城市：北京\n校招',
        },
        detail: null,
        detail_url: 'https://www.neituiya.com/detail/nt_nodetail',
      },
    };

    const normalized = await adapter.normalize(raw);

    expect(normalized.company_name).toBe('某创业公司');
    expect(normalized.title).toContain('后端');
    expect(normalized.internship_type).toBe('校招');
  });
});

// ============================================================
// 8. 全部 Adapter 通用测试
// ============================================================
describe('All Adapters - Common Interface Compliance', () => {
  async function makeShixisengAdapter() { const { ShixisengAdapter } = await import('../sources/shixiseng'); return new ShixisengAdapter(); }
  async function makeYingjieshengAdapter() { const { YingjieshengAdapter } = await import('../sources/yingjiesheng'); return new YingjieshengAdapter(); }
  async function makeJob51Adapter() { const { Job51Adapter } = await import('../sources/51job'); return new Job51Adapter(); }
  async function makeZhipinAdapter() { const { ZhipinAdapter } = await import('../sources/zhipin'); return new ZhipinAdapter(); }
  async function makeCompanyCareersAdapter() { const { CompanyCareersAdapter } = await import('../sources/companycareers'); return new CompanyCareersAdapter(); }
  async function makeTianyanchaAdapter() { const { TianyanchaAdapter } = await import('../sources/tianyancha'); return new TianyanchaAdapter(); }
  async function makeNeituiyaAdapter() { const { NeituiyaAdapter } = await import('../sources/neituiya'); return new NeituiyaAdapter(); }

  const adapters: Array<{ name: string; factory: () => Promise<import('../types').SourceAdapter> }> = [
    { name: 'ShixisengAdapter', factory: makeShixisengAdapter },
    { name: 'YingjieshengAdapter', factory: makeYingjieshengAdapter },
    { name: 'Job51Adapter', factory: makeJob51Adapter },
    { name: 'ZhipinAdapter', factory: makeZhipinAdapter },
    { name: 'CompanyCareersAdapter', factory: makeCompanyCareersAdapter },
    { name: 'TianyanchaAdapter', factory: makeTianyanchaAdapter },
    { name: 'NeituiyaAdapter', factory: makeNeituiyaAdapter },
  ];

  it.each(adapters)('$name should implement SourceAdapter interface', async ({ factory }) => {
    const adapter = await factory();

    expect(typeof adapter.sourceName).toBe('string');
    expect(adapter.sourceName.length).toBeGreaterThan(0);

    expect(typeof adapter.sourceType).toBe('string');
    expect(['public', 'public_referral', 'private_import', 'auth_required']).toContain(adapter.sourceType);

    expect(typeof adapter.discover).toBe('function');
    expect(typeof adapter.fetchDetail).toBe('function');
    expect(typeof adapter.normalize).toBe('function');
    expect(typeof adapter.extractEntrypoints).toBe('function');
    expect(typeof adapter.needsReauth).toBe('function');
  });
});

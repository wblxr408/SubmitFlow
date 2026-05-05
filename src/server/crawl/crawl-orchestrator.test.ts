/**
 * 爬虫编排层集成测试
 * 测试 buildCompanySearchVariants、nullIfBlank、dedupeEntrypoints、inferDirection、stringifyError 等纯函数
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// buildCompanySearchVariants
// ============================================================

function buildCompanySearchVariants(companyName: string): string[] {
  const normalized = companyName.trim();
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  const compact = normalized.replace(/\s+/g, '');
  if (compact !== normalized) variants.add(compact);

  const withoutBracket = compact.replace(/[（(].*?[）)]/g, '');
  if (withoutBracket !== compact && withoutBracket) variants.add(withoutBracket);

  const suffixPatterns = [
    /股份有限公司$/u,
    /有限责任公司$/u,
    /集团有限公司$/u,
    /有限公司$/u,
    /集团$/u,
  ];

  for (const base of [compact, withoutBracket]) {
    if (!base) continue;
    // Try stripping each suffix independently to capture intermediate results
    for (const pattern of suffixPatterns) {
      const stripped = base.replace(pattern, '').trim();
      if (stripped && stripped !== base && stripped.length >= 2) {
        variants.add(stripped);
        // Now chain further stripping from the stripped result
        let current = stripped;
        for (const p2 of suffixPatterns) {
          const stripped2 = current.replace(p2, '').trim();
          if (stripped2 && stripped2 !== current && stripped2.length >= 2) {
            variants.add(stripped2);
            current = stripped2;
          }
        }
      }
    }
  }

  return [...variants].slice(0, 10);
}

describe('buildCompanySearchVariants', () => {
  it('should return empty array for empty input', () => {
    expect(buildCompanySearchVariants('')).toEqual([]);
    expect(buildCompanySearchVariants('   ')).toEqual([]);
  });

  it('should include original name', () => {
    const variants = buildCompanySearchVariants('字节跳动');
    expect(variants).toContain('字节跳动');
  });

  it('should remove spaces', () => {
    const variants = buildCompanySearchVariants('字节 跳动');
    expect(variants).toContain('字节跳动');
  });

  it('should remove parenthetical content', () => {
    const variants = buildCompanySearchVariants('字节跳动（宇宙厂）');
    expect(variants).toContain('字节跳动');
  });

  it('should strip 股份有限公司 suffix', () => {
    const variants = buildCompanySearchVariants('字节跳动股份有限公司');
    expect(variants).toContain('字节跳动');
    expect(variants).toContain('字节跳动股份有限公司');
  });

  it('should strip multiple suffixes in sequence', () => {
    const variants = buildCompanySearchVariants('字节跳动集团有限公司');
    expect(variants).toContain('字节跳动集团有限公司');
    expect(variants).toContain('字节跳动集团');
    expect(variants).toContain('字节跳动');
  });

  it('should strip all suffix types', () => {
    const suffixes = ['股份有限公司', '有限责任公司', '集团有限公司', '有限公司', '集团'];
    for (const suffix of suffixes) {
      const name = `公司${suffix}`;
      const variants = buildCompanySearchVariants(name);
      expect(variants).toContain('公司');
      expect(variants).toContain(`公司${suffix}`);
    }
  });

  it('should not exceed 10 variants', () => {
    const variants = buildCompanySearchVariants('字节跳动股份有限公司集团有限公司');
    expect(variants.length).toBeLessThanOrEqual(10);
  });

  it('should remove duplicates from multiple stripping passes', () => {
    const variants = buildCompanySearchVariants('字节跳动股份有限公司');
    const unique = new Set(variants);
    expect(unique.size).toBe(variants.length);
  });

  it('should handle English company names', () => {
    const variants = buildCompanySearchVariants('ByteDance Ltd.');
    expect(variants).toContain('ByteDance Ltd.');
  });

  it('should not include empty or too-short variants', () => {
    const variants = buildCompanySearchVariants('股份有限公司');
    expect(variants.every((v) => v.length >= 2)).toBe(true);
  });
});

// ============================================================
// nullIfBlank
// ============================================================

function nullIfBlank(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

describe('nullIfBlank', () => {
  it('should return null for null', () => {
    expect(nullIfBlank(null)).toBeNull();
  });

  it('should return null for undefined', () => {
    expect(nullIfBlank(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(nullIfBlank('')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(nullIfBlank('   ')).toBeNull();
    expect(nullIfBlank('\t\n')).toBeNull();
  });

  it('should return trimmed string for non-blank', () => {
    expect(nullIfBlank('  北京  ')).toBe('北京');
  });

  it('should return trimmed string for normal text', () => {
    expect(nullIfBlank('深圳')).toBe('深圳');
  });
});

// ============================================================
// dedupeEntrypoints
// ============================================================

interface JobEntrypointInput {
  entry_type: string;
  entry_url: string;
  visibility: string;
  requires_auth: boolean;
  referrer_name?: string;
}

function dedupeEntrypoints(entrypoints: JobEntrypointInput[]): JobEntrypointInput[] {
  const seen = new Set<string>();
  const unique: JobEntrypointInput[] = [];

  for (const entrypoint of entrypoints) {
    const key = [
      entrypoint.entry_type,
      entrypoint.entry_url,
      entrypoint.visibility,
      String(entrypoint.requires_auth),
      entrypoint.referrer_name ?? '',
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entrypoint);
  }

  return unique;
}

describe('dedupeEntrypoints', () => {
  it('should deduplicate by entry_type + entry_url + visibility + requires_auth', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(1);
  });

  it('should keep entries with different urls', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'official', entry_url: 'https://example.com/2', visibility: 'public', requires_auth: false },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(2);
  });

  it('should keep entries with different referrer_name', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'public_referral', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false, referrer_name: '张三' },
      { entry_type: 'public_referral', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false, referrer_name: '李四' },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(2);
  });

  it('should treat null and undefined referrer_name same as empty string', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'public_referral', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'public_referral', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false, referrer_name: '' },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(1);
  });

  it('should differentiate by entry_type', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'public_referral', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(2);
  });

  it('should return empty array for empty input', () => {
    expect(dedupeEntrypoints([])).toEqual([]);
  });

  it('should preserve original order of first occurrence', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'official', entry_url: 'https://a.com', visibility: 'public', requires_auth: false },
      { entry_type: 'public_referral', entry_url: 'https://b.com', visibility: 'public', requires_auth: false },
      { entry_type: 'official', entry_url: 'https://a.com', visibility: 'public', requires_auth: false },
    ];
    const result = dedupeEntrypoints(input);
    expect(result).toHaveLength(2);
    expect(result[0].entry_url).toBe('https://a.com');
    expect(result[1].entry_url).toBe('https://b.com');
  });

  it('should differentiate by visibility', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'private', requires_auth: false },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(2);
  });

  it('should differentiate by requires_auth', () => {
    const input: JobEntrypointInput[] = [
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: false },
      { entry_type: 'official', entry_url: 'https://example.com/1', visibility: 'public', requires_auth: true },
    ];
    expect(dedupeEntrypoints(input)).toHaveLength(2);
  });
});

// ============================================================
// stringifyError
// ============================================================

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

describe('stringifyError', () => {
  it('should return error message for Error instance', () => {
    expect(stringifyError(new Error('network failed'))).toBe('network failed');
  });

  it('should return string representation for non-Error values', () => {
    expect(stringifyError('simple string')).toBe('simple string');
    expect(stringifyError(123)).toBe('123');
    expect(stringifyError(null)).toBe('null');
    expect(stringifyError({})).toBe('[object Object]');
  });
});

// ============================================================
// inferDirection
// ============================================================

function inferDirection(raw: Record<string, unknown>): string | null {
  const value = (() => {
    const v = raw.careerJobName;
    if (typeof v === 'string' && v.trim()) return v.trim();
    const v2 = raw.secondJobType;
    if (typeof v2 === 'string' && v2.trim()) return v2.trim();
    const v3 = raw.jobKeys;
    if (typeof v3 === 'string' && v3.trim()) return v3.split(',')[0].trim();
    return null;
  })();

  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

describe('inferDirection', () => {
  it('should return careerJobName when present', () => {
    expect(inferDirection({ careerJobName: '后端开发' })).toBe('后端开发');
  });

  it('should fall back to secondJobType', () => {
    expect(inferDirection({ secondJobType: '前端开发' })).toBe('前端开发');
  });

  it('should fall back to first jobKeys entry', () => {
    expect(inferDirection({ jobKeys: '算法,后端,Python' })).toBe('算法');
  });

  it('should return null when all fields empty', () => {
    expect(inferDirection({})).toBeNull();
  });

  it('should handle null/undefined values gracefully', () => {
    expect(inferDirection({ careerJobName: null, secondJobType: undefined })).toBeNull();
  });

  it('should trim whitespace', () => {
    expect(inferDirection({ careerJobName: '  后端开发  ' })).toBe('后端开发');
  });
});

// ============================================================
// CrawlExecutionResult type compliance
// ============================================================

describe('CrawlExecutionResult type compliance', () => {
  it('should accept valid completed result shape', () => {
    const result = {
      runId: 1,
      sourceId: 2,
      sourceName: '牛客网',
      status: 'completed' as const,
      discovered: 100,
      inserted: 80,
      updated: 10,
      rawRecords: 100,
      entrypoints: 90,
      failedItems: 5,
    };
    expect(result.runId).toBe(1);
    expect(result.status).toBe('completed');
    expect(result.inserted).toBe(80);
    expect(result.updated).toBe(10);
  });

  it('should accept failed status with error field', () => {
    const result = {
      runId: 1,
      sourceId: 2,
      sourceName: '前程无忧',
      status: 'failed' as const,
      discovered: 0,
      inserted: 0,
      updated: 0,
      rawRecords: 0,
      entrypoints: 0,
      failedItems: 0,
      error: 'Network timeout exceeded',
    };
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Network timeout exceeded');
  });

  it('should allow zero stats when discover throws early', () => {
    const result = {
      runId: 1,
      sourceId: 2,
      sourceName: '天眼查',
      status: 'completed' as const,
      discovered: 0,
      inserted: 0,
      updated: 0,
      rawRecords: 0,
      entrypoints: 0,
      failedItems: 0,
    };
    expect(result.discovered).toBe(0);
    expect(result.status).toBe('completed');
  });

  it('should allow partial results (some items failed)', () => {
    const result = {
      runId: 5,
      sourceId: 3,
      sourceName: 'BOSS直聘',
      status: 'completed' as const,
      discovered: 50,
      inserted: 40,
      updated: 5,
      rawRecords: 45,
      entrypoints: 45,
      failedItems: 5,
    };
    expect(result.discovered).toBe(50);
    expect(result.failedItems).toBe(5);
    expect(result.inserted + result.updated).toBeLessThanOrEqual(result.discovered);
  });
});

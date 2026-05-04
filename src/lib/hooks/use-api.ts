/**
 * React Query Hooks 封装
 * 提供类型安全的 API 数据获取
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================
// 通用 API 基础函数
// ============================================================
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ============================================================
// 岗位 API
// ============================================================
export interface JobsParams {
  keyword?: string;
  city?: string;
  internship_type?: string;
  has_referral?: boolean;
  industry?: string;
  page?: number;
  page_size?: number;
}

export function useJobs(params: JobsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.keyword) searchParams.set('keyword', params.keyword);
  if (params.city) searchParams.set('city', params.city);
  if (params.internship_type) searchParams.set('internship_type', params.internship_type);
  if (params.has_referral) searchParams.set('has_referral', 'true');
  if (params.industry) searchParams.set('industry', params.industry);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));

  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () =>
      fetchApi<{
        jobs: unknown[];
        page: number;
        pageSize: number;
        total: number;
        hasNextPage: boolean;
      }>(`/api/jobs?${searchParams.toString()}`),
  });
}

// ============================================================
// 推荐榜单 API
// ============================================================
export interface RecommendationsParams {
  tier?: string;
  has_referral?: boolean;
  fame_weight?: number;
  match_weight?: number;
  city_weight?: number;
  deadline_weight?: number;
  conversion_weight?: number;
  freshness_weight?: number;
}

export function useRecommendations(params: RecommendationsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.tier) searchParams.set('tier', params.tier);
  if (params.has_referral) searchParams.set('has_referral', 'true');
  if (params.fame_weight !== undefined) searchParams.set('fame_weight', String(params.fame_weight));
  if (params.match_weight !== undefined) searchParams.set('match_weight', String(params.match_weight));
  if (params.city_weight !== undefined) searchParams.set('city_weight', String(params.city_weight));
  if (params.deadline_weight !== undefined) searchParams.set('deadline_weight', String(params.deadline_weight));
  if (params.conversion_weight !== undefined) searchParams.set('conversion_weight', String(params.conversion_weight));
  if (params.freshness_weight !== undefined) searchParams.set('freshness_weight', String(params.freshness_weight));

  return useQuery({
    queryKey: ['recommendations', params],
    queryFn: () =>
      fetchApi<{
        items: unknown[];
        tier: string;
        weights: Record<string, number>;
        preset: string | null;
      }>(`/api/recommendations?${searchParams.toString()}`),
  });
}

// ============================================================
// 公司 API
// ============================================================
export interface CompaniesParams {
  keyword?: string;
  industry?: string;
  size?: string;
  page?: number;
  page_size?: number;
}

export function useCompanies(params: CompaniesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.keyword) searchParams.set('keyword', params.keyword);
  if (params.industry) searchParams.set('industry', params.industry);
  if (params.size) searchParams.set('size', params.size);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));

  return useQuery({
    queryKey: ['companies', params],
    queryFn: () =>
      fetchApi<{
        companies: unknown[];
        page: number;
        pageSize: number;
        total: number;
        hasNextPage: boolean;
      }>(`/api/companies?${searchParams.toString()}`),
  });
}

export function useCompany(id: number) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () =>
      fetchApi<{
        company: unknown;
        stats: Record<string, number>;
        recentJobs: unknown[];
      }>(`/api/companies/${id}`),
    enabled: !!id,
  });
}

// ============================================================
// 收藏 API
// ============================================================
export function useFavorites(status?: string) {
  const searchParams = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['favorites', status],
    queryFn: () =>
      fetchApi<{
        items: unknown[];
        total: number;
      }>(`/api/favorites${searchParams}`),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) =>
      fetchApi<{ success: boolean; is_favorited: boolean }>(
        '/api/favorites',
        {
          method: 'POST',
          body: JSON.stringify({ job_id: jobId }),
        },
      ),
    onSuccess: () => {
      // 刷新收藏列表
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

// ============================================================
// 投递记录 API
// ============================================================
export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: () =>
      fetchApi<{
        items: unknown[];
        total: number;
        pending: number;
        interview: number;
        offer: number;
        rejected: number;
      }>('/api/applications'),
  });
}

// ============================================================
// 用户 API
// ============================================================
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () =>
      fetchApi<{
        user: {
          id: number;
          email: string;
          nickname: string | null;
          role: string;
          email_verified: boolean;
        };
      }>('/api/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      fetchApi<{ success: boolean; redirectTo?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchApi<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      email,
      password,
      nickname,
    }: {
      email: string;
      password: string;
      nickname?: string;
    }) =>
      fetchApi<{ success: boolean; redirectTo?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

// ============================================================
// Profile API
// ============================================================
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () =>
      fetchApi<{
        profile: {
          id: number;
          school: string | null;
          major: string | null;
          graduation_year: number | null;
          target_cities: string[];
          internship_types: string[];
        };
      }>('/api/profile'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchApi<{ success: boolean }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

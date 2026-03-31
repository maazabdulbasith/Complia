import type { NoticeType } from "../types/notice";

const API_BASE_RAW = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api/v1";
const API_BASE = API_BASE_RAW.endsWith("/api/v1") ? API_BASE_RAW : `${API_BASE_RAW}/api/v1`;
const ACCESS_TOKEN_KEY = "complia_token";
const REFRESH_TOKEN_KEY = "complia_refresh_token";

type PaginatedNoticeResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: NoticeType[];
};

export type SavedNotice = {
  id: number;
  notice: NoticeType;
  created_at: string;
};

type PaginatedSavedNoticeResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: SavedNotice[];
};

export type CAHelpRequestPayload = {
  notice_code?: string;
  name: string;
  email: string;
  phone_number?: string;
  message?: string;
};

export type AssistedIntentPayload = {
  notice_id?: number;
  offer_key?: string;
  name?: string;
  email?: string;
  phone_number?: string;
  notice_code_snapshot?: string;
  severity_snapshot?: string;
  source_path?: string;
  experiment_key?: string;
  experiment_variant?: string;
  metadata?: Record<string, unknown>;
};

export type ExperimentExposurePayload = {
  session_id: string;
  experiment_key: string;
  variant: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

export type AssistedOffer = {
  key: string;
  name: string;
  description: string;
  target_severity: "all" | "low" | "medium" | "high";
  config?: Record<string, unknown>;
  is_active: boolean;
};

export type AssistedOfferConfig = {
  enabled: boolean;
  offer: AssistedOffer | null;
};

export type AdminMetrics = {
  total_visitors: number;
  visitors_today: number;
  live_visitors: number;
  most_searched_notice: string;
  most_searched_notice_count: number;
  total_searches: number;
  total_notice_views: number;
  ca_help_submissions: number;
};

export type AdminFunnel = {
  window: "7d" | "30d";
  from: string;
  to: string;
  steps: Record<string, number>;
  conversion_rates: Record<string, number>;
};

export type WeeklyKpiSnapshot = {
  week_start: string;
  week_end: string;
  metrics: Record<string, number>;
  created_at: string;
};

export type AdminKpis = {
  window: "7d" | "30d";
  current: Record<string, number>;
  weekly_snapshots: WeeklyKpiSnapshot[];
};

export type AdminCARequest = {
  id: number;
  notice_code: string;
  name: string;
  email: string;
  phone_number: string;
  message: string;
  status: "new" | "triaged" | "contacted" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  assigned_to_email: string;
  internal_notes: string;
  contacted_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminFeedbackItem = {
  id: number;
  notice: number;
  notice_code: string;
  notice_title: string;
  is_helpful: boolean;
  comments: string | null;
  status: "new" | "reviewed" | "resolved";
  internal_notes: string;
  reviewed_at: string | null;
  created_at: string;
};

export type AdminAssistedIntent = {
  id: number;
  notice: number | null;
  notice_title: string;
  name: string;
  email: string;
  phone_number: string;
  notice_code_snapshot: string;
  severity_snapshot: string;
  source_path: string;
  experiment_key: string;
  experiment_variant: string;
  metadata: Record<string, unknown>;
  status: "new" | "triaged" | "contacted" | "won" | "lost" | "closed";
  operator_notes: string;
  contacted_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminNoticeItem = {
  id: number;
  code: string;
  slug: string;
  title: string;
  severity: "low" | "medium" | "high";
  is_active: boolean;
  verified_by: string | null;
  verified_at: string | null;
  meta_title: string;
  meta_description: string;
  updated_at: string;
  is_stale: boolean;
  trigger_keywords: string[];
};

export type ParserExtraction = {
  id: number;
  deadline_date: string | null;
  legal_section: string;
  amount_claimed: string | null;
  notice_type_detected: string;
  confidence: number;
  normalized_payload: Record<string, unknown>;
  raw_text_excerpt: string;
  review_status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ParserJob = {
  id: number;
  notice: number | null;
  notice_code: string;
  original_filename: string;
  mime_type?: string;
  status: "queued" | "completed" | "review_required" | "failed";
  confidence: number;
  is_private_beta: boolean;
  delete_after: string;
  processed_at: string | null;
  error_message: string;
  review_notes: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  extraction: ParserExtraction;
};

export type ParserBenchmarkRun = {
  id: number;
  sample_count: number;
  notice_precision: number;
  notice_recall: number;
  section_precision: number;
  section_recall: number;
  amount_precision: number;
  amount_recall: number;
  overall_f1: number;
  metrics: Record<string, unknown>;
  generated_by: number | null;
  generated_by_email?: string;
  created_at: string;
};

export type PaymentPlan = {
  key: string;
  name: string;
  description: string;
  amount_paise: number;
  amount_inr: number;
  currency: string;
  credits: number;
  is_active: boolean;
  is_default: boolean;
};

export type PaymentOrder = {
  id: number;
  order_id: string;
  status: "created" | "payment_pending" | "paid" | "failed" | "cancelled";
  plan_key: string;
  amount_paise: number;
  amount_inr: number;
  currency: string;
  credits: number;
  provider: string;
  provider_order_id: string;
  payment_session_id: string;
  checkout_url: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserEntitlements = {
  parser_credits: number;
  lifetime_purchased_credits: number;
  lifetime_consumed_credits: number;
  updated_at: string;
};

export type PaymentTestConfirmRequest = {
  order_id?: string;
  plan_key?: string;
  user_email?: string;
  provider_payment_id?: string;
};

export type PaymentTestConfirmResponse = {
  status: "ok";
  duplicate: boolean;
  order: PaymentOrder;
};

type ApiErrorEnvelope = {
  status?: string;
  message?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, unknown>;
  details?: unknown;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: Record<string, unknown>;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, unknown>,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.details = details;
  }
}

function isPaginatedNoticeResponse(data: unknown): data is PaginatedNoticeResponse {
  return Boolean(data && typeof data === "object" && "results" in data && Array.isArray((data as PaginatedNoticeResponse).results));
}

function isPaginatedSavedNoticeResponse(data: unknown): data is PaginatedSavedNoticeResponse {
  return Boolean(data && typeof data === "object" && "results" in data && Array.isArray((data as PaginatedSavedNoticeResponse).results));
}

function isPaginatedResponse<T>(data: unknown): data is PaginatedResponse<T> {
  return Boolean(data && typeof data === "object" && "results" in data && Array.isArray((data as PaginatedResponse<T>).results));
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseApiErrorEnvelope(response: Response): Promise<ApiErrorEnvelope | null> {
  try {
    const data = (await response.clone().json()) as ApiErrorEnvelope;
    if (data && typeof data === "object") {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function deriveMessageFromEnvelope(envelope: ApiErrorEnvelope | null, fallback: string): string {
  if (!envelope) {
    return fallback;
  }
  if (envelope.message) {
    return envelope.message;
  }
  if (envelope.detail) {
    return envelope.detail;
  }
  if (envelope.errors && typeof envelope.errors === "object") {
    const [firstKey] = Object.keys(envelope.errors);
    const firstValue = firstKey ? envelope.errors[firstKey] : null;
    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return String(firstValue[0]);
    }
    if (typeof firstValue === "string") {
      return firstValue;
    }
  }
  return fallback;
}

async function buildApiClientError(response: Response, fallback: string): Promise<ApiClientError> {
  const envelope = await parseApiErrorEnvelope(response);
  const message = deriveMessageFromEnvelope(envelope, fallback);
  return new ApiClientError(
    message,
    response.status,
    envelope?.code,
    envelope?.errors,
    envelope?.details
  );
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) {
    return normalized;
  }
  const source = new Headers(headers);
  source.forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

function clearStoredAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("user");
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      clearStoredAuth();
      return null;
    }

    const data = (await response.json()) as { access?: string; refresh?: string };
    if (!data.access) {
      clearStoredAuth();
      return null;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    if (data.refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
    }
    return data.access;
  } catch {
    clearStoredAuth();
    return null;
  }
}

async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const baseHeaders = normalizeHeaders(init.headers);
  let response = await fetch(url, {
    ...init,
    headers: {
      ...baseHeaders,
      ...getAuthHeaders(),
    },
  });

  if (response.status !== 401) {
    return response;
  }

  const nextAccessToken = await refreshAccessToken();
  if (!nextAccessToken) {
    return response;
  }

  response = await fetch(url, {
    ...init,
    headers: {
      ...baseHeaders,
      Authorization: `Bearer ${nextAccessToken}`,
    },
  });
  return response;
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const envelope = await parseApiErrorEnvelope(response);
  return deriveMessageFromEnvelope(envelope, fallback);
}

export async function searchNotices(query: string): Promise<NoticeType[]> {
  const url = `${API_BASE}/notices/?search=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch notices"));
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (isPaginatedNoticeResponse(data)) {
    return data.results;
  }
  throw new Error("Unexpected search response format");
}

export async function getNotice(code: string): Promise<NoticeType> {
  const response = await fetch(`${API_BASE}/notices/${code}/`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Notice not found"));
  }
  return response.json();
}

export async function submitFeedback(noticeId: number, isHelpful: boolean, comments?: string) {
  const response = await fetch(`${API_BASE}/feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notice: noticeId, is_helpful: isHelpful, comments }),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to submit feedback"));
  }
  return response.json();
}

export async function getSavedNotices(): Promise<SavedNotice[]> {
  const response = await fetchWithAuth(`${API_BASE}/saved-notices/`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch saved notices"));
  }
  const data = await response.json();
  if (isPaginatedSavedNoticeResponse(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected saved notice response format");
}

export async function saveNotice(noticeId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/saved-notices/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notice_id: noticeId }),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to save notice"));
  }
}

export async function removeSavedNotice(savedNoticeId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/saved-notices/${savedNoticeId}/`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to remove saved notice"));
  }
}

export async function submitCAHelpRequest(payload: CAHelpRequestPayload): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/ca-help/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to submit CA help request"));
  }
}

export async function submitAssistedIntent(payload: AssistedIntentPayload): Promise<AdminAssistedIntent> {
  const response = await fetchWithAuth(`${API_BASE}/assisted-intent/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to submit assisted intent"));
  }
  return response.json();
}

export async function getAssistedOfferConfig(): Promise<AssistedOfferConfig> {
  const response = await fetch(`${API_BASE}/assisted-offer/`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch assisted offer config"));
  }
  return response.json();
}

export async function recordExperimentExposure(payload: ExperimentExposurePayload): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/experiments/exposure/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to record experiment exposure"));
  }
}

export async function uploadParserFile(file: File, noticeCode?: string): Promise<ParserJob> {
  const formData = new FormData();
  formData.append("file", file);
  if (noticeCode) {
    formData.append("notice_code", noticeCode);
  }

  const response = await fetchWithAuth(`${API_BASE}/parser/upload/`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw await buildApiClientError(response, "Failed to upload parser file");
  }
  return response.json();
}

export async function getParserResult(jobId: number): Promise<ParserJob> {
  const response = await fetchWithAuth(`${API_BASE}/parser/results/${jobId}/`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch parser result"));
  }
  return response.json();
}

export async function getPaymentPlans(): Promise<PaymentPlan[]> {
  const response = await fetch(`${API_BASE}/payments/plans/`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) {
    throw await buildApiClientError(response, "Failed to fetch payment plans");
  }
  return response.json();
}

export async function createPaymentOrder(planKey: string): Promise<PaymentOrder> {
  const response = await fetchWithAuth(`${API_BASE}/payments/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_key: planKey }),
  });
  if (!response.ok) {
    throw await buildApiClientError(response, "Failed to create payment order");
  }
  return response.json();
}

export async function getMyEntitlements(): Promise<UserEntitlements> {
  const response = await fetchWithAuth(`${API_BASE}/payments/me/entitlements/`);
  if (!response.ok) {
    throw await buildApiClientError(response, "Failed to fetch entitlements");
  }
  return response.json();
}

export async function confirmTestPayment(payload: PaymentTestConfirmRequest): Promise<PaymentTestConfirmResponse> {
  const response = await fetchWithAuth(`${API_BASE}/payments/test/confirm/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await buildApiClientError(response, "Failed to simulate payment");
  }
  return response.json();
}

export async function sendAnalyticsEvent(payload: {
  event_name: string;
  path?: string;
  metadata?: Record<string, unknown>;
  session_id: string;
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/analytics/events/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Analytics failures should never block user flow.
  }
}

export async function getSuperAdminMetrics(): Promise<AdminMetrics> {
  const response = await fetchWithAuth(`${API_BASE}/admin/metrics/`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch admin metrics"));
  }
  return response.json();
}

export async function getSuperAdminFunnel(window: "7d" | "30d" = "7d"): Promise<AdminFunnel> {
  const response = await fetchWithAuth(`${API_BASE}/admin/funnel/?window=${window}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch funnel metrics"));
  }
  return response.json();
}

export async function getSuperAdminKpis(window: "7d" | "30d" = "7d"): Promise<AdminKpis> {
  const response = await fetchWithAuth(`${API_BASE}/admin/kpis/?window=${window}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch KPI metrics"));
  }
  return response.json();
}

export async function getAdminCARequests(status?: string): Promise<AdminCARequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetchWithAuth(`${API_BASE}/admin/ca-requests/${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch CA requests"));
  }
  const data = await response.json();
  if (isPaginatedResponse<AdminCARequest>(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected admin CA requests response format");
}

export async function updateAdminCARequest(
  requestId: number,
  payload: Partial<Pick<AdminCARequest, "status" | "priority" | "assigned_to_email" | "internal_notes">>
): Promise<AdminCARequest> {
  const response = await fetchWithAuth(`${API_BASE}/admin/ca-requests/${requestId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to update CA request"));
  }
  return response.json();
}

export async function getAdminFeedbackItems(status?: string): Promise<AdminFeedbackItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetchWithAuth(`${API_BASE}/admin/feedback/${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch feedback"));
  }
  const data = await response.json();
  if (isPaginatedResponse<AdminFeedbackItem>(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected admin feedback response format");
}

export async function updateAdminFeedbackItem(
  feedbackId: number,
  payload: Partial<Pick<AdminFeedbackItem, "status" | "internal_notes">>
): Promise<AdminFeedbackItem> {
  const response = await fetchWithAuth(`${API_BASE}/admin/feedback/${feedbackId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to update feedback item"));
  }
  return response.json();
}

export async function getAdminAssistedIntents(status?: string): Promise<AdminAssistedIntent[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetchWithAuth(`${API_BASE}/admin/assisted-intents/${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch assisted intents"));
  }
  const data = await response.json();
  if (isPaginatedResponse<AdminAssistedIntent>(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected assisted intents response format");
}

export async function updateAdminAssistedIntent(
  intentId: number,
  payload: Partial<Pick<AdminAssistedIntent, "status" | "operator_notes">>
): Promise<AdminAssistedIntent> {
  const response = await fetchWithAuth(`${API_BASE}/admin/assisted-intents/${intentId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to update assisted intent"));
  }
  return response.json();
}

export async function getAdminNoticeItems(status?: "stale" | "unverified"): Promise<AdminNoticeItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetchWithAuth(`${API_BASE}/admin/notices/${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch notice QA items"));
  }
  const data = await response.json();
  if (isPaginatedResponse<AdminNoticeItem>(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected notice QA response format");
}

export async function updateAdminNoticeItem(
  noticeId: number,
  payload: Partial<Pick<AdminNoticeItem, "is_active" | "verified_by" | "verified_at" | "meta_title" | "meta_description">>
): Promise<AdminNoticeItem> {
  const response = await fetchWithAuth(`${API_BASE}/admin/notices/${noticeId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to update notice QA item"));
  }
  return response.json();
}

export async function getAdminParserJobs(status?: string): Promise<ParserJob[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetchWithAuth(`${API_BASE}/admin/parser-jobs/${query}`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch parser jobs"));
  }
  const data = await response.json();
  if (isPaginatedResponse<ParserJob>(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected parser jobs response format");
}

export async function updateAdminParserJob(
  parserJobId: number,
  payload: Partial<Pick<ParserJob, "status" | "review_notes">> & { extraction_review_status?: "pending" | "approved" | "rejected" }
): Promise<ParserJob> {
  const response = await fetchWithAuth(`${API_BASE}/admin/parser-jobs/${parserJobId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to update parser job"));
  }
  return response.json();
}

export async function getAdminParserBenchmarks(): Promise<ParserBenchmarkRun[]> {
  const response = await fetchWithAuth(`${API_BASE}/admin/parser-benchmarks/`);
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch parser benchmark runs"));
  }
  const data = await response.json();
  if (isPaginatedResponse<ParserBenchmarkRun>(data)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Unexpected parser benchmark response format");
}

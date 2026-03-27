import type { NoticeType } from "../types/notice";

const API_BASE_RAW = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api/v1";
const API_BASE = API_BASE_RAW.endsWith("/api/v1") ? API_BASE_RAW : `${API_BASE_RAW}/api/v1`;

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

type ApiErrorEnvelope = {
    status?: string;
    message?: string;
    code?: string;
    errors?: Record<string, unknown>;
    details?: unknown;
};

function isPaginatedNoticeResponse(data: unknown): data is PaginatedNoticeResponse {
    return Boolean(
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray((data as PaginatedNoticeResponse).results)
    );
}

function isPaginatedSavedNoticeResponse(data: unknown): data is PaginatedSavedNoticeResponse {
    return Boolean(
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray((data as PaginatedSavedNoticeResponse).results)
    );
}

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("complia_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const data = (await response.json()) as ApiErrorEnvelope;
        if (data.message) {
            return data.message;
        }

        if (data.errors && typeof data.errors === "object") {
            const [firstKey] = Object.keys(data.errors);
            const firstValue = firstKey ? data.errors[firstKey] : null;
            if (Array.isArray(firstValue) && firstValue.length > 0) {
                return String(firstValue[0]);
            }
            if (typeof firstValue === "string") {
                return firstValue;
            }
        }
    } catch {
        // Fall back to generic message below.
    }

    return fallback;
}

export async function searchNotices(query: string): Promise<NoticeType[]> {
    const url = `${API_BASE}/notices/?search=${encodeURIComponent(query)}`;
    console.log(`Fetching notices from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to fetch notices: ${response.statusText}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
            console.log(`Found ${data.length} results`);
            return data;
        }
        if (isPaginatedNoticeResponse(data)) {
            console.log(`Found ${data.count} results`);
            return data.results;
        }
        throw new Error("Unexpected search response format");
    } catch (error) {
        console.error("Network error connecting to API:", error);
        throw error;
    }
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
    const response = await fetch(`${API_BASE}/saved-notices/`, {
        headers: {
            ...getAuthHeaders(),
        },
    });
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
    const response = await fetch(`${API_BASE}/saved-notices/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ notice_id: noticeId }),
    });
    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Failed to save notice"));
    }
}

export async function removeSavedNotice(savedNoticeId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/saved-notices/${savedNoticeId}/`, {
        method: "DELETE",
        headers: {
            ...getAuthHeaders(),
        },
    });
    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Failed to remove saved notice"));
    }
}

export async function submitCAHelpRequest(payload: CAHelpRequestPayload): Promise<void> {
    const response = await fetch(`${API_BASE}/ca-help/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Failed to submit CA help request"));
    }
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
    const response = await fetch(`${API_BASE}/admin/metrics/`, {
        headers: {
            ...getAuthHeaders(),
        },
    });
    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Failed to fetch admin metrics"));
    }
    return response.json();
}

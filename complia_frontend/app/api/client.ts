import type { NoticeType } from "../types/notice";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

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
        console.log(`Found ${data.length} results`);
        return data;
    } catch (error) {
        console.error("Network error connecting to API:", error);
        throw error;
    }
}

export async function getNotice(code: string): Promise<NoticeType> {
    const response = await fetch(`${API_BASE}/notices/${code}/`);
    if (!response.ok) {
        throw new Error("Notice not found");
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
        throw new Error("Failed to submit feedback");
    }
    return response.json();
}

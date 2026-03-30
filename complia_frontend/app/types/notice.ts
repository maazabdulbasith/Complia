export interface NoticeType {
    id: number;
    code: string;
    slug?: string;
    title: string;
    summary: string;
    detailed_explanation: string;
    why_received: string;
    common_mistakes: string;
    source_section: string;
    consequences_of_ignoring: string;
    next_steps: string;
    severity: 'low' | 'medium' | 'high';
    triggers: string[];
    verified_by?: string;
    verified_at?: string;
    meta_title?: string;
    meta_description?: string;
    updated_at: string;
}

export interface SearchResponse {
    results: NoticeType[];
}

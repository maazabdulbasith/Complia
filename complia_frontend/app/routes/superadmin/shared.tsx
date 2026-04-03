import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useOutletContext, Link } from "react-router";

import type {
  AdminAssistedIntent,
  AdminCARequest,
  AdminCsvReportKey,
  AdminFeedbackItem,
  AdminFunnel,
  AdminKpis,
  AdminMetrics,
  AdminNoticeItem,
  AdminPaymentOrder,
  CAPanelProfile,
  ParserBenchmarkRun,
  ParserJob,
} from "../../api/client";

export function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
      <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

export function PaymentStatusPill({ status }: { status: AdminPaymentOrder["admin_status"] }) {
  const className =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "failed"
        ? "bg-rose-100 text-rose-700"
        : status === "abandoned"
          ? "bg-amber-100 text-amber-800"
          : "bg-sky-100 text-sky-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {status}
    </span>
  );
}

export type AdminSectionNavItem = {
  id: string;
  label: string;
  to: string;
  count?: number;
};

export type ActionQueueItem = {
  id: string;
  label: string;
  count: number;
  tone: string;
  to: string;
};

export type SuperAdminOutletContext = {
  user: { email?: string; user_type?: string } | null;
  metrics: AdminMetrics;
  funnel: AdminFunnel | null;
  kpis: AdminKpis | null;
  windowSize: "7d" | "30d";
  setWindowSize: Dispatch<SetStateAction<"7d" | "30d">>;
  caRequests: AdminCARequest[];
  caPanel: CAPanelProfile[];
  feedbackItems: AdminFeedbackItem[];
  assistedIntents: AdminAssistedIntent[];
  paymentOrders: AdminPaymentOrder[];
  noticeQaItems: AdminNoticeItem[];
  parserJobs: ParserJob[];
  parserBenchmarkRuns: ParserBenchmarkRun[];
  savingKey: string | null;
  exportingReport: AdminCsvReportKey | null;
  caStatusFilter: string;
  setCAStatusFilter: Dispatch<SetStateAction<string>>;
  feedbackStatusFilter: string;
  setFeedbackStatusFilter: Dispatch<SetStateAction<string>>;
  assistedStatusFilter: string;
  setAssistedStatusFilter: Dispatch<SetStateAction<string>>;
  paymentStatusFilter: string;
  setPaymentStatusFilter: Dispatch<SetStateAction<string>>;
  noticeQaFilter: "" | "stale" | "unverified" | "needs_review" | "missing_source" | "trusted" | "watch" | "source_error";
  setNoticeQaFilter: Dispatch<
    SetStateAction<"" | "stale" | "unverified" | "needs_review" | "missing_source" | "trusted" | "watch" | "source_error">
  >;
  parserStatusFilter: string;
  setParserStatusFilter: Dispatch<SetStateAction<string>>;
  paymentStatusCounts: { initiated: number; abandoned: number; failed: number; success: number };
  caPanelStatusFilter: "" | "active" | "inactive";
  setCAPanelStatusFilter: Dispatch<SetStateAction<"" | "active" | "inactive">>;
  actionQueueItems: ActionQueueItem[];
  handleCAPanelCreate: (payload: {
    display_name: string;
    email: string;
    phone_number: string;
    icai_membership_number: string;
    city: string;
    specialties: string[];
    turnaround_sla_hours: number;
    is_active: boolean;
    notes?: string;
  }) => Promise<void>;
  handleCAPanelUpdate: (
    profileId: number,
    payload: Partial<{
      display_name: string;
      email: string;
      phone_number: string;
      icai_membership_number: string;
      city: string;
      specialties: string[];
      turnaround_sla_hours: number;
      is_active: boolean;
      notes?: string;
    }>
  ) => Promise<void>;
  handleCAUpdate: (
    requestId: number,
    payload: Partial<Pick<AdminCARequest, "status" | "priority" | "assigned_ca" | "assigned_to_email" | "internal_notes">>
  ) => Promise<void>;
  handleFeedbackUpdate: (
    feedbackId: number,
    payload: Partial<Pick<AdminFeedbackItem, "status" | "internal_notes">>
  ) => Promise<void>;
  handleAssistedIntentUpdate: (
    intentId: number,
    payload: Partial<Pick<AdminAssistedIntent, "status" | "operator_notes">>
  ) => Promise<void>;
  handleNoticeQaUpdate: (
    noticeId: number,
    payload: Partial<
      Pick<
        AdminNoticeItem,
        "is_active" | "verified_by" | "verified_at" | "meta_title" | "meta_description" | "source_url" | "review_status"
      >
    >
  ) => Promise<void>;
  handleParserJobUpdate: (
    parserJobId: number,
    payload: Partial<Pick<ParserJob, "status" | "review_notes">> & { extraction_review_status?: "pending" | "approved" | "rejected" }
  ) => Promise<void>;
  handleCsvExport: (reportKey: AdminCsvReportKey, statusFilter?: string) => Promise<void>;
  handleGrantCredits: (orderId: string) => Promise<void>;
};

export function useSuperAdmin() {
  return useOutletContext<SuperAdminOutletContext>();
}

export function SectionHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h2 className="text-xl font-bold text-slate-900">
        {title}
        {typeof count === "number" && (
          <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {count}
          </span>
        )}
      </h2>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
      {children}
    </p>
  );
}

export function AdminPageIntro({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">{description}</p>
        </div>
        {badge ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function OverviewActionLink({ item }: { item: ActionQueueItem }) {
  return (
    <Link
      to={item.to}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${item.tone}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">{item.label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{item.count}</p>
      <p className="mt-2 text-xs font-semibold opacity-80">Open section</p>
    </Link>
  );
}

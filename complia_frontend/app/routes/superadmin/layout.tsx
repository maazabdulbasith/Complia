import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";

import {
  createAdminCAPanelProfile,
  downloadAdminCsvReport,
  getAdminCAPanel,
  getAdminAssistedIntents,
  getAdminCARequests,
  getAdminFeedbackItems,
  getAdminNoticeItems,
  getAdminPaymentOrders,
  getAdminParserBenchmarks,
  getAdminParserJobs,
  getSuperAdminFunnel,
  getSuperAdminKpis,
  getSuperAdminMetrics,
  grantAdminPaymentCredits,
  updateAdminCAPanelProfile,
  updateAdminAssistedIntent,
  updateAdminCARequest,
  updateAdminFeedbackItem,
  updateAdminNoticeItem,
  updateAdminParserJob,
} from "../../api/client";
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
import BrandMark from "../../lib/brand_mark";
import { trackEvent } from "../../lib/analytics";
import type { Route } from "./+types/layout";
import type { ActionQueueItem, AdminSectionNavItem, SuperAdminOutletContext } from "./shared";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | SuperAdmin" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [windowSize, setWindowSize] = useState<"7d" | "30d">("7d");
  const [caRequests, setCARequests] = useState<AdminCARequest[]>([]);
  const [caPanel, setCAPanel] = useState<CAPanelProfile[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackItem[]>([]);
  const [assistedIntents, setAssistedIntents] = useState<AdminAssistedIntent[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<AdminPaymentOrder[]>([]);
  const [noticeQaItems, setNoticeQaItems] = useState<AdminNoticeItem[]>([]);
  const [parserJobs, setParserJobs] = useState<ParserJob[]>([]);
  const [parserBenchmarkRuns, setParserBenchmarkRuns] = useState<ParserBenchmarkRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [caStatusFilter, setCAStatusFilter] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState("");
  const [caPanelStatusFilter, setCAPanelStatusFilter] = useState<"" | "active" | "inactive">("");
  const [assistedStatusFilter, setAssistedStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [noticeQaFilter, setNoticeQaFilter] = useState<
    "" | "stale" | "unverified" | "needs_review" | "missing_source" | "trusted" | "watch" | "source_error"
  >("");
  const [parserStatusFilter, setParserStatusFilter] = useState("");
  const [exportingReport, setExportingReport] = useState<AdminCsvReportKey | null>(null);

  const user = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { email?: string; user_type?: string };
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  }, []);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError(null);
    setAccessDenied(false);
    try {
      const [
        metricData,
        funnelData,
        kpiData,
        caData,
        caPanelData,
        feedbackData,
        assistedData,
        paymentData,
        noticeQaData,
        parserData,
        parserBenchmarkData,
      ] = await Promise.all([
        getSuperAdminMetrics(),
        getSuperAdminFunnel(windowSize),
        getSuperAdminKpis(windowSize),
        getAdminCARequests(caStatusFilter || undefined),
        getAdminCAPanel(),
        getAdminFeedbackItems(feedbackStatusFilter || undefined),
        getAdminAssistedIntents(assistedStatusFilter || undefined),
        getAdminPaymentOrders(paymentStatusFilter || undefined),
        getAdminNoticeItems(noticeQaFilter || undefined),
        getAdminParserJobs(parserStatusFilter || undefined),
        getAdminParserBenchmarks(),
      ]);
      setMetrics(metricData);
      setFunnel(funnelData);
      setKpis(kpiData);
      setCARequests(caData);
      setCAPanel(caPanelData);
      setFeedbackItems(feedbackData);
      setAssistedIntents(assistedData);
      setPaymentOrders(paymentData);
      setNoticeQaItems(noticeQaData);
      setParserJobs(parserData);
      setParserBenchmarkRuns(parserBenchmarkData);
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "";
      const isAccessError = /access denied|admin|permission|forbidden|401|403|sign in|login|unauthorized/i.test(message);
      setAccessDenied(isAccessError);
      setError(
        isAccessError
          ? "This account cannot access SuperAdmin. Sign in with an admin account."
          : "Admin data is unavailable right now. Please refresh and retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("complia_token")) {
      navigate("/login?next=/superadmin");
      return;
    }
    void fetchAll();
    trackEvent("admin_dashboard_viewed");
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    void fetchAll(true);
  }, [windowSize, caStatusFilter, feedbackStatusFilter, assistedStatusFilter, paymentStatusFilter, noticeQaFilter, parserStatusFilter]);

  useEffect(() => {
    if (!metrics) return;
    const intervalId = window.setInterval(() => {
      trackEvent("admin_dashboard_heartbeat");
      void fetchAll(true);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [metrics, windowSize, caStatusFilter, feedbackStatusFilter, assistedStatusFilter, paymentStatusFilter, noticeQaFilter, parserStatusFilter]);

  const handleCAUpdate: SuperAdminOutletContext["handleCAUpdate"] = async (requestId, payload) => {
    const key = `ca-${requestId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminCARequest(requestId, payload);
      setCARequests((prev) => prev.map((item) => (item.id === requestId ? updated : item)));
      trackEvent("admin_ca_request_updated", { request_id: requestId, status: updated.status });
    } catch {
      setError("Failed to update CA request. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleCAPanelCreate: SuperAdminOutletContext["handleCAPanelCreate"] = async (payload) => {
    setSavingKey("ca-panel-create");
    try {
      const created = await createAdminCAPanelProfile(payload);
      setCAPanel((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      trackEvent("admin_ca_panel_updated", { action: "created", profile_id: created.id });
    } catch {
      setError("Failed to create CA panel profile. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleCAPanelUpdate: SuperAdminOutletContext["handleCAPanelUpdate"] = async (profileId, payload) => {
    const key = `ca-panel-${profileId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminCAPanelProfile(profileId, payload);
      setCAPanel((prev) => prev.map((item) => (item.id === profileId ? updated : item)).sort((a, b) => a.display_name.localeCompare(b.display_name)));
      trackEvent("admin_ca_panel_updated", { action: "updated", profile_id: profileId });
    } catch {
      setError("Failed to update CA panel profile. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleFeedbackUpdate: SuperAdminOutletContext["handleFeedbackUpdate"] = async (feedbackId, payload) => {
    const key = `fb-${feedbackId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminFeedbackItem(feedbackId, payload);
      setFeedbackItems((prev) => prev.map((item) => (item.id === feedbackId ? updated : item)));
      trackEvent("admin_feedback_updated", { feedback_id: feedbackId, status: updated.status });
    } catch {
      setError("Failed to update feedback. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleAssistedIntentUpdate: SuperAdminOutletContext["handleAssistedIntentUpdate"] = async (intentId, payload) => {
    const key = `intent-${intentId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminAssistedIntent(intentId, payload);
      setAssistedIntents((prev) => prev.map((item) => (item.id === intentId ? updated : item)));
      trackEvent("admin_ca_request_updated", { entity: "assisted_intent", intent_id: intentId, status: updated.status });
    } catch {
      setError("Failed to update assisted intent. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleNoticeQaUpdate: SuperAdminOutletContext["handleNoticeQaUpdate"] = async (noticeId, payload) => {
    const key = `notice-${noticeId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminNoticeItem(noticeId, payload);
      setNoticeQaItems((prev) => prev.map((item) => (item.id === noticeId ? updated : item)));
      trackEvent("admin_feedback_updated", { entity: "notice_qa", notice_id: noticeId });
    } catch {
      setError("Failed to update notice metadata. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleParserJobUpdate: SuperAdminOutletContext["handleParserJobUpdate"] = async (parserJobId, payload) => {
    const key = `parser-${parserJobId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminParserJob(parserJobId, payload);
      setParserJobs((prev) => prev.map((item) => (item.id === parserJobId ? updated : item)));
      trackEvent("admin_feedback_updated", { entity: "parser_job", parser_job_id: parserJobId, status: updated.status });
    } catch {
      setError("Failed to update parser job. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleCsvExport: SuperAdminOutletContext["handleCsvExport"] = async (reportKey, statusFilter) => {
    setExportingReport(reportKey);
    setError(null);
    try {
      await downloadAdminCsvReport(reportKey, statusFilter);
    } catch {
      setError("Failed to export CSV. Please retry.");
    } finally {
      setExportingReport(null);
    }
  };

  const handleGrantCredits: SuperAdminOutletContext["handleGrantCredits"] = async (orderId) => {
    setSavingKey(`payment-${orderId}`);
    setError(null);
    try {
      await grantAdminPaymentCredits(orderId);
      await fetchAll(true);
    } catch {
      setError("Failed to grant credits for this order. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const paymentStatusCounts = useMemo(() => {
    return paymentOrders.reduce(
      (acc, order) => {
        acc[order.admin_status] += 1;
        return acc;
      },
      { initiated: 0, abandoned: 0, failed: 0, success: 0 }
    );
  }, [paymentOrders]);

  const actionQueueItems = useMemo<ActionQueueItem[]>(() => {
    const parserReviewCount = parserJobs.filter((job) => job.status === "review_required" || job.extraction?.review_status === "pending").length;
    const readyToAssignCount = caRequests.filter((item) => item.consent_to_share_with_ca && ["new", "triaged"].includes(item.status)).length;
    const newFeedbackCount = feedbackItems.filter((item) => item.status === "new").length;
    const newIntentCount = assistedIntents.filter((item) => item.status === "new").length;
    const paymentAttentionCount = paymentStatusCounts.initiated + paymentStatusCounts.abandoned + paymentStatusCounts.failed;
    return [
      { id: "payments-open", label: "Payments needing attention", count: paymentAttentionCount, tone: "border-indigo-200 bg-indigo-50 text-indigo-900", to: "/superadmin/payments" },
      { id: "parser-review", label: "Parser reviews pending", count: parserReviewCount, tone: "border-amber-200 bg-amber-50 text-amber-900", to: "/superadmin/parser-queue" },
      { id: "assisted-new", label: "New assisted intents", count: newIntentCount, tone: "border-indigo-200 bg-indigo-50 text-indigo-900", to: "/superadmin/assisted-intents" },
      { id: "ca-new", label: "CA cases ready to assign", count: readyToAssignCount, tone: "border-indigo-200 bg-indigo-50 text-indigo-900", to: "/superadmin/ca-requests" },
      { id: "feedback-new", label: "New feedback items", count: newFeedbackCount, tone: "border-rose-200 bg-rose-50 text-rose-900", to: "/superadmin/feedback" },
    ];
  }, [assistedIntents, caRequests, feedbackItems, parserJobs, paymentStatusCounts]);

  const triageLinks = useMemo(
    () => [
      {
        id: "notice-review",
        label: "Notice review needed",
        count: noticeQaItems.filter((item) => item.review_status === "needs_review").length,
        to: "/superadmin/notice-qa?status=needs_review",
      },
      {
        id: "source-missing",
        label: "Missing source URLs",
        count: noticeQaItems.filter((item) => !item.source_url).length,
        to: "/superadmin/notice-qa?status=missing_source",
      },
      {
        id: "ca-panel-inactive",
        label: "Inactive CAs",
        count: caPanel.filter((item) => !item.is_active).length,
        to: "/superadmin/ca-panel?status=inactive",
      },
    ],
    [caPanel, noticeQaItems]
  );

  const sectionNavItems = useMemo<AdminSectionNavItem[]>(() => [
    { id: "overview", label: "Overview", to: "/superadmin" },
    { id: "payments", label: "Payments", to: "/superadmin/payments", count: paymentOrders.length },
    { id: "assisted-intents", label: "Assisted Intents", to: "/superadmin/assisted-intents", count: assistedIntents.length },
    { id: "notice-qa", label: "Notice QA", to: "/superadmin/notice-qa", count: noticeQaItems.length },
    { id: "parser-queue", label: "Parser Queue", to: "/superadmin/parser-queue", count: parserJobs.length },
    { id: "ca-requests", label: "CA Requests", to: "/superadmin/ca-requests", count: caRequests.length },
    { id: "ca-panel", label: "CA Panel", to: "/superadmin/ca-panel", count: caPanel.length },
    { id: "feedback", label: "Feedback", to: "/superadmin/feedback", count: feedbackItems.length },
  ], [assistedIntents.length, caPanel.length, caRequests.length, feedbackItems.length, noticeQaItems.length, parserJobs.length, paymentOrders.length]);

  const outletContext: SuperAdminOutletContext | null = metrics
    ? {
        user,
        metrics,
        funnel,
        kpis,
        windowSize,
        setWindowSize,
        caRequests,
        caPanel,
        feedbackItems,
        assistedIntents,
        paymentOrders,
        noticeQaItems,
        parserJobs,
        parserBenchmarkRuns,
        savingKey,
        exportingReport,
        caStatusFilter,
        setCAStatusFilter,
        feedbackStatusFilter,
        setFeedbackStatusFilter,
        assistedStatusFilter,
        setAssistedStatusFilter,
        paymentStatusFilter,
        setPaymentStatusFilter,
        noticeQaFilter,
        setNoticeQaFilter,
        parserStatusFilter,
        setParserStatusFilter,
        paymentStatusCounts,
        caPanelStatusFilter,
        setCAPanelStatusFilter,
        actionQueueItems,
        handleCAPanelCreate,
        handleCAPanelUpdate,
        handleCAUpdate,
        handleFeedbackUpdate,
        handleAssistedIntentUpdate,
        handleNoticeQaUpdate,
        handleParserJobUpdate,
        handleCsvExport,
        handleGrantCredits,
      }
    : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-100 via-indigo-50 to-indigo-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandMark to="/" imageClassName="h-9 w-auto" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Complia Operations</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">SuperAdmin Command Center</h1>
            <p className="mt-2 text-slate-600">Multi-page operations workspace for product, payments, parser, and case handling.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link to="/" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600">
              Back to product
            </Link>
            <button
              onClick={() => void fetchAll(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/60 bg-white/70 p-8 text-slate-600">Loading live business metrics...</div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-700">
            <p className="font-semibold">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {accessDenied ? (
                <Link to="/login?next=/superadmin" className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
                  Sign in as admin
                </Link>
              ) : (
                <button type="button" onClick={() => void fetchAll(true)} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
                  Retry
                </button>
              )}
              <Link to="/" className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300">
                Back to product
              </Link>
            </div>
          </div>
        ) : metrics && outletContext ? (
          <>
            <div className="sticky top-2 z-20 mb-4 -mx-1 overflow-x-auto pb-1 lg:hidden">
              <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-sm backdrop-blur">
                {sectionNavItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.to === "/superadmin"}
                    className={({ isActive }) =>
                      `shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">
                <nav className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm backdrop-blur xl:max-h-[calc(100vh-3rem)] xl:overflow-auto">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sections</p>
                  <div className="space-y-1.5 text-sm font-semibold text-slate-700">
                    {sectionNavItems.map((item) => (
                      <NavLink
                        key={item.id}
                        to={item.to}
                        end={item.to === "/superadmin"}
                        className={({ isActive }) =>
                          `flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                            isActive ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-indigo-50 hover:text-indigo-700"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span>{item.label}</span>
                            {typeof item.count === "number" && (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                                {item.count}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Triage</p>
                    <div className="space-y-2">
                      {actionQueueItems.map((item) => (
                        <NavLink
                          key={item.id}
                          to={item.to}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${item.tone}`}
                        >
                          <span className="max-w-[160px] leading-tight">{item.label}</span>
                          <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black">{item.count}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fast Filters</p>
                    <div className="space-y-2">
                      {triageLinks.map((item) => (
                        <NavLink
                          key={item.id}
                          to={item.to}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <span className="max-w-[160px] leading-tight">{item.label}</span>
                          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-900">{item.count}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </nav>
              </aside>

              <div className="space-y-6">
                <Outlet context={outletContext} />
              </div>
            </div>
          </>
        ) : null}
      </main>

      {metrics && (
        <aside className="fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-[300px]">
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Live Pulse</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Visitors till date</span>
              <span className="font-bold text-slate-900">{metrics.total_visitors}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Live visitors</span>
              <span className="font-bold text-emerald-600">{metrics.live_visitors}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Top searched</span>
              <span className="max-w-[130px] truncate font-bold text-indigo-600" title={metrics.most_searched_notice}>
                {metrics.most_searched_notice}
              </span>
            </div>
            <div className="pt-1 text-xs text-slate-500">Signed in as {user?.email || "Admin"}</div>
          </div>
        </aside>
      )}
    </div>
  );
}

import { AdminPageIntro, EmptyState, PaymentStatusPill, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminPaymentsPage() {
  const {
    paymentOrders,
    paymentStatusFilter,
    setPaymentStatusFilter,
    paymentStatusCounts,
    savingKey,
    handleGrantCredits,
  } = useSuperAdmin();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <AdminPageIntro
        eyebrow="SuperAdmin / Payments"
        title="Payments Inbox"
        description="Watch initiated, abandoned, failed, and successful orders so credits and checkout health stay in sync."
        badge="Revenue ops"
      />
      <SectionHeader title="Payments Inbox" count={paymentOrders.length}>
        <select
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="initiated">Initiated</option>
          <option value="abandoned">Abandoned</option>
          <option value="failed">Failed</option>
          <option value="success">Success</option>
        </select>
      </SectionHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-indigo-800">Initiated</p>
          <p className="text-2xl font-bold text-indigo-900">{paymentStatusCounts.initiated}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-700">Abandoned</p>
          <p className="text-2xl font-bold text-amber-900">{paymentStatusCounts.abandoned}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-rose-700">Failed</p>
          <p className="text-2xl font-bold text-rose-900">{paymentStatusCounts.failed}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">Success</p>
          <p className="text-2xl font-bold text-emerald-900">{paymentStatusCounts.success}</p>
        </div>
      </div>

      <div className="space-y-3">
        {paymentOrders.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{item.order_id}</p>
                <p className="text-sm text-slate-500">
                  {item.user_email || "Guest checkout"} Â· {item.plan_key} Â· ?{item.amount_inr}
                </p>
                <p className="mt-1 text-xs text-slate-500">Created {new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusPill status={item.admin_status} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  raw: {item.status}
                </span>
              </div>
            </div>

            {item.failure_reason && (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {item.failure_reason}
              </p>
            )}

            {item.admin_status === "success" && !item.credit_granted_at && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void handleGrantCredits(item.order_id)}
                  disabled={savingKey === `payment-${item.order_id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                >
                  {savingKey === `payment-${item.order_id}` ? "Granting..." : "Grant Missing Credits"}
                </button>
              </div>
            )}
          </div>
        ))}

        {paymentOrders.length === 0 && <EmptyState>No payment orders match this filter.</EmptyState>}
      </div>
    </section>
  );
}


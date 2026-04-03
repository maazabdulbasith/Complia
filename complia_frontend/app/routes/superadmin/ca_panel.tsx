import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { AdminPageIntro, EmptyState, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminCaPanelPage() {
  const {
    caPanel,
    caPanelStatusFilter,
    setCAPanelStatusFilter,
    savingKey,
    handleCAPanelCreate,
    handleCAPanelUpdate,
  } = useSuperAdmin();
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState({
    display_name: "",
    email: "",
    phone_number: "",
    icai_membership_number: "",
    city: "",
    specialties: "",
    turnaround_sla_hours: "24",
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    const status = (searchParams.get("status") || "") as "" | "active" | "inactive";
    if (["", "active", "inactive"].includes(status) && status !== caPanelStatusFilter) {
      setCAPanelStatusFilter(status);
    }
  }, [searchParams, caPanelStatusFilter, setCAPanelStatusFilter]);

  const visibleProfiles = useMemo(() => {
    if (caPanelStatusFilter === "active") return caPanel.filter((item) => item.is_active);
    if (caPanelStatusFilter === "inactive") return caPanel.filter((item) => !item.is_active);
    return caPanel;
  }, [caPanel, caPanelStatusFilter]);

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <AdminPageIntro
        eyebrow="SuperAdmin / CA Panel"
        title="Vetted CA Panel"
        description="Manage the CAs available for assignment, keep specialties accurate, and deactivate people without losing case history."
        badge="Assignment roster"
      />

      <SectionHeader title="CA Panel" count={visibleProfiles.length}>
        <select
          value={caPanelStatusFilter}
          onChange={(e) => setCAPanelStatusFilter(e.target.value as "" | "active" | "inactive")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Profiles</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </SectionHeader>

      <div className="mb-5 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Add vetted CA manually</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input value={draft.display_name} onChange={(e) => setDraft((prev) => ({ ...prev, display_name: e.target.value }))} placeholder="Display name" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input value={draft.phone_number} onChange={(e) => setDraft((prev) => ({ ...prev, phone_number: e.target.value }))} placeholder="Phone number" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input value={draft.icai_membership_number} onChange={(e) => setDraft((prev) => ({ ...prev, icai_membership_number: e.target.value }))} placeholder="ICAI number" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input value={draft.city} onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input value={draft.specialties} onChange={(e) => setDraft((prev) => ({ ...prev, specialties: e.target.value }))} placeholder="Specialties, comma separated" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2" />
          <input value={draft.turnaround_sla_hours} onChange={(e) => setDraft((prev) => ({ ...prev, turnaround_sla_hours: e.target.value }))} placeholder="SLA hours" type="number" min="1" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((prev) => ({ ...prev, is_active: e.target.checked }))} />
            Active for assignment
          </label>
          <input value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Internal notes" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2 xl:col-span-4" />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              await handleCAPanelCreate({
                display_name: draft.display_name.trim(),
                email: draft.email.trim(),
                phone_number: draft.phone_number.trim(),
                icai_membership_number: draft.icai_membership_number.trim(),
                city: draft.city.trim(),
                specialties: draft.specialties.split(",").map((item) => item.trim()).filter(Boolean),
                turnaround_sla_hours: Number(draft.turnaround_sla_hours) || 24,
                is_active: draft.is_active,
                notes: draft.notes.trim(),
              });
              setDraft({
                display_name: "",
                email: "",
                phone_number: "",
                icai_membership_number: "",
                city: "",
                specialties: "",
                turnaround_sla_hours: "24",
                is_active: true,
                notes: "",
              });
            }}
            disabled={savingKey === "ca-panel-create" || !draft.display_name.trim() || !draft.email.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {savingKey === "ca-panel-create" ? "Creating..." : "Add CA profile"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {visibleProfiles.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{item.display_name}</p>
                <p className="text-sm text-slate-500">{item.email} · {item.city || "City not set"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                  {item.user_email ? (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                      linked to {item.user_email}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-slate-500">SLA {item.turnaround_sla_hours}h</p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <input defaultValue={item.display_name} onBlur={(e) => e.target.value !== item.display_name ? void handleCAPanelUpdate(item.id, { display_name: e.target.value.trim() }) : undefined} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input defaultValue={item.email} onBlur={(e) => e.target.value !== item.email ? void handleCAPanelUpdate(item.id, { email: e.target.value.trim() }) : undefined} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input defaultValue={item.phone_number || ""} onBlur={(e) => e.target.value !== (item.phone_number || "") ? void handleCAPanelUpdate(item.id, { phone_number: e.target.value.trim() }) : undefined} placeholder="Phone" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input defaultValue={item.icai_membership_number || ""} onBlur={(e) => e.target.value !== (item.icai_membership_number || "") ? void handleCAPanelUpdate(item.id, { icai_membership_number: e.target.value.trim() }) : undefined} placeholder="ICAI number" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input defaultValue={item.city || ""} onBlur={(e) => e.target.value !== (item.city || "") ? void handleCAPanelUpdate(item.id, { city: e.target.value.trim() }) : undefined} placeholder="City" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <input defaultValue={(item.specialties || []).join(", ")} onBlur={(e) => e.target.value !== (item.specialties || []).join(", ") ? void handleCAPanelUpdate(item.id, { specialties: e.target.value.split(",").map((part) => part.trim()).filter(Boolean) }) : undefined} placeholder="Specialties" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2" />
              <input defaultValue={String(item.turnaround_sla_hours || 24)} type="number" min="1" onBlur={(e) => Number(e.target.value) !== (item.turnaround_sla_hours || 24) ? void handleCAPanelUpdate(item.id, { turnaround_sla_hours: Number(e.target.value) || 24 }) : undefined} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              <select value={item.is_active ? "active" : "inactive"} onChange={(e) => void handleCAPanelUpdate(item.id, { is_active: e.target.value === "active" })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <input defaultValue={item.notes || ""} onBlur={(e) => e.target.value !== (item.notes || "") ? void handleCAPanelUpdate(item.id, { notes: e.target.value.trim() }) : undefined} placeholder="Internal notes" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2 xl:col-span-4" />
            </div>
            {savingKey === `ca-panel-${item.id}` && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
          </div>
        ))}

        {visibleProfiles.length === 0 && <EmptyState>No CA panel profiles match this filter yet.</EmptyState>}
      </div>
    </section>
  );
}


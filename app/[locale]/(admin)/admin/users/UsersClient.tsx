"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { UserRole, LocalizedText } from "@/types/database";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string;
  role: UserRole;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
};

type Branch = { id: string; name: LocalizedText };

const ASSIGNABLE_ROLES: UserRole[] = ["driver", "staff", "admin", "super_admin"];

export default function UsersClient({
  initialUsers,
  branches,
  currentUserId,
  isSuperAdmin,
  initialCustomers,
}: {
  initialUsers: UserRow[];
  branches: Branch[];
  currentUserId: string;
  isSuperAdmin: boolean;
  initialCustomers: UserRow[];
}) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("status.role");
  const locale = useLocale() as "ar" | "en" | "fr";
  const router = useRouter();

  const [users, setUsers] = useState(initialUsers);
  const [customers, setCustomers] = useState(initialCustomers);
  const [showForm, setShowForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [tab, setTab] = useState<"team" | "customers">("team");

  const filtered = roleFilter === "all" ? users : users.filter((u) => u.role === roleFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl text-navy-dark sm:text-3xl">{t("title")}</h1>
        {tab === "team" && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark"
          >
            {showForm ? t("cancel") : t("newAccount")}
          </button>
        )}
      </div>

      {isSuperAdmin && (
        <div className="mt-4 flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab("team")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "team" ? "bg-navy text-base" : "border border-navy/20 text-navy-dark/70 hover:bg-sky-pale"
            }`}
          >
            {t("tabTeam")}
          </button>
          <button
            type="button"
            onClick={() => setTab("customers")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "customers" ? "bg-navy text-base" : "border border-navy/20 text-navy-dark/70 hover:bg-sky-pale"
            }`}
          >
            {t("tabCustomers")} ({customers.length})
          </button>
        </div>
      )}

      {tab === "team" ? (
        <>
          {showForm && (
            <CreateUserForm
              branches={branches}
              onCreated={(u) => {
                setUsers((prev) => [u, ...prev]);
                setShowForm(false);
              }}
            />
          )}

          <div className="mt-6 flex flex-wrap gap-1.5">
            {(["all", ...ASSIGNABLE_ROLES] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === r ? "bg-navy text-base" : "border border-navy/20 text-navy-dark/70 hover:bg-sky-pale"
                }`}
              >
                {r === "all" ? t("allRoles") : tr(r)}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {filtered.length === 0 && <p className="text-sm text-navy-dark/60">{t("empty")}</p>}
            {filtered.map((u) => (
              <UserRowCard
                key={u.id}
                u={u}
                branches={branches}
                locale={locale}
                isSelf={u.id === currentUserId}
                onChange={(patch) => setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, ...patch } : p)))}
                refresh={() => router.refresh()}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-2">
          {customers.length === 0 && <p className="text-sm text-navy-dark/60">{t("noCustomers")}</p>}
          {customers.map((u) => (
            <UserRowCard
              key={u.id}
              u={u}
              branches={branches}
              locale={locale}
              isSelf={false}
              isCustomer
              onChange={(patch) => setCustomers((prev) => prev.map((p) => (p.id === u.id ? { ...p, ...patch } : p)))}
              refresh={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ branches, onCreated }: { branches: Branch[]; onCreated: (u: UserRow) => void }) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("status.role");
  const locale = useLocale() as "ar" | "en" | "fr";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("driver");
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, phone: phone || undefined, role, branchId: branchId || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const base =
          data?.error === "email_in_use" ? t("errorEmailInUse") : data?.error === "weak_password" ? t("errorWeakPassword") : t("errorCreateFailed");
        setError(data?.detail ? `${base} (${data.detail})` : base);
        return;
      }
      onCreated({
        id: data.id,
        full_name: fullName,
        phone: phone || email,
        role,
        branch_id: branchId || null,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    } catch {
      setError(t("errorCreateFailed"));
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-navy-dark/15 bg-white px-3 py-2 text-sm text-start text-navy-dark placeholder:text-navy-dark/30 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30";

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-2xl border border-sky-light bg-base-soft p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fullName")}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputCls} />
        </Field>
        <Field label={t("role")}>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("emailLabel")}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        </Field>
        <Field label={t("passwordLabel")}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputCls} />
        </Field>
        <Field label={t("phoneOptional")}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+9613xxxxxx" />
        </Field>
        <Field label={t("branchOptional")}>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
            <option value="">{t("noBranch")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name[locale] ?? b.name.en}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
      >
        {busy ? t("creating") : t("create")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-navy-dark/70">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function UserRowCard({
  u,
  branches,
  locale,
  isSelf,
  isCustomer,
  onChange,
  refresh,
}: {
  u: UserRow;
  branches: Branch[];
  locale: "ar" | "en" | "fr";
  isSelf: boolean;
  isCustomer?: boolean;
  onChange: (patch: Partial<UserRow>) => void;
  refresh: () => void;
}) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("status.role");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, optimistic: Partial<UserRow>) {
    setBusy(true);
    setError(null);
    const prev = { ...u };
    onChange(optimistic);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail ? `${t("actionFailed")} (${data.detail})` : t("actionFailed"));
        onChange(prev);
        return;
      }
      refresh();
    } catch {
      onChange(prev);
      setError(t("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetPassword() {
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPw }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResetMsg(data?.detail ? `${t("resetFailed")} (${data.detail})` : t("resetFailed"));
        return;
      }
      setResetMsg(t("resetSuccess"));
      setNewPw("");
    } catch {
      setResetMsg(t("resetFailed"));
    } finally {
      setResetBusy(false);
    }
  }

  const branchName = branches.find((b) => b.id === u.branch_id)?.name;

  return (
    <div className={`rounded-2xl border border-sky-light bg-base-soft p-4 ${!u.is_active ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-navy-dark">{u.full_name || t("noName")}</p>
          <p className="text-xs text-navy-dark/60">{u.phone}</p>
          {branchName && <p className="mt-0.5 text-xs text-navy/60">{branchName[locale] ?? branchName.en}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCustomer ? (
            <span className="rounded-full border border-navy/20 bg-white px-3 py-1.5 text-xs font-medium text-navy-dark">
              {tr("customer")}
            </span>
          ) : (
            <select
              value={u.role}
              disabled={busy || isSelf}
              onChange={(e) => patch({ role: e.target.value }, { role: e.target.value as UserRole })}
              className="rounded-full border border-navy/20 bg-white px-3 py-1.5 text-xs font-medium text-navy-dark disabled:opacity-50"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            disabled={busy || isSelf}
            onClick={() => patch({ isActive: !u.is_active }, { is_active: !u.is_active })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              u.is_active ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-navy text-base hover:bg-navy-dark"
            }`}
          >
            {u.is_active ? t("deactivate") : t("activate")}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetOpen((s) => !s);
              setResetMsg(null);
            }}
            className="rounded-full border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale"
          >
            {t("resetPassword")}
          </button>
        </div>
      </div>

      {resetOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-light/70 bg-white p-3">
          <input
            type="text"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            minLength={8}
            placeholder={t("newPasswordPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-navy-dark/15 bg-white px-3 py-2 text-sm text-start text-navy-dark placeholder:text-navy-dark/30 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
          />
          <button
            type="button"
            disabled={resetBusy || newPw.length < 8}
            onClick={submitResetPassword}
            className="shrink-0 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
          >
            {resetBusy ? t("saving") : t("confirmReset")}
          </button>
          {resetMsg && <p className="w-full text-xs text-navy-dark/80">{resetMsg}</p>}
        </div>
      )}

      {isSelf && <p className="mt-2 text-[11px] text-navy/50">{t("selfNote")}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

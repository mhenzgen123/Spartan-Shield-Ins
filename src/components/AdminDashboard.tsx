import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { url } from "@/data/site";

/**
 * Applicant dashboard — spec 8.2.
 *
 * Two tabs, newest first, expandable rows, a status dropdown that writes back,
 * and a CSV export on each tab.
 *
 * Authentication is entirely Cloudflare Access. This component holds no
 * credentials and no session state; every fetch either succeeds because the
 * browser carries a valid Access cookie, or comes back 401 and the user is
 * told to reload to sign in again. Nothing is stored in localStorage or
 * sessionStorage.
 */

type Tab = "applications" | "messages";

const STATUSES = ["new", "reviewing", "contacted", "passed"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  passed: "Passed",
};

interface ApplicationRow {
  id: string;
  created_at: string;
  position: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string | null;
  licensed: string;
  notes: string | null;
  resume_filename: string;
  resume_size: number;
  status: string;
}

interface MessageRow {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
  consent_service: number;
  consent_marketing: number;
  consent_service_text: string;
  consent_marketing_text: string;
  page_url: string;
  user_agent: string | null;
  ip_address: string | null;
  status: string;
}

interface Props {
  positions: { slug: string; title: string }[];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ConsentPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[0.75rem] font-semibold ${
        on ? "bg-success/15 text-success" : "bg-on-light-mu/12 text-on-light-mu"
      }`}
      title={on ? `${label}: opted in` : `${label}: not opted in`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-success" : "bg-on-light-mu"}`}
      />
      {label}
    </span>
  );
}

function StatusSelect({
  value,
  onChange,
  busy,
  label,
}: {
  value: string;
  onChange: (next: Status) => void;
  busy: boolean;
  label: string;
}) {
  return (
    <select
      className="field-input h-9 min-h-0 w-[8.5rem] py-1 text-[0.8125rem]"
      value={STATUSES.includes(value as Status) ? value : "new"}
      disabled={busy}
      aria-label={label}
      onChange={(event) => onChange(event.target.value as Status)}
      onClick={(event) => event.stopPropagation()}
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  );
}

export default function AdminDashboard({ positions }: Props) {
  const [tab, setTab] = useState<Tab>("applications");
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState("");

  const titleFor = useCallback(
    (slug: string) => positions.find((role) => role.slug === slug)?.title ?? slug,
    [positions],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [applicationsResponse, messagesResponse] = await Promise.all([
        fetch(url("/api/admin/applications"), { credentials: "same-origin" }),
        fetch(url("/api/admin/submissions"), { credentials: "same-origin" }),
      ]);

      if (applicationsResponse.status === 401 || messagesResponse.status === 401) {
        throw new Error("Your session expired. Reload the page to sign in again.");
      }
      if (!applicationsResponse.ok || !messagesResponse.ok) {
        const failed = !applicationsResponse.ok ? applicationsResponse : messagesResponse;
        const payload = (await failed.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not load the dashboard.");
      }

      const applicationsBody = (await applicationsResponse.json()) as { rows: ApplicationRow[] };
      const messagesBody = (await messagesResponse.json()) as { rows: MessageRow[] };

      setApplications(applicationsBody.rows ?? []);
      setMessages(messagesBody.rows ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (
    endpoint: "applications" | "submissions",
    id: string,
    status: Status,
  ) => {
    setBusyRow(id);
    setError("");

    // Optimistic; rolled back below if the write fails.
    const revert =
      endpoint === "applications"
        ? () => setApplications((rows) => [...rows])
        : () => setMessages((rows) => [...rows]);

    if (endpoint === "applications") {
      setApplications((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));
    } else {
      setMessages((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));
    }

    try {
      const response = await fetch(url(`/api/admin/${endpoint}`), {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not save that change.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that change.");
      revert();
      void load();
    } finally {
      setBusyRow(null);
    }
  };

  const visibleApplications = useMemo(
    () =>
      positionFilter
        ? applications.filter((row) => row.position === positionFilter)
        : applications,
    [applications, positionFilter],
  );

  const toggle = (id: string) => setExpanded((current) => (current === id ? null : id));

  const tabButton = (value: Tab, label: string, count: number) => (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-selected={tab === value}
      aria-controls={`panel-${value}`}
      onClick={() => {
        setTab(value);
        setExpanded(null);
      }}
      className={`-mb-px border-b-2 px-1 pb-3 text-[0.9375rem] font-semibold transition-colors duration-150 ${
        tab === value
          ? "border-oxblood text-oxblood"
          : "border-transparent text-on-light-mu hover:text-on-light"
      }`}
    >
      {label}{" "}
      <span className="ml-1 rounded-[4px] bg-cream px-1.5 py-0.5 text-[0.75rem] tabular-nums text-on-light-mu">
        {count}
      </span>
    </button>
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-on-light-mu/25">
        <div role="tablist" aria-label="Dashboard sections" className="flex gap-6">
          {tabButton("applications", "Applications", applications.length)}
          {tabButton("messages", "Messages", messages.length)}
        </div>

        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => void load()}
            className="btn btn-outline-dark h-9 min-h-0 px-3 py-1 text-[0.8125rem]"
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <a
            href={url(`/api/admin/export?tab=${tab}`)}
            className="btn btn-primary h-9 min-h-0 px-3 py-1 text-[0.8125rem]"
            download
          >
            Export CSV
          </a>
        </div>
      </div>

      {error && (
        <p className="field-error mt-4" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="type-body mt-8 text-on-light-mu">Loading…</p>}

      {/* -------------------------------------------------- Applications */}
      {!loading && tab === "applications" && (
        <div id="panel-applications" role="tabpanel" aria-labelledby="tab-applications">
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="type-small font-semibold text-on-light" htmlFor="position-filter">
              Filter by position
            </label>
            <select
              id="position-filter"
              className="field-input h-9 min-h-0 w-auto py-1 text-[0.8125rem]"
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
            >
              <option value="">All positions</option>
              {positions.map((role) => (
                <option key={role.slug} value={role.slug}>
                  {role.title}
                </option>
              ))}
            </select>
          </div>

          {visibleApplications.length === 0 ? (
            <p className="type-body mt-8 text-on-light-mu">No applications yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-on-light-mu/25">
                    {["Date", "Position", "Name", "Email", "Phone", "Licensed", "Status", "Resume"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="type-small px-3 py-2 font-semibold text-on-light-mu first:pl-0"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleApplications.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className="cursor-pointer border-b border-on-light-mu/15 align-middle hover:bg-cream/40"
                        onClick={() => toggle(row.id)}
                        aria-expanded={expanded === row.id}
                      >
                        <td className="type-small whitespace-nowrap py-3 pr-3 text-on-light-mu">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="type-small px-3 py-3 text-on-light">
                          {titleFor(row.position)}
                        </td>
                        <td className="px-3 py-3 text-[0.9375rem] font-medium text-on-light">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="type-small px-3 py-3">
                          <a
                            href={`mailto:${row.email}`}
                            className="text-oxblood underline underline-offset-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.email}
                          </a>
                        </td>
                        <td className="type-small whitespace-nowrap px-3 py-3">
                          <a
                            href={`tel:${row.phone.replace(/\D/g, "")}`}
                            className="tabular-nums text-oxblood underline underline-offset-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.phone}
                          </a>
                        </td>
                        <td className="type-small px-3 py-3 text-on-light-mu">{row.licensed}</td>
                        <td className="px-3 py-3">
                          <StatusSelect
                            value={row.status}
                            busy={busyRow === row.id}
                            label={`Status for ${row.first_name} ${row.last_name}`}
                            onChange={(status) => void updateStatus("applications", row.id, status)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={url(`/api/admin/resume/${row.id}`)}
                            className="btn btn-outline-dark h-9 min-h-0 whitespace-nowrap px-3 py-1 text-[0.8125rem]"
                            onClick={(event) => event.stopPropagation()}
                            download
                          >
                            Download
                          </a>
                        </td>
                      </tr>

                      {expanded === row.id && (
                        <tr className="border-b border-on-light-mu/15 bg-cream/30">
                          <td colSpan={8} className="px-0 py-5">
                            <dl className="grid gap-4 sm:grid-cols-3">
                              <div>
                                <dt className="type-small font-semibold text-on-light">Location</dt>
                                <dd className="type-small text-on-light-mu">{row.location}</dd>
                              </div>
                              <div>
                                <dt className="type-small font-semibold text-on-light">LinkedIn</dt>
                                <dd className="type-small break-all text-on-light-mu">
                                  {row.linkedin_url ? (
                                    <a
                                      href={row.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-oxblood underline underline-offset-2"
                                    >
                                      {row.linkedin_url}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="type-small font-semibold text-on-light">
                                  Resume file
                                </dt>
                                <dd className="type-small break-all text-on-light-mu">
                                  {row.resume_filename} ({formatBytes(row.resume_size)})
                                </dd>
                              </div>
                              <div className="sm:col-span-3">
                                <dt className="type-small font-semibold text-on-light">Notes</dt>
                                <dd className="type-small whitespace-pre-wrap text-on-light-mu">
                                  {row.notes || "—"}
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ Messages */}
      {!loading && tab === "messages" && (
        <div id="panel-messages" role="tabpanel" aria-labelledby="tab-messages">
          {messages.length === 0 ? (
            <p className="type-body mt-8 text-on-light-mu">No messages yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-on-light-mu/25">
                    {["Date", "Name", "Phone", "Email", "Topic", "SMS consent", "Status"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="type-small px-3 py-2 font-semibold text-on-light-mu first:pl-0"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {messages.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className="cursor-pointer border-b border-on-light-mu/15 align-middle hover:bg-cream/40"
                        onClick={() => toggle(row.id)}
                        aria-expanded={expanded === row.id}
                      >
                        <td className="type-small whitespace-nowrap py-3 pr-3 text-on-light-mu">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-3 text-[0.9375rem] font-medium text-on-light">
                          {row.name}
                        </td>
                        <td className="type-small whitespace-nowrap px-3 py-3">
                          <a
                            href={`tel:${row.phone.replace(/\D/g, "")}`}
                            className="tabular-nums text-oxblood underline underline-offset-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.phone}
                          </a>
                        </td>
                        <td className="type-small px-3 py-3">
                          <a
                            href={`mailto:${row.email}`}
                            className="text-oxblood underline underline-offset-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.email}
                          </a>
                        </td>
                        <td className="type-small px-3 py-3 text-on-light-mu">{row.topic}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <ConsentPill on={row.consent_service === 1} label="Service" />
                            <ConsentPill on={row.consent_marketing === 1} label="Marketing" />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusSelect
                            value={row.status}
                            busy={busyRow === row.id}
                            label={`Status for ${row.name}`}
                            onChange={(status) => void updateStatus("submissions", row.id, status)}
                          />
                        </td>
                      </tr>

                      {expanded === row.id && (
                        <tr className="border-b border-on-light-mu/15 bg-cream/30">
                          <td colSpan={7} className="px-0 py-5">
                            <div>
                              <p className="type-small font-semibold text-on-light">Message</p>
                              <p className="type-small mt-1 whitespace-pre-wrap text-on-light-mu">
                                {row.message}
                              </p>
                            </div>

                            {/* The stored consent wording. This is the record
                                that matters if a complaint is ever filed. */}
                            <div className="mt-5 rounded-[8px] border border-on-light-mu/25 bg-parchment p-4">
                              <p className="type-eyebrow text-oxblood">
                                Consent record as shown to this person
                              </p>
                              <dl className="mt-3 space-y-3">
                                <div>
                                  <dt className="type-small font-semibold text-on-light">
                                    Service messages —{" "}
                                    {row.consent_service === 1 ? "AGREED" : "not agreed"}
                                  </dt>
                                  <dd className="type-small text-on-light-mu">
                                    {row.consent_service_text}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="type-small font-semibold text-on-light">
                                    Marketing messages —{" "}
                                    {row.consent_marketing === 1 ? "AGREED" : "not agreed"}
                                  </dt>
                                  <dd className="type-small text-on-light-mu">
                                    {row.consent_marketing_text}
                                  </dd>
                                </div>
                              </dl>
                              <p className="type-small mt-3 text-on-light-mu">
                                Submitted from {row.page_url || "—"} · IP {row.ip_address || "—"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

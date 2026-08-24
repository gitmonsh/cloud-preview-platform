import { useEffect, useMemo, useState } from "react";
import "./App.css";

type PreviewStatus = "READY" | "BUILDING" | "DESTROYING";

type Preview = {
  pr: number;
  title: string;
  branch: string | null;
  author: string | null;
  github_url: string | null;
  status: PreviewStatus;
  namespace: string;
  image: string | null;
  url: string | null;
  age: string;
  replicas: string;
};

type PreviewResponse = {
  count: number;
  previews: Preview[];
};

type PodDetail = {
  name: string;
  phase: string;
  ready: boolean;
  restart_count: number;
  node: string | null;
};

type PreviewDetails = Preview & {
  namespace_status: string;
  full_image: string | null;
  deployment: {
    name: string | null;
    desired_replicas: number;
    available_replicas: number;
    ready_replicas: number;
    conditions: {
      type: string;
      status: string;
      reason: string | null;
      message: string | null;
    }[];
  };
  service: {
    name: string | null;
    type: string | null;
    cluster_ip: string | null;
    preview_url: string | null;
  };
  pods: PodDetail[];
  resources: {
    requests: {
      cpu?: string | null;
      memory?: string | null;
    };
    limits: {
      cpu?: string | null;
      memory?: string | null;
    };
  };
};

type LogsResponse = {
  pr: number;
  namespace: string;
  pod: string;
  container: string;
  lines: number;
  logs: string;
};

const API_URL = "http://127.0.0.1:8000";

const STATUS_LABELS: Record<PreviewStatus, string> = {
  READY: "Ready",
  BUILDING: "Building",
  DESTROYING: "Destroying",
};

function App() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPreview, setSelectedPreview] =
    useState<PreviewDetails | null>(null);

  const [showReadyOnly, setShowReadyOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [destroying, setDestroying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [destroyError, setDestroyError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  const [prInput, setPrInput] = useState("");
  const [logs, setLogs] = useState<LogsResponse | null>(null);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadPreviews(showRefreshState = false) {
    if (showRefreshState) {
      setRefreshing(true);
    }

    try {
      const response = await fetch(`${API_URL}/api/previews`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: PreviewResponse = await response.json();

      setPreviews(data.previews);
      setError(null);
      setLastUpdated(new Date());
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to connect to the platform API.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function createPreview() {
    const prNumber = Number.parseInt(prInput.trim(), 10);

    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      setCreateError("Enter a valid pull request number.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/previews?pr_number=${prNumber}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to create preview.");
      }

      setShowCreateModal(false);
      setPrInput("");

      await loadPreviews(true);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to create preview.";

      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  async function openDetails(preview: Preview) {
    setDetailsLoading(true);
    setDetailsError(null);
    setDestroyError(null);
    setLogs(null);
    setLogsError(null);
    setSelectedPreview(null);

    try {
      const response = await fetch(
        `${API_URL}/api/previews/${preview.pr}`,
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: PreviewDetails = await response.json();

      setSelectedPreview(data);
    } catch (requestError) {
      console.error(requestError);
      setDetailsError("Unable to load Kubernetes details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function loadLogs(prNumber: number) {
    setLogsLoading(true);
    setLogsError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/previews/${prNumber}/logs`,
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: LogsResponse = await response.json();

      setLogs(data);
    } catch (requestError) {
      console.error(requestError);
      setLogsError("Unable to load pod logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function destroyPreview() {
    if (!selectedPreview) {
      return;
    }

    setDestroying(true);
    setDestroyError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/previews/${selectedPreview.pr}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "Unable to destroy preview.",
        );
      }

      setShowDestroyConfirm(false);
      setSelectedPreview(null);
      setLogs(null);

      await loadPreviews(true);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to destroy preview.";

      setDestroyError(message);
    } finally {
      setDestroying(false);
    }
  }

  function closeDetails() {
    if (destroying) {
      return;
    }

    setSelectedPreview(null);
    setLogs(null);
    setLogsError(null);
    setDetailsError(null);
    setDestroyError(null);
    setShowDestroyConfirm(false);
  }

  useEffect(() => {
    loadPreviews();

    const interval = window.setInterval(() => {
      loadPreviews();
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredPreviews = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return previews.filter((preview) => {
      const searchableValues = [
        preview.title,
        preview.branch ?? "",
        preview.author ?? "",
        preview.namespace,
        preview.image ?? "",
        preview.pr.toString(),
      ];

      const matchesQuery = searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );

      const matchesStatus =
        !showReadyOnly || preview.status === "READY";

      return matchesQuery && matchesStatus;
    });
  }, [previews, query, showReadyOnly]);

  const activeCount = previews.filter(
    (preview) =>
      preview.status === "READY" ||
      preview.status === "BUILDING",
  ).length;

  const readyCount = previews.filter(
    (preview) => preview.status === "READY",
  ).length;

  const buildingCount = previews.filter(
    (preview) => preview.status === "BUILDING",
  ).length;

  const destroyingCount = previews.filter(
    (preview) => preview.status === "DESTROYING",
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CP</div>

          <div>
            <div className="brand-title">Cloud Preview</div>
            <div className="brand-subtitle">Platform</div>
          </div>
        </div>

        <nav className="nav">
          <button className="nav-item active">
            <span>◉</span>
            Overview
          </button>
        </nav>

        <div
          style={{
            marginTop: "24px",
            padding: "14px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "rgba(13, 27, 47, 0.55)",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              color: "var(--muted-strong)",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Live cluster
          </p>

          <strong
            style={{
              display: "block",
              fontSize: "12px",
            }}
          >
            cloud-preview-eks
          </strong>

          <span
            style={{
              display: "block",
              marginTop: "4px",
              color: "var(--muted)",
              fontSize: "11px",
            }}
          >
            Amazon EKS · us-west-2
          </span>
        </div>

        <div className="sidebar-footer">
          <div
            className={`status-dot ${
              error ? "status-dot-error" : ""
            }`}
          />

          <div>
            <strong>
              {error ? "API unavailable" : "Platform healthy"}
            </strong>

            <span>
              {error
                ? "Unable to read cluster state"
                : "Connected to EKS"}
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Developer platform</p>

            <h1>Preview environments</h1>

            <p className="page-description">
              Live ephemeral environments created from GitHub pull requests.
            </p>
          </div>

          <div className="topbar-actions">
            <button
              className="primary-button"
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
            >
              + Create Preview
            </button>

            <button
              className="filter-button"
              onClick={() => loadPreviews(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <div className="region-pill">us-west-2</div>

            <div className="avatar">MG</div>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Active previews</span>
            <strong>{activeCount}</strong>
            <small>running or building</small>
          </div>

          <div className="stat-card">
            <span>Ready</span>
            <strong>{readyCount}</strong>
            <small>available to reviewers</small>
          </div>

          <div className="stat-card">
            <span>Building</span>
            <strong>{buildingCount}</strong>
            <small>currently deploying</small>
          </div>

          <div className="stat-card">
            <span>Destroying</span>
            <strong>{destroyingCount}</strong>
            <small>cleanup in progress</small>
          </div>
        </section>

        <section className="toolbar">
          <div>
            <h2>Preview environments</h2>

            <p>
              Real-time state from{" "}
              <strong>cloud-preview-eks</strong>.
              {lastUpdated && (
                <>
                  {" "}
                  Last updated{" "}
                  {lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                  .
                </>
              )}
            </p>
          </div>

          <div className="toolbar-controls">
            <input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search previews..."
              aria-label="Search previews"
            />

            <button
              className={`filter-button ${
                showReadyOnly ? "active" : ""
              }`}
              onClick={() =>
                setShowReadyOnly((current) => !current)
              }
            >
              {showReadyOnly
                ? "Showing ready only"
                : "Filter ready"}
            </button>
          </div>
        </section>

        {error && (
          <div className="api-error">
            <strong>Platform API unavailable</strong>

            <span>
              Make sure FastAPI is running on
              http://127.0.0.1:8000.
            </span>
          </div>
        )}

        <section className="preview-list">
          {loading ? (
            <div className="empty-state">
              <strong>Loading cluster state...</strong>

              <span>
                Querying Amazon EKS for preview environments.
              </span>
            </div>
          ) : filteredPreviews.length === 0 ? (
            <div className="empty-state">
              <strong>No active preview environments</strong>

              <span>
                Create one using the button above.
              </span>
            </div>
          ) : (
            filteredPreviews.map((preview) => (
              <article className="preview-card" key={preview.pr}>
                <div className="preview-main">
                  <div className="preview-heading">
                    <div
                      className={`status-badge status-${preview.status.toLowerCase()}`}
                    >
                      <span className="status-indicator" />

                      {STATUS_LABELS[preview.status]}
                    </div>

                    <span className="pr-number">
                      PR #{preview.pr}
                    </span>
                  </div>

                  <h3>{preview.title}</h3>

                  <div className="meta-row">
                    <span>
                      {preview.branch
                        ? `branch: ${preview.branch}`
                        : "GitHub pull request"}
                    </span>

                    <span>•</span>

                    <span>
                      {preview.author
                        ? `by ${preview.author}`
                        : "author unavailable"}
                    </span>

                    <span>•</span>

                    <span>{preview.age}</span>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <span>Namespace</span>
                      <strong>{preview.namespace}</strong>
                    </div>

                    <div>
                      <span>Image</span>
                      <strong>
                        {preview.image ?? "Pending"}
                      </strong>
                    </div>

                    <div>
                      <span>Replicas</span>
                      <strong>{preview.replicas}</strong>
                    </div>
                  </div>
                </div>

                <div className="preview-actions">
                  {preview.url ? (
                    <a
                      className="primary-button"
                      href={preview.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open preview
                    </a>
                  ) : (
                    <button
                      className="primary-button disabled"
                      disabled
                    >
                      Endpoint pending
                    </button>
                  )}

                  {preview.github_url && (
                    <a
                      className="secondary-button"
                      href={preview.github_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on GitHub
                    </a>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() => openDetails(preview)}
                  >
                    View details
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        {showCreateModal && (
          <div
            className="modal-backdrop"
            onClick={() => {
              if (!creating) {
                setShowCreateModal(false);
                setCreateError(null);
              }
            }}
          >
            <div
              className="details-modal create-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Create environment</p>
                  <h2>New preview</h2>
                </div>

                <button
                  className="close-button"
                  onClick={() => {
                    if (!creating) {
                      setShowCreateModal(false);
                      setCreateError(null);
                    }
                  }}
                  disabled={creating}
                >
                  ×
                </button>
              </div>

              <p className="page-description">
                Enter a GitHub pull request number with an existing
                PR-specific ECR image.
              </p>

              <div style={{ marginTop: "22px" }}>
                <label
                  htmlFor="pr-number"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "var(--muted)",
                    fontSize: "12px",
                  }}
                >
                  Pull request number
                </label>

                <input
                  id="pr-number"
                  className="search"
                  style={{ width: "100%" }}
                  type="number"
                  min="1"
                  value={prInput}
                  onChange={(event) => setPrInput(event.target.value)}
                  placeholder="Example: 4"
                  disabled={creating}
                />
              </div>

              {createError && (
                <div
                  className="api-error"
                  style={{ marginTop: "16px" }}
                >
                  <strong>Unable to create preview</strong>
                  <span>{createError}</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  className="secondary-button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  onClick={createPreview}
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Preview"}
                </button>
              </div>
            </div>
          </div>
        )}

        {detailsLoading && (
          <div className="modal-backdrop">
            <div className="details-modal">
              <p className="eyebrow">Kubernetes details</p>

              <h2>Loading...</h2>

              <p className="page-description">
                Reading live deployment, pod, and service state.
              </p>
            </div>
          </div>
        )}

        {detailsError && !detailsLoading && (
          <div className="modal-backdrop">
            <div className="details-modal">
              <p className="eyebrow">Kubernetes details</p>

              <h2>Unable to load details</h2>

              <p className="page-description">
                {detailsError}
              </p>

              <div className="modal-footer">
                <button
                  className="secondary-button"
                  onClick={() => setDetailsError(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedPreview && !detailsLoading && (
          <div
            className="modal-backdrop"
            onClick={closeDetails}
          >
            <div
              className="details-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    Kubernetes details
                  </p>

                  <h2>PR #{selectedPreview.pr}</h2>
                </div>

                <button
                  className="close-button"
                  onClick={closeDetails}
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>

              <div className="modal-status">
                <div
                  className={`status-badge status-${selectedPreview.status.toLowerCase()}`}
                >
                  <span className="status-indicator" />

                  {STATUS_LABELS[selectedPreview.status]}
                </div>

                <span>{selectedPreview.title}</span>
              </div>

              <div className="modal-grid">
                <div>
                  <span>Branch</span>
                  <strong>
                    {selectedPreview.branch ?? "Unavailable"}
                  </strong>
                </div>

                <div>
                  <span>Author</span>
                  <strong>
                    {selectedPreview.author ?? "Unavailable"}
                  </strong>
                </div>

                <div>
                  <span>Namespace</span>
                  <strong>{selectedPreview.namespace}</strong>
                </div>

                <div>
                  <span>Namespace status</span>
                  <strong>
                    {selectedPreview.namespace_status}
                  </strong>
                </div>

                <div>
                  <span>Deployment</span>
                  <strong>
                    {selectedPreview.deployment.name ?? "Missing"}
                  </strong>
                </div>

                <div>
                  <span>Replicas</span>
                  <strong>
                    {selectedPreview.deployment.ready_replicas} /{" "}
                    {selectedPreview.deployment.desired_replicas}
                  </strong>
                </div>

                <div>
                  <span>Image</span>
                  <strong>
                    {selectedPreview.image ?? "Pending"}
                  </strong>
                </div>

                <div>
                  <span>CPU</span>
                  <strong>
                    {selectedPreview.resources.requests.cpu ?? "—"} request /{" "}
                    {selectedPreview.resources.limits.cpu ?? "—"} limit
                  </strong>
                </div>

                <div>
                  <span>Memory</span>
                  <strong>
                    {selectedPreview.resources.requests.memory ?? "—"} request /{" "}
                    {selectedPreview.resources.limits.memory ?? "—"} limit
                  </strong>
                </div>

                <div>
                  <span>Service</span>
                  <strong>
                    {selectedPreview.service.type ?? "Missing"}
                  </strong>
                </div>

                <div>
                  <span>Endpoint</span>
                  <strong>
                    {selectedPreview.service.preview_url
                      ? "Available"
                      : "Pending"}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: "24px",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "20px",
                }}
              >
                <p className="eyebrow">Pods</p>

                {selectedPreview.pods.length === 0 ? (
                  <p className="page-description">
                    No pods found.
                  </p>
                ) : (
                  selectedPreview.pods.map((pod) => (
                    <div
                      key={pod.name}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0, 1.5fr) repeat(3, minmax(70px, 0.6fr))",
                        gap: "12px",
                        padding: "12px 0",
                        borderBottom:
                          "1px solid var(--border)",
                      }}
                    >
                      <strong
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {pod.name}
                      </strong>

                      <span>{pod.phase}</span>

                      <span>
                        {pod.ready ? "Ready" : "Not ready"}
                      </span>

                      <span>
                        Restarts: {pod.restart_count}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div
                style={{
                  marginTop: "22px",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "20px",
                }}
              >
                <p className="eyebrow">
                  Deployment conditions
                </p>

                {selectedPreview.deployment.conditions.map(
                  (condition) => (
                    <div
                      key={condition.type}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        padding: "8px 0",
                      }}
                    >
                      <strong>{condition.type}</strong>

                      <span>
                        {condition.status}
                        {condition.reason
                          ? ` · ${condition.reason}`
                          : ""}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <div
                style={{
                  marginTop: "22px",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <p className="eyebrow">Live logs</p>

                    <p
                      style={{
                        marginBottom: 0,
                        color: "var(--muted)",
                        fontSize: "12px",
                      }}
                    >
                      {logs
                        ? `${logs.lines} recent lines · ${logs.pod}`
                        : "Read the latest application logs from the pod."}
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => loadLogs(selectedPreview.pr)}
                    disabled={logsLoading}
                  >
                    {logsLoading
                      ? "Loading logs..."
                      : "View logs"}
                  </button>
                </div>

                {logsError && (
                  <div className="api-error">
                    <strong>Unable to load logs</strong>
                    <span>{logsError}</span>
                  </div>
                )}

                {logs && (
                  <div
                    style={{
                      maxHeight: "280px",
                      overflow: "auto",
                      padding: "14px",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      background: "#050b14",
                      fontFamily:
                        '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                      fontSize: "11px",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      color: "#cbd5e1",
                    }}
                  >
                    {logs.logs}
                  </div>
                )}
              </div>

              {destroyError && (
                <div
                  className="api-error"
                  style={{ marginTop: "20px" }}
                >
                  <strong>Unable to destroy preview</strong>
                  <span>{destroyError}</span>
                </div>
              )}

              <div className="modal-footer">
                {selectedPreview.github_url && (
                  <a
                    className="secondary-button"
                    href={selectedPreview.github_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub PR
                  </a>
                )}

                {selectedPreview.url ? (
                  <a
                    className="primary-button"
                    href={selectedPreview.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open preview
                  </a>
                ) : (
                  <button
                    className="primary-button disabled"
                    disabled
                  >
                    Endpoint pending
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={() => setShowDestroyConfirm(true)}
                  disabled={destroying}
                  style={{
                    borderColor: "rgba(251, 113, 133, 0.35)",
                    color: "#fb7185",
                  }}
                >
                  Destroy Preview
                </button>

                <button
                  className="secondary-button"
                  onClick={closeDetails}
                  disabled={destroying}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showDestroyConfirm && selectedPreview && (
          <div
            className="modal-backdrop"
            style={{
              zIndex: 20,
            }}
          >
            <div
              className="details-modal"
              style={{
                width: "min(500px, 92vw)",
              }}
            >
              <p className="eyebrow">Destructive action</p>

              <h2>Destroy preview?</h2>

              <p className="page-description">
                This will delete the Kubernetes namespace{" "}
                <strong>{selectedPreview.namespace}</strong> and its
                Deployment, Pod, Service, and LoadBalancer.
              </p>

              <div
                style={{
                  marginTop: "20px",
                  padding: "14px",
                  border: "1px solid rgba(251, 113, 133, 0.25)",
                  borderRadius: "12px",
                  background: "rgba(251, 113, 133, 0.06)",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#fb7185",
                  }}
                >
                  PR #{selectedPreview.pr}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: "var(--muted)",
                    fontSize: "12px",
                  }}
                >
                  {selectedPreview.title}
                </span>
              </div>

              {destroyError && (
                <div
                  className="api-error"
                  style={{ marginTop: "16px" }}
                >
                  <strong>Destroy failed</strong>
                  <span>{destroyError}</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (!destroying) {
                      setShowDestroyConfirm(false);
                      setDestroyError(null);
                    }
                  }}
                  disabled={destroying}
                >
                  Cancel
                </button>

                <button
                  className="secondary-button"
                  onClick={destroyPreview}
                  disabled={destroying}
                  style={{
                    borderColor: "rgba(251, 113, 133, 0.4)",
                    background: "rgba(251, 113, 133, 0.1)",
                    color: "#fb7185",
                    fontWeight: 700,
                  }}
                >
                  {destroying
                    ? "Destroying..."
                    : "Destroy Preview"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
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

  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

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

  async function openDetails(preview: Preview) {
    setDetailsLoading(true);
    setDetailsError(null);
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

  function closeDetails() {
    setSelectedPreview(null);
    setLogs(null);
    setLogsError(null);
    setDetailsError(null);
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

          <button className="nav-item">
            <span>▣</span>
            Environments
          </button>

          <button className="nav-item">
            <span>◌</span>
            Deployments
          </button>

          <button className="nav-item">
            <span>⌁</span>
            Settings
          </button>
        </nav>

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
                Open a pull request to create a new preview environment.
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

        <footer className="footer">
          <span>Cloud Preview Platform</span>
          <span>Amazon EKS · us-west-2</span>
        </footer>
      </main>

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
                  {logsLoading ? "Loading logs..." : "View logs"}
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
                onClick={closeDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
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

const API_URL = "http://127.0.0.1:8000";

const STATUS_LABELS: Record<PreviewStatus, string> = {
  READY: "Ready",
  BUILDING: "Building",
  DESTROYING: "Destroying",
};

function App() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPreview, setSelectedPreview] = useState<Preview | null>(null);
  const [showReadyOnly, setShowReadyOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      const matchesStatus = !showReadyOnly || preview.status === "READY";

      return matchesQuery && matchesStatus;
    });
  }, [previews, query, showReadyOnly]);

  const activeCount = previews.filter(
    (preview) =>
      preview.status === "READY" || preview.status === "BUILDING",
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
            className={`status-dot ${error ? "status-dot-error" : ""}`}
          />

          <div>
            <strong>{error ? "API unavailable" : "Platform healthy"}</strong>

            <span>
              {error ? "Unable to read cluster state" : "Connected to EKS"}
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
              Real-time state from <strong>cloud-preview-eks</strong>.
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
              className={`filter-button ${showReadyOnly ? "active" : ""}`}
              onClick={() => setShowReadyOnly((current) => !current)}
            >
              {showReadyOnly ? "Showing ready only" : "Filter ready"}
            </button>
          </div>
        </section>

        {error && (
          <div className="api-error">
            <strong>Platform API unavailable</strong>
            <span>
              Make sure FastAPI is running on http://127.0.0.1:8000.
            </span>
          </div>
        )}

        <section className="preview-list">
          {loading ? (
            <div className="empty-state">
              <strong>Loading cluster state...</strong>
              <span>Querying Amazon EKS for preview environments.</span>
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

                    <span className="pr-number">PR #{preview.pr}</span>
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
                      <strong>{preview.image ?? "Pending"}</strong>
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
                    onClick={() => setSelectedPreview(preview)}
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

      {selectedPreview && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Preview details</p>
                <h2>PR #{selectedPreview.pr}</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setSelectedPreview(null)}
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
                <strong>{selectedPreview.branch ?? "Unavailable"}</strong>
              </div>

              <div>
                <span>Author</span>
                <strong>{selectedPreview.author ?? "Unavailable"}</strong>
              </div>

              <div>
                <span>Namespace</span>
                <strong>{selectedPreview.namespace}</strong>
              </div>

              <div>
                <span>Image</span>
                <strong>{selectedPreview.image ?? "Pending"}</strong>
              </div>

              <div>
                <span>Replicas</span>
                <strong>{selectedPreview.replicas}</strong>
              </div>

              <div>
                <span>Age</span>
                <strong>{selectedPreview.age}</strong>
              </div>

              <div>
                <span>Cluster</span>
                <strong>cloud-preview-eks</strong>
              </div>

              <div>
                <span>Region</span>
                <strong>us-west-2</strong>
              </div>
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
                onClick={() => setSelectedPreview(null)}
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
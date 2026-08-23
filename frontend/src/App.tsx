import { useMemo, useState } from "react";
import "./App.css";

type PreviewStatus = "READY" | "BUILDING" | "DESTROYING";

type Preview = {
  pr: number;
  title: string;
  branch: string;
  status: PreviewStatus;
  namespace: string;
  image: string;
  url?: string;
  age: string;
  replicas: string;
};

const PREVIEWS: Preview[] = [
  {
    pr: 18,
    title: "Add authentication flow",
    branch: "feature/auth",
    status: "READY",
    namespace: "preview-pr-18",
    image: "pr-18",
    url: "http://preview-pr-18.example.com",
    age: "4 min",
    replicas: "1 / 1",
  },
  {
    pr: 17,
    title: "Refresh landing page",
    branch: "feature/landing",
    status: "BUILDING",
    namespace: "preview-pr-17",
    image: "pr-17",
    age: "1 min",
    replicas: "0 / 1",
  },
  {
    pr: 16,
    title: "Improve API responses",
    branch: "feature/api",
    status: "READY",
    namespace: "preview-pr-16",
    image: "pr-16",
    url: "http://preview-pr-16.example.com",
    age: "12 min",
    replicas: "1 / 1",
  },
];

const STATUS_LABELS: Record<PreviewStatus, string> = {
  READY: "Ready",
  BUILDING: "Building",
  DESTROYING: "Destroying",
};

function App() {
  const [query, setQuery] = useState("");
  const [selectedPreview, setSelectedPreview] = useState<Preview | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const filteredPreviews = useMemo(() => {
    return PREVIEWS.filter((preview) => {
      const matchesQuery =
        preview.title.toLowerCase().includes(query.toLowerCase()) ||
        preview.branch.toLowerCase().includes(query.toLowerCase()) ||
        preview.namespace.toLowerCase().includes(query.toLowerCase()) ||
        preview.pr.toString().includes(query);

      const matchesStatus = !showActiveOnly || preview.status === "READY";

      return matchesQuery && matchesStatus;
    });
  }, [query, showActiveOnly]);

  const activeCount = PREVIEWS.filter(
    (preview) => preview.status === "READY" || preview.status === "BUILDING",
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
          <div className="status-dot" />
          <div>
            <strong>Platform healthy</strong>
            <span>All systems operational</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Developer platform</p>
            <h1>Preview environments</h1>
            <p className="page-description">
              Manage ephemeral environments created from GitHub pull requests.
            </p>
          </div>

          <div className="topbar-actions">
            <div className="region-pill">us-west-2</div>
            <div className="avatar">MG</div>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Active previews</span>
            <strong>{activeCount}</strong>
            <small>currently running or building</small>
          </div>

          <div className="stat-card">
            <span>Deployments</span>
            <strong>12</strong>
            <small>across all pull requests</small>
          </div>

          <div className="stat-card">
            <span>Success rate</span>
            <strong>98.4%</strong>
            <small>last 30 deployments</small>
          </div>

          <div className="stat-card">
            <span>Avg. deploy time</span>
            <strong>48s</strong>
            <small>build to preview ready</small>
          </div>
        </section>

        <section className="toolbar">
          <div>
            <h2>Active environments</h2>
            <p>Preview instances currently associated with pull requests.</p>
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
              className={`filter-button ${showActiveOnly ? "active" : ""}`}
              onClick={() => setShowActiveOnly((current) => !current)}
            >
              {showActiveOnly ? "Showing ready only" : "Filter ready"}
            </button>
          </div>
        </section>

        <section className="preview-list">
          {filteredPreviews.map((preview) => (
            <article className="preview-card" key={preview.pr}>
              <div className="preview-main">
                <div className="preview-heading">
                  <div className={`status-badge status-${preview.status.toLowerCase()}`}>
                    <span className="status-indicator" />
                    {STATUS_LABELS[preview.status]}
                  </div>

                  <span className="pr-number">PR #{preview.pr}</span>
                </div>

                <h3>{preview.title}</h3>

                <div className="meta-row">
                  <span>{preview.branch}</span>
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
                    <strong>{preview.image}</strong>
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
                  <button className="primary-button disabled" disabled>
                    Preview building
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={() => setSelectedPreview(preview)}
                >
                  View details
                </button>
              </div>
            </article>
          ))}

          {filteredPreviews.length === 0 && (
            <div className="empty-state">
              <strong>No previews found</strong>
              <span>Try another search or remove the filter.</span>
            </div>
          )}
        </section>

        <footer className="footer">
          <span>Cloud Preview Platform</span>
          <span>Dashboard prototype</span>
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
                <span>Namespace</span>
                <strong>{selectedPreview.namespace}</strong>
              </div>

              <div>
                <span>Image</span>
                <strong>{selectedPreview.image}</strong>
              </div>

              <div>
                <span>Replicas</span>
                <strong>{selectedPreview.replicas}</strong>
              </div>

              <div>
                <span>Age</span>
                <strong>{selectedPreview.age}</strong>
              </div>
            </div>

            <div className="modal-footer">
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
                <button className="primary-button disabled" disabled>
                  Preview building
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
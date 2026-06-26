"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Plus,
  LogOut,
  Pencil,
  Check,
  X,
  Trash2,
  Copy,
  Play,
  ArrowUpRight,
} from "lucide-react";

const papers = ["paper-lime", "paper-lilac", "paper-coral", "paper-mint", "paper-pink", "paper-cream"];
const tilts = [-1.7, 1.2, -0.9, 1.6, -1.3, 0.8];

function deckStyle(index: number, tone?: string): CSSProperties {
  return {
    "--tilt": `${tilts[index % tilts.length]}deg`,
    "--tone": tone ?? "var(--nx-ink)",
  } as CSSProperties;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: new Date().getFullYear() !== new Date(timestamp).getFullYear() ? "numeric" : undefined,
  }).format(timestamp);
}

function Brand() {
  return (
    <Link href="/dashboard" className="dashboard-topbar-brand">
      <span>Neurix</span>
    </Link>
  );
}

function RenameInput({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave(value);
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="project-rename-row">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(value)}
        className="project-rename-input"
        aria-label="Project name"
      />
      <button className="project-rename-btn" onClick={() => onSave(value)} type="button" aria-label="Save name">
        <Check size={13} strokeWidth={2.5} />
      </button>
      <button className="project-rename-btn" onClick={onCancel} type="button" aria-label="Cancel rename">
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function NewProjectCard({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button className="deck-card deck-new" type="button" onClick={onClick} disabled={disabled} style={deckStyle(0)}>
      <span className="deck-new-plus" aria-hidden="true">
        <Plus size={26} strokeWidth={2.4} />
      </span>
      <span className="deck-new-title">New project</span>
      <span className="deck-new-sub">Blank stage, ready for blocks &amp; AI</span>
    </button>
  );
}

function DeckSkeleton() {
  return (
    <section className="deck-grid" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <article className={`deck-card deck-card-skeleton ${papers[i % papers.length]}`} key={i} style={deckStyle(i)}>
          <div className="deck-window deck-window-skeleton">
            <Skeleton width="100%" height="100%" radius={12} />
          </div>
          <div className="deck-foot">
            <Skeleton width="62%" height={15} radius={6} />
            <Skeleton width="34%" height={10} radius={6} />
          </div>
        </article>
      ))}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const projects = useQuery(api.projects.listProjects, session.data ? {} : "skip");
  const createProject = useMutation(api.projects.createProject);
  const renameProject = useMutation(api.projects.renameProject);
  const duplicateProject = useMutation(api.projects.duplicateProject);
  const deleteProject = useMutation(api.projects.softDeleteProject);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.replace("/sign-in");
    }
  }, [router, session.data, session.isPending]);

  const createNewProject = async () => {
    setCreating(true);
    try {
      const projectId = await createProject({ name: "Untitled Project" });
      router.push(`/projects/${projectId}`);
    } catch {
      setCreating(false);
    }
  };

  const isLoading = session.isPending || !session.data || projects === undefined;
  const count = projects?.length ?? 0;
  const lastEdited =
    projects && projects.length > 0 ? Math.max(...projects.map((p) => p.updatedAt)) : null;

  return (
    <main className="dashboard-shell deck-shell">
      <header className="dashboard-topbar">
        <Brand />
        <div className="dashboard-topbar-actions">
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={createNewProject}
            disabled={creating || isLoading}
          >
            <Plus size={16} strokeWidth={2.5} />
            New project
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() =>
              authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/sign-in") } })
            }
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </header>

      <header className="deck-hero">
        <div className="deck-hero-main">
          <h1>
            Your <span className="deck-mark">projects</span>
          </h1>
          {!isLoading && (
            <p className="deck-hero-meta">
              {count === 0
                ? "No projects yet"
                : `${count} ${count === 1 ? "project" : "projects"}${
                    lastEdited ? ` · last edited ${formatDate(lastEdited)}` : ""
                  }`}
            </p>
          )}
        </div>
      </header>

      {isLoading ? (
        <DeckSkeleton />
      ) : (
        <section className="deck-grid">
          <NewProjectCard onClick={createNewProject} disabled={creating} />

          {count === 0 && (
            <article className="deck-card deck-empty-note paper-cream" style={deckStyle(2)} aria-hidden="true">
              <span className="deck-empty-arrow">
                <ArrowUpRight size={28} strokeWidth={2.2} />
              </span>
              <p>Hit “New project” to drop a sprite on the stage and start snapping blocks together.</p>
            </article>
          )}

          {projects.map((project, i) => (
            <article
              className={`deck-card ${papers[i % papers.length]}`}
              key={project._id}
              style={deckStyle(i + 1, project.thumbnailTone)}
            >
              <span className="deck-pin" aria-hidden="true" />
              <Link
                href={`/projects/${project._id}`}
                className="deck-window"
                aria-label={`Open ${project.name}`}
              >
                <span className="deck-blob deck-blob-1" />
                <span className="deck-blob deck-blob-2" />
                <span className="deck-blob deck-blob-3" />
                <span className="deck-window-open" aria-hidden="true">
                  <Play size={18} strokeWidth={2.5} fill="currentColor" />
                  Open
                </span>
              </Link>

              <div className="deck-foot">
                {renamingId === project._id ? (
                  <RenameInput
                    initialName={project.name}
                    onSave={async (name) => {
                      await renameProject({ projectId: project._id, name });
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <div className="deck-title-row">
                    <h2 title={project.name}>{project.name}</h2>
                    <button
                      className="deck-icon-btn deck-icon-subtle"
                      onClick={() => setRenamingId(project._id)}
                      type="button"
                      aria-label={`Rename ${project.name}`}
                    >
                      <Pencil size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                <p className="deck-meta">Edited {formatDate(project.updatedAt)}</p>

                <div className="deck-actions">
                  <Link className="btn btn-primary btn-sm deck-open" href={`/projects/${project._id}`}>
                    <Play size={13} strokeWidth={2.5} fill="currentColor" />
                    Open
                  </Link>
                  <button
                    className="deck-icon-btn"
                    type="button"
                    onClick={async () =>
                      router.push(`/projects/${await duplicateProject({ projectId: project._id })}`)
                    }
                    aria-label={`Duplicate ${project.name}`}
                    title="Duplicate"
                  >
                    <Copy size={14} strokeWidth={2} />
                  </button>
                  <button
                    className="deck-icon-btn deck-icon-danger"
                    type="button"
                    onClick={() => deleteProject({ projectId: project._id })}
                    aria-label={`Delete ${project.name}`}
                    title="Delete"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

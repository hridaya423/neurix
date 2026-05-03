"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  Plus,
  LogOut,
  Pencil,
  Check,
  X,
  Trash2,
  Copy,
  Play,
} from "lucide-react";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date().getFullYear() !== new Date(timestamp).getFullYear() ? "numeric" : undefined,
  }).format(timestamp);
}

function LoadingCard({ label }: { label: string }) {
  return (
    <main className="dashboard-shell dashboard-shell-centered">
      <div className="loading-card">
        <div className="loading-mark">
          <span />
        </div>
        <p>{label}</p>
      </div>
    </main>
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
      />
      <button className="project-rename-btn" onClick={() => onSave(value)} type="button">
        <Check size={13} strokeWidth={2.5} />
      </button>
      <button className="project-rename-btn" onClick={onCancel} type="button">
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
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

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.replace("/sign-in");
    }
  }, [router, session.data, session.isPending]);

  if (session.isPending) {
    return <LoadingCard label="Opening Neurix" />;
  }

  if (!session.data) {
    return <LoadingCard label="Taking you to sign in" />;
  }

  if (projects === undefined) {
    return <LoadingCard label="Loading projects" />;
  }

  const createNewProject = async () => {
    const projectId = await createProject({ name: "Untitled Project" });
    router.push(`/projects/${projectId}`);
  };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <Link href="/dashboard" className="dashboard-topbar-brand">
          <div className="dashboard-topbar-mark">
            <div className="dashboard-topbar-mark-inner" />
          </div>
          <span>Neurix</span>
        </Link>
        <div className="dashboard-topbar-actions">
          <button className="btn btn-primary" type="button" onClick={createNewProject}>
            <Plus size={16} strokeWidth={2.5} />
            New
          </button>
          <button
            className="btn btn-ghost"
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

      <section className="dashboard-hero">
        <h1>Your projects</h1>
        <p>Ideas you brought to life.</p>
      </section>

      {projects.length === 0 ? (
        <section className="dashboard-empty">
          <div className="dashboard-empty-illustration">
            <div className="dashboard-empty-shape" />
            <div className="dashboard-empty-shape" />
            <div className="dashboard-empty-shape" />
          </div>
          <h2>Create your first project</h2>
          <p>Build a sprite, define custom blocks, and bring it to life.</p>
          <button className="btn btn-primary" type="button" onClick={createNewProject}>
            <Plus size={16} strokeWidth={2.5} />
            Start blank
          </button>
        </section>
      ) : (
        <section className="project-grid">
          {projects.map((project) => (
            <article className="project-card" key={project._id}>
              <Link
                href={`/projects/${project._id}`}
                className="project-thumb"
                style={{ color: project.thumbnailTone }}
              >
                <span />
                <span />
                <span />
                <div className="project-thumb-open">
                  <Play size={20} strokeWidth={2.5} fill="white" />
                </div>
              </Link>

              <div className="project-card-body">
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
                  <div className="project-card-title-row">
                    <h2 title={project.name}>{project.name}</h2>
                    <button
                      className="project-icon-btn project-icon-btn-subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(project._id);
                      }}
                      type="button"
                      title="Rename"
                    >
                      <Pencil size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                <p className="project-card-meta">{formatDate(project.updatedAt)}</p>

                <div className="project-card-actions">
                  <Link className="btn btn-primary" href={`/projects/${project._id}`}>
                    <Play size={14} strokeWidth={2.5} fill="currentColor" />
                    Open
                  </Link>
                  <button
                    className="project-icon-btn"
                    type="button"
                    onClick={async () =>
                      router.push(`/projects/${await duplicateProject({ projectId: project._id })}`)
                    }
                    title="Duplicate"
                  >
                    <Copy size={14} strokeWidth={2} />
                  </button>
                  <button
                    className="project-icon-btn project-icon-btn-danger"
                    type="button"
                    onClick={() => deleteProject({ projectId: project._id })}
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

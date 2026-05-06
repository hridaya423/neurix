"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import NeurixEditor, { type ProjectDocument } from "@/components/editor/NeurixEditor";
import { authClient } from "@/lib/auth-client";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

function normalizeDocument(document: unknown): ProjectDocument {
  const value = document as ProjectDocument;
  return {
    version: value.version,
    stage: value.stage,
    sprites: value.sprites,
  };
}

export default function ProjectEditorClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const session = authClient.useSession();
  const convexProjectId = projectId as Id<"projects">;
  const data = useQuery(api.projects.getProject, session.data ? { projectId: convexProjectId } : "skip");
  const saveProject = useMutation(api.projects.saveProject);
  const touchProject = useMutation(api.projects.touchProject);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const latestRef = useRef<{ name: string; document: ProjectDocument } | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const didHydrateRef = useRef(false);
  const hydrateTimeRef = useRef(0);
  const touchedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.replace("/sign-in");
    }
  }, [router, session.data, session.isPending]);

  useEffect(() => {
    if (data && touchedProjectRef.current !== projectId) {
      touchedProjectRef.current = projectId;
      void touchProject({ projectId: convexProjectId }).catch(() => {
        touchedProjectRef.current = null;
      });
    }
  }, [convexProjectId, data, projectId, touchProject]);

  const initialDocument = useMemo(() => data ? normalizeDocument(data.document) : null, [data]);

  const persist = useCallback(async (name: string, document: ProjectDocument) => {
    setSaveStatus("saving");
    try {
      await saveProject({ projectId: convexProjectId, name, document });
      lastSavedRef.current = JSON.stringify({ name, document });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [convexProjectId, saveProject]);

  const handleChange = useCallback((name: string, document: ProjectDocument) => {
    const snapshot = JSON.stringify({ name, document });
    latestRef.current = { name, document };

    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      lastSavedRef.current = snapshot;
      hydrateTimeRef.current = Date.now();
      setSaveStatus("saved");
      return;
    }

    if (snapshot === lastSavedRef.current) return;

    if (Date.now() - hydrateTimeRef.current < 2000) {
      lastSavedRef.current = snapshot;
      return;
    }

    setSaveStatus("idle");
  }, []);

  useEffect(() => {
    if (saveStatus !== "idle" || !latestRef.current) return;

    const timer = window.setTimeout(() => {
      const latest = latestRef.current;
      if (latest) void persist(latest.name, latest.document);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [persist, saveStatus]);

  const manualSave = useCallback(async (name: string, document: ProjectDocument) => {
    latestRef.current = { name, document };
    await persist(name, document);
  }, [persist]);

  if (session.isPending) {
    return <LoadingCard label="Opening Neurix" />;
  }

  if (!session.data) {
    return <LoadingCard label="Taking you to sign in" />;
  }

  if (data === undefined || !initialDocument) {
    return <LoadingCard label="Loading project" />;
  }

  return (
    <NeurixEditor
      initialName={data.project.name}
      initialDocument={initialDocument}
      saveStatus={saveStatus}
      onChange={handleChange}
      onSave={manualSave}
    />
  );
}

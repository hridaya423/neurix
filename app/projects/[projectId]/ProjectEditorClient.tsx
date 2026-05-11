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
    cloudVariables: value.cloudVariables,
    variables: value.variables,
    lists: value.lists,
    variableWatchers: value.variableWatchers,
    listWatchers: value.listWatchers,
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
  const generateSoundUploadUrl = useMutation(api.projects.generateSoundUploadUrl);
  const touchProject = useMutation(api.projects.touchProject);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const latestRef = useRef<{ name: string; document: ProjectDocument } | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const didHydrateRef = useRef(false);
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

  const soundStorageCacheRef = useRef(new Map<string, string>());

  const dataUrlToBlob = useCallback((dataUrl: string) => {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/^data:([^;]+);base64$/)?.[1] ?? "audio/wav";
    const binary = atob(base64 ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }, []);

  const prepareDocumentForSave = useCallback(async (document: ProjectDocument): Promise<ProjectDocument> => {
    const prepareSound = async (sound: NonNullable<ProjectDocument["stage"]["sounds"]>[number]) => {
      if (!sound.dataUrl?.startsWith("data:")) return { ...sound, dataUrl: "" };
      const cacheKey = `${sound.id}:${sound.dataUrl.length}:${sound.dataUrl.slice(0, 96)}:${sound.dataUrl.slice(-96)}`;
      let storageId = soundStorageCacheRef.current.get(cacheKey);
      if (!storageId) {
        const uploadUrl = await generateSoundUploadUrl({ projectId: convexProjectId });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": sound.dataFormat === "mp3" ? "audio/mpeg" : "audio/wav" },
          body: dataUrlToBlob(sound.dataUrl),
        });
        if (!response.ok) throw new Error("Could not upload sound asset.");
        storageId = (await response.json() as { storageId: string }).storageId;
        soundStorageCacheRef.current.set(cacheKey, storageId);
      }
      return { ...sound, storageId, dataUrl: "" };
    };

    const stageSounds = await Promise.all((document.stage.sounds ?? []).map(prepareSound));
    const sprites = await Promise.all(document.sprites.map(async (sprite) => ({
      ...sprite,
      sounds: await Promise.all((sprite.sounds ?? []).map(prepareSound)),
    })));
    return {
      ...document,
      stage: { ...document.stage, sounds: stageSounds },
      sprites,
    };
  }, [convexProjectId, dataUrlToBlob, generateSoundUploadUrl]);

  const persist = useCallback(async (name: string, document: ProjectDocument) => {
    setSaveStatus("saving");
    try {
      const documentForSave = await prepareDocumentForSave(document);
      await saveProject({ projectId: convexProjectId, name, document: documentForSave });
      lastSavedRef.current = JSON.stringify({ name, document });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [convexProjectId, prepareDocumentForSave, saveProject]);

  const handleChange = useCallback((name: string, document: ProjectDocument) => {
    const snapshot = JSON.stringify({ name, document });
    latestRef.current = { name, document };

    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      lastSavedRef.current = snapshot;
      setSaveStatus("saved");
      return;
    }

    if (snapshot === lastSavedRef.current) return;

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

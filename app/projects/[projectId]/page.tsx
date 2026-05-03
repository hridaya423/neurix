import ProjectEditorClient from "./ProjectEditorClient";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectEditorClient projectId={projectId} />;
}

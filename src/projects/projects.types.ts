export type ProjectExport = {
  url: string;
  size: number;
  createdAt: string;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  sourceType?: string;
  templateId: string;
  htmlUploadId?: string;
  htmlPath?: string;
  previewUrl?: string;
  data: Record<string, unknown>;
  video?: unknown;
  overlays?: unknown[];
  duration?: number;
  createdAt: string;
  updatedAt: string;
  lastOutput: string | null;
  exports: ProjectExport[];
};

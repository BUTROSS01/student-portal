import { apiClient } from "./client";

export interface DocumentSummary {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version?: number;
  status?: string;
  uploadedAt: string;
}

export async function uploadDocument(file: File, type: string, studentId?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  if (studentId) form.append("studentId", studentId);

  const { data } = await apiClient.post<DocumentSummary>("/documents", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listDocuments(params?: { studentId?: string; type?: string }) {
  const { data } = await apiClient.get<{ documents: DocumentSummary[] }>("/documents", { params });
  return data.documents;
}

/** Downloads a document via the authenticated API client and triggers a browser save, since a plain <a href> can't carry the Bearer token. */
export async function downloadDocument(id: string, fileName: string) {
  const response = await apiClient.get(`/documents/${id}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

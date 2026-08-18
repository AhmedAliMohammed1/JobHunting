"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, FileUp, LockKeyhole, RefreshCw, Trash2 } from "lucide-react";

type Document = {
  id: string;
  original_filename: string;
  size_bytes: number;
  parse_status: string;
  parse_error?: string | null;
  parsed_at?: string | null;
  created_at: string;
};

type UploadResponse = { document?: { id: string }; error?: string };

export function CvUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [message, setMessage] = useState("PDF and DOCX, up to 8 MB. Stored in a private user-scoped bucket.");
  const [processingId, setProcessingId] = useState<string>();

  const load = useCallback(async () => {
    const response = await fetch("/api/cv", { cache: "no-store" });
    const body = await response.json() as { documents?: Document[]; error?: string };
    if (response.ok) setDocuments(body.documents ?? []);
    else setMessage(body.error ?? "Could not load CVs.");
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function processDocument(id: string) {
    setProcessingId(id);
    setDocuments((current) => current.map((document) => document.id === id
      ? { ...document, parse_status: "PROCESSING", parse_error: null }
      : document));
    try {
      setMessage("Extracting text from your CV…");
      const parseResponse = await fetch(`/api/cv/${id}/process`, { method: "POST", cache: "no-store" });
      const parseBody = await parseResponse.json() as { error?: string };
      if (!parseResponse.ok) {
        await load();
        setMessage(parseBody.error ?? "CV text extraction failed. Try processing this CV again.");
        return;
      }

      setMessage("CV text extracted. Building your AI profile…");
      const profileResponse = await fetch(`/api/cv/${id}/profile`, { method: "POST", cache: "no-store" });
      const profileBody = await profileResponse.json() as { error?: string };
      await load();

      if (!profileResponse.ok) {
        setMessage(profileBody.error ?? "AI profile extraction failed. You can process the CV again.");
        return;
      }

      setMessage("CV processed successfully. Your profile now uses the AI-extracted CV facts while preserving your manual edits.");
    } catch {
      await load();
      setMessage("CV processing was interrupted. Try processing this CV again.");
    } finally {
      setProcessingId(undefined);
    }
  }

  async function upload(formData: FormData) {
    setMessage("Uploading and validating…");
    const response = await fetch("/api/cv/upload", { method: "POST", body: formData });
    const body = await response.json() as UploadResponse;
    if (!response.ok || !body.document?.id) {
      setMessage(body.error ?? "Upload failed.");
      return;
    }
    await load();
    await processDocument(body.document.id);
  }

  async function remove(id: string) {
    const response = await fetch(`/api/cv/${id}`, { method: "DELETE" });
    if (response.ok) {
      await load();
      setMessage("CV deleted from private storage.");
    } else setMessage("Could not delete that CV.");
  }

  return <div className="stacked-content">
    <form className="upload-card" action={upload}>
      <FileUp size={32} />
      <h2>Add a CV version</h2>
      <p role="status">{message}</p>
      <input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
      <button type="submit" disabled={Boolean(processingId)}>Upload securely</button>
      <small><LockKeyhole size={14} /> Never public. Access is user-scoped by row and storage policies.</small>
    </form>

    {documents.length ? <div className="application-list">{documents.map((document) => {
      const isProcessing = processingId === document.id || document.parse_status === "PROCESSING";
      return <article className="result-card" key={document.id}>
        <FileText />
        <div>
          <span className="source-label">{document.parse_status} · {(document.size_bytes / 1024).toFixed(1)} KB</span>
          <h2>{document.original_filename}</h2>
          <p>{isProcessing ? "Processing CV and building your AI profile…" : document.parse_error ? document.parse_error : document.parsed_at ? `Processed ${new Date(document.parsed_at).toLocaleString()}` : `Uploaded ${new Date(document.created_at).toLocaleString()}`}</p>
        </div>
        <button className="icon-button" type="button" aria-label={`Process ${document.original_filename}`} title={document.parse_status === "COMPLETE" ? "Refresh profile from CV" : "Process CV"} disabled={isProcessing || Boolean(processingId && processingId !== document.id)} onClick={() => processDocument(document.id)}><RefreshCw className={isProcessing ? "spin" : undefined} size={16} /></button>
        <button className="icon-button" type="button" aria-label={`Delete ${document.original_filename}`} onClick={() => remove(document.id)} disabled={isProcessing || Boolean(processingId)}><Trash2 size={16} /></button>
      </article>;
    })}</div> : null}
  </div>;
}

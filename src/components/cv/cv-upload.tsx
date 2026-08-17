"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, FileUp, LockKeyhole, Trash2 } from "lucide-react";

type Document = { id: string; original_filename: string; size_bytes: number; parse_status: string; created_at: string };
export function CvUpload() {
  const [documents, setDocuments] = useState<Document[]>([]); const [message, setMessage] = useState("PDF and DOCX, up to 8 MB. Stored in a private user-scoped bucket.");
  const load = useCallback(async () => { const response = await fetch("/api/cv"); const body = await response.json() as { documents?: Document[]; error?: string }; if (response.ok) setDocuments(body.documents ?? []); else setMessage(body.error ?? "Could not load CVs."); }, []);
  useEffect(() => { void fetch("/api/cv").then(async (response) => ({ response, body: await response.json() as { documents?: Document[]; error?: string } })).then(({ response, body }) => { if (response.ok) setDocuments(body.documents ?? []); else setMessage(body.error ?? "Could not load CVs."); }); }, []);
  async function upload(formData: FormData) { setMessage("Uploading and validating…"); const response = await fetch("/api/cv/upload", { method: "POST", body: formData }); const body = await response.json() as { error?: string }; setMessage(response.ok ? "Upload complete. The private file is ready for the configured document-parsing worker." : body.error ?? "Upload failed."); if (response.ok) await load(); }
  async function remove(id: string) { const response = await fetch(`/api/cv/${id}`, { method: "DELETE" }); if (response.ok) { await load(); setMessage("CV deleted from private storage."); } else setMessage("Could not delete that CV."); }
  return <div className="stacked-content"><form className="upload-card" action={upload}><FileUp size={32} /><h2>Add a CV version</h2><p role="status">{message}</p><input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /><button type="submit">Upload securely</button><small><LockKeyhole size={14} /> Never public. Access is user-scoped by row and storage policies.</small></form>{documents.length ? <div className="application-list">{documents.map((document) => <article className="result-card" key={document.id}><FileText /><div><span className="source-label">{document.parse_status} · {(document.size_bytes / 1024).toFixed(1)} KB</span><h2>{document.original_filename}</h2><p>Uploaded {new Date(document.created_at).toLocaleString()}</p></div><button className="icon-button" type="button" aria-label={`Delete ${document.original_filename}`} onClick={() => remove(document.id)}><Trash2 size={16} /></button></article>)}</div> : null}</div>;
}

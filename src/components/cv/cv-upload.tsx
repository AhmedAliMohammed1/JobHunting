"use client";

import { useState } from "react";
import { FileUp, LockKeyhole } from "lucide-react";

export function CvUpload() {
  const [message, setMessage] = useState("PDF and DOCX, up to 8 MB. Stored in a private user-scoped bucket.");
  async function upload(formData: FormData) {
    const response = await fetch("/api/cv/upload", { method: "POST", body: formData });
    const body = await response.json();
    setMessage(response.ok ? "Upload complete. Parsing is queued; extracted facts remain editable." : body.error ?? "Upload failed.");
  }
  return <form className="upload-card" action={upload}><FileUp size={32} /><h2>Add a CV version</h2><p>{message}</p><input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /><button type="submit">Upload securely</button><small><LockKeyhole size={14} /> Never public. Download access uses authenticated, short-lived requests.</small></form>;
}

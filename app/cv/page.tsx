import { SectionShell } from "@/src/components/dashboard/section-shell";
import { CvUpload } from "@/src/components/cv/cv-upload";
export default function Page(){return <SectionShell eyebrow="Documents" title="Versioned CVs, private by default." description="Upload validated files to private storage and track their parsing status without exposing candidate data."><CvUpload /></SectionShell>}

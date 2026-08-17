import type { ApplicationField, ApplicationState } from "@/src/types/applications";

export interface ApplicationTask {
  id: string;
  applicationUrl: string;
  dryRun: boolean;
  fields: ApplicationField[];
}

export interface ApplicationProviderResult {
  state: ApplicationState;
  evidence?: { finalUrl?: string; confirmationText?: string; screenshotKey?: string };
  message?: string;
}

export interface ApplicationProvider {
  id: string;
  supports(url: URL): boolean;
  analyze(task: ApplicationTask): Promise<ApplicationProviderResult>;
  submit(task: ApplicationTask): Promise<ApplicationProviderResult>;
}

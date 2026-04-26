export type JobSource = "ashby" | "greenhouse" | "lever";

export interface JobRecord {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string | null;
  source: JobSource;
  postedAt: string;
  snapshotUrl: null;
}

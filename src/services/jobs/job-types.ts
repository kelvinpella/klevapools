export type JobListing = {
  id: string;
  createdAt: string;
  title: string | null;
  description: string | null;
  area: string | null;
  budget: number | null;
  jobImage: string | null;
  reviewed: boolean | null;
  skills: string[];
  posterPhone: string | null;
};

export type JobPage = {
  jobs: JobListing[];
  hasMore: boolean;
};

export const JOB_PAGE_SIZE = 9;
export const JOB_FETCH_SIZE = JOB_PAGE_SIZE + 1;

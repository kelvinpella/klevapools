import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JOB_FETCH_SIZE,
  JOB_PAGE_SIZE,
  type JobListing,
  type JobPage,
} from "./job-types.js";
import { getJobsClient } from "./supabase-client.js";

type JobRow = {
  id: string;
  created_at: string;
  title: string | null;
  description: string | null;
  budget: number | null;
  skills: string[] | null;
  created_by_phone: string | null;
};

export type JobsDataSource = {
  listJobs: (offset: number) => Promise<JobPage>;
  searchJobs: (keyword: string, offset: number) => Promise<JobPage>;
  getJobById: (id: string) => Promise<JobListing | null>;
};

let dataSourceOverride: JobsDataSource | null = null;

// Internal seam for tests: handler code paths call through here.
export function setJobsDataSource(source: JobsDataSource | null): void {
  dataSourceOverride = source;
}

function toListing(row: JobRow): JobListing {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    description: row.description,
    budget: row.budget,
    skills: row.skills ?? [],
    posterPhone: row.created_by_phone,
  };
}

function toPage(rows: JobRow[]): JobPage {
  const hasMore = rows.length > JOB_PAGE_SIZE;
  return { jobs: rows.slice(0, JOB_PAGE_SIZE).map(toListing), hasMore };
}

function baseQuery(client: SupabaseClient, offset: number) {
  return client
    .from("jobs")
    .select("id,created_at,title,description,budget,skills,created_by_phone")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + JOB_FETCH_SIZE - 1);
}

function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[%\\,{}\"]/g, "").trim().slice(0, 80);
}

export async function listJobs(
  offset: number,
  client?: SupabaseClient,
): Promise<JobPage> {
  if (dataSourceOverride) return dataSourceOverride.listJobs(offset);
  const { data, error } = await baseQuery(
    client ?? getJobsClient(),
    Math.max(0, offset),
  );
  if (error) throw new Error("Job list query failed", { cause: error });
  return toPage((data ?? []) as JobRow[]);
}

export async function searchJobs(
  keyword: string,
  offset: string | number,
  client?: SupabaseClient,
): Promise<JobPage> {
  const clean = sanitizeKeyword(keyword);
  const start = Math.max(0, Number(offset) || 0);
  if (dataSourceOverride) return dataSourceOverride.searchJobs(keyword, start);
  if (!clean) return { jobs: [], hasMore: false };
  const pattern = `%${clean}%`;
  const textOnly = `title.ilike.${pattern},description.ilike.${pattern}`;
  const withSkills = `${textOnly},skills.cs.{${clean}}`;
  const run = async (orFilter: string) =>
    baseQuery(client ?? getJobsClient(), start).or(orFilter);
  const first = await run(withSkills);
  if (!first.error) return toPage((first.data ?? []) as JobRow[]);
  // Array-operator inside OR can be rejected on some PostgREST versions;
  // fall back to text fields only rather than failing the menu.
  const retry = await run(textOnly);
  if (retry.error) {
    throw new Error("Job search query failed", { cause: retry.error });
  }
  return toPage((retry.data ?? []) as JobRow[]);
}

export async function getJobById(
  id: string,
  client?: SupabaseClient,
): Promise<JobListing | null> {
  if (dataSourceOverride) return dataSourceOverride.getJobById(id);
  const { data, error } = await (client ?? getJobsClient())
    .from("jobs")
    .select("id,created_at,title,description,budget,skills,created_by_phone")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Job lookup failed", { cause: error });
  return data ? toListing(data as JobRow) : null;
}

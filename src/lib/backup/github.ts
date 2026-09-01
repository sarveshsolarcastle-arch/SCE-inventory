/* -------------------------------------------------------------------------
 * Reading the nightly backups back out of GitHub.
 *
 * The nightly workflow (.github/workflows/backup.yml) commits each dump to
 * the `backups` branch of this repo. This module is the read side: it lists
 * what is there and fetches one file's contents, using a read-only,
 * fine-grained token (GITHUB_BACKUP_TOKEN) scoped to this repo only.
 *
 * GitHub, not a storage bucket, is the "free forever, no new account"
 * choice — the repo already exists and the app can read it back directly,
 * which is what lets the Backups page offer "restore from the latest
 * backup" without anyone hunting for a file.
 * ---------------------------------------------------------------------- */

const OWNER = "sarveshsolarcastle-arch";
const REPO = "SCE-inventory";
const BRANCH = "backups";
const FILENAME_PATTERN = /^inventory-\d{4}-\d{2}-\d{2}\.sql$/;

export type BackupEntry = {
  name: string;
  /** YYYY-MM-DD, parsed from the filename. */
  date: string;
  size: number;
};

function token(): string {
  const value = process.env.GITHUB_BACKUP_TOKEN;
  if (!value) {
    throw new Error(
      "GITHUB_BACKUP_TOKEN is not set — the Backups page has no way to reach GitHub. " +
        "See .env.example.",
    );
  }
  return value;
}

async function githubApi(path: string, accept: string): Promise<Response> {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
}

/** Newest backups first. Empty (not an error) if the `backups` branch has
 * never been created — i.e. the nightly job has not run yet. */
export async function listBackups(): Promise<BackupEntry[]> {
  const res = await githubApi(`/contents/?ref=${BRANCH}`, "application/vnd.github+json");
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`GitHub returned ${res.status} listing backups`);
  }

  const entries = (await res.json()) as Array<{ name: string; size: number }>;
  return entries
    .filter((entry) => FILENAME_PATTERN.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      date: entry.name.replace(/^inventory-/, "").replace(/\.sql$/, ""),
      size: entry.size,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Fetches one backup's raw SQL text. `name` must be exactly a filename
 * returned by listBackups — validated again here since it may originate
 * from a form submission. */
export async function fetchBackup(name: string): Promise<string> {
  if (!FILENAME_PATTERN.test(name)) {
    throw new Error("Invalid backup filename");
  }
  // The raw media type avoids the base64 contents-API response and its
  // ~1MB practical size ceiling.
  const res = await githubApi(`/contents/${name}?ref=${BRANCH}`, "application/vnd.github.raw+json");
  if (!res.ok) {
    throw new Error(`GitHub returned ${res.status} fetching ${name}`);
  }
  return res.text();
}

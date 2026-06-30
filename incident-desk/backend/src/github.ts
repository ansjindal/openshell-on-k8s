/** GitHub REST API (PAT from the github-pat Secret) — used by the GitOps incident to commit the
 *  fault to main (trigger) and to open a fix PR (human-approved remediation). */
const API = "https://api.github.com";
const OWNER = process.env.GITHUB_OWNER ?? "ansjindal";
const REPO = process.env.GITHUB_REPO ?? "openshell-incident-gitops";
const pat = () => process.env.GITHUB_PAT ?? "";
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

async function gh(method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${pat()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`github ${method} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? {} : r.json();
}

export function ghConfigured(): boolean { return !!pat(); }

async function getFile(path: string, ref = "main"): Promise<{ content: string; sha: string }> {
  const j = await gh("GET", `/repos/${OWNER}/${REPO}/contents/${path}?ref=${ref}`);
  return { content: Buffer.from(j.content, "base64").toString("utf8"), sha: j.sha };
}

/** Commit new file content directly to main (used to inject/clear the fault). */
export async function commitToMain(path: string, content: string, message: string): Promise<void> {
  const { sha } = await getFile(path, "main");
  await gh("PUT", `/repos/${OWNER}/${REPO}/contents/${path}`, { message, content: b64(content), sha, branch: "main" });
}

/** Open a PR on a new branch that sets the file to `content`. Returns the PR html_url + number. */
export async function openFixPR(path: string, content: string, branch: string, title: string, prBody: string): Promise<{ url: string; number: number }> {
  const mainRef = await gh("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  const baseSha = mainRef.object.sha;
  try { await gh("POST", `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha }); }
  catch { /* branch may already exist — reuse it */ }
  const { sha } = await getFile(path, "main");
  await gh("PUT", `/repos/${OWNER}/${REPO}/contents/${path}`, { message: title, content: b64(content), sha, branch });
  const pr = await gh("POST", `/repos/${OWNER}/${REPO}/pulls`, { title, head: branch, base: "main", body: prBody });
  return { url: pr.html_url, number: pr.number };
}

/** Open a PR applying multiple file edits (full content, or find/replace on the current file). */
export async function openMultiFilePR(branch: string, title: string, prBody: string, edits: { path: string; find?: string; replace?: string; content?: string }[]): Promise<{ url: string; number: number }> {
  const mainRef = await gh("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  try { await gh("POST", `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/heads/${branch}`, sha: mainRef.object.sha }); }
  catch { /* branch may already exist */ }
  for (const e of edits) {
    const f = await getFile(e.path, branch); // branch was created from main → current content + sha
    const content = e.content ?? (e.find != null ? f.content.split(e.find).join(e.replace ?? "") : f.content);
    await gh("PUT", `/repos/${OWNER}/${REPO}/contents/${e.path}`, { message: title, content: b64(content), sha: f.sha, branch });
  }
  const pr = await gh("POST", `/repos/${OWNER}/${REPO}/pulls`, { title, head: branch, base: "main", body: prBody });
  return { url: pr.html_url, number: pr.number };
}

/** Merge a PR (used by autopilot — hands-off remediation). */
export async function mergePR(number: number): Promise<void> {
  await gh("PUT", `/repos/${OWNER}/${REPO}/pulls/${number}/merge`, { merge_method: "merge" });
}

/** Current main content of a file (for the "changes" investigator). */
export async function readMainFile(path: string): Promise<string> {
  try { return (await getFile(path, "main")).content; } catch (e) { return `(could not read ${path}: ${String(e)})`; }
}

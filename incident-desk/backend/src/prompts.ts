import type { SourceKind } from "./types.js";

/**
 * Shell scripts run INSIDE a sandbox via `sandbox exec` for the RCA use case.
 *
 * Each script prints parsable sections the orchestrator turns into timeline steps:
 *   === EGRESS ===     "<ALLOW|DENY> <full-url> <binary> <method> <code-or-reason>"
 *   === USAGE ===      one JSON line {prompt,completion,total} + a "TIME <seconds>" line
 *   === THINKING ===   model reasoning_content (chain-of-thought), when thinking is on
 *   === RESULT ===     the model's final answer (message.content; reasoning stripped)
 */

const OFFLIST = process.env.OFFLIST_HOST ?? "https://api.openai.com";
// Vendor-advisory enrichment stand-in on the gateway's egress allowlist. Reachable ONLY when the
// investigator's posture permits it (strict denies; balanced/open allow) — the live hot-reload demo.
const ADVISORY = process.env.ADVISORY_URL ?? "https://www.nvidia.com/en-us/security/";

const TASK_MODE = process.env.TASK_MODE ?? "inference";
const AGENT_CMD = process.env.AGENT_CMD ?? "claude";
const INFERENCE_MODEL = process.env.INFERENCE_MODEL ?? "meta/llama-3.3-70b-instruct";
const INFERENCE_URL = "https://inference.local/v1/chat/completions";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** The model/agent call: records the inference egress, token usage, reasoning, and the answer. */
function taskCall(opts: { thinking?: boolean } = {}): string {
  if (TASK_MODE === "agent") {
    return [
      `echo "ALLOW agent-cli://${AGENT_CMD} ${AGENT_CMD} RUN local"`,
      'echo "=== USAGE ==="', 'echo "{}"', 'echo "TIME 0"',
      'echo "=== THINKING ==="', 'echo "(agent-cli mode: reasoning is in the sandbox logs)"',
      'echo "=== RESULT ==="',
      'SRC="$(cat /tmp/src.txt 2>/dev/null | head -c 8000)"',
      `printf '%s\\n\\nEVIDENCE:\\n%s' "$PROMPT" "$SRC" | ${AGENT_CMD} -p 2>/dev/null || echo "AGENT_ERROR"`,
    ].join("\n");
  }
  const think = opts.thinking ? "detailed thinking on" : "detailed thinking off";
  // Reasoning models (e.g. nemotron-super) spend most of the budget inside <think> before the
  // answer; 3000/1500 leaves nothing for the final content on the bigger (synthesis) prompts →
  // empty `content` → "model returned no content". Give generous headroom; env-tunable.
  const maxTokens = parseInt(process.env.INFERENCE_MAX_TOKENS || (opts.thinking ? "8000" : "4000"), 10);
  return [
    `export MODEL="${INFERENCE_MODEL}"`,
    `export THINK="${think}"`,
    `python3 -c "import json,os; src=open('/tmp/src.txt',encoding='utf-8',errors='ignore').read()[:6000] if os.path.exists('/tmp/src.txt') else ''; json.dump({'model':os.environ['MODEL'],'messages':[{'role':'system','content':os.environ['THINK']},{'role':'user','content':os.environ['PROMPT']+chr(10)+'EVIDENCE:'+chr(10)+src}],'max_tokens':${maxTokens},'temperature':0.2}, open('/tmp/req.json','w'))"`,
    'KEY="${OPENAI_API_KEY:-$CUSTOM_API_KEY}"',
    `R=$(curl -sS -m 200 -k -o /tmp/resp.json -w "%{http_code} %{time_total}" ${INFERENCE_URL} -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d @/tmp/req.json 2>/dev/null || true)`,
    'CODE=$(echo "$R" | awk "{print \\$1}"); TT=$(echo "$R" | awk "{print \\$2}")',
    `echo "ALLOW ${INFERENCE_URL} curl POST \${CODE:-000}"`,
    'echo "=== USAGE ==="',
    `python3 -c "import json; u=(json.load(open('/tmp/resp.json')).get('usage') or {}); print(json.dumps({'prompt':u.get('prompt_tokens'),'completion':u.get('completion_tokens'),'total':u.get('total_tokens')}))" 2>/dev/null || echo "{}"`,
    'echo "TIME ${TT:-0}"',
    'echo "=== THINKING ==="',
    `python3 -c "import json; m=json.load(open('/tmp/resp.json')).get('choices',[{}])[0].get('message',{}); print((m.get('reasoning_content') or '').strip())" 2>/dev/null || true`,
    'echo "=== RESULT ==="',
    `python3 -c "import json,re; m=json.load(open('/tmp/resp.json')).get('choices',[{}])[0].get('message',{}); c=(m.get('content') or '').strip(); r=(m.get('reasoning_content') or '').strip(); out=c or r; out=re.sub(r'<think>.*?</think>','',out,flags=re.S|re.I).strip(); print(out or 'TASK_ERROR')" 2>/dev/null || echo "TASK_PARSE_ERROR"`,
  ].join("\n");
}

/**
 * Triage (coordinator): read the incident symptoms, form one hypothesis per available evidence
 * source. Prints "=== RESULT ===" then a JSON array [{"source","hypothesis"}].
 */
export function buildTriageScript(symptoms: string, sources: SourceKind[]): string {
  const prompt = `You are the incident triage coordinator. Given the incident symptoms, produce ONE investigation hypothesis for EACH available evidence source, to be handed to an investigator that can only read that source. Sources available: ${sources.join(", ")}. Symptoms: "${symptoms}". Output ONLY a compact JSON array, one object per source, e.g. [{"source":"logs","hypothesis":"<what to check in logs and why>"}]. Use exactly these source names. No prose, no markdown, no code fences.`;
  return [
    ": > /tmp/src.txt",
    `export PROMPT="$(printf %s '${b64(prompt)}' | base64 -d)"`,
    'echo "=== EGRESS ==="',
    taskCall({ thinking: true }),
  ].join("\n");
}

/**
 * Investigator: authorized (in-band) for ONE evidence source — the evidence is injected, so the
 * agent always has its data. Its EGRESS POLICY governs external enrichment: it probes a vendor
 * advisory (allowlisted host, ALLOWED only when posture permits — the live hot-reload demo) and an
 * off-list host (always DENIED by default-deny). Then it reasons over the evidence + any enrichment.
 */
export function buildInvestigatorScript(source: SourceKind, hypothesis: string, evidence: string): string {
  const prompt = `You are an incident investigator authorized for the "${source}" evidence. Hypothesis to test: "${hypothesis}". Using the EVIDENCE below, write 3-5 concise Markdown bullets (each starting with "- "): the key signals you see (with concrete values/timestamps), whether they support or refute the hypothesis, and a pointer to the likely cause. If the vendor-advisory lookup was allowed, you may add one enrichment note; if it was blocked by policy, ignore it. Output only the bullets.`;
  return [
    "set -u",
    `export PROMPT="$(printf %s '${b64(prompt)}' | base64 -d)"`,
    // evidence is injected (authorized in-band), not fetched over the policy-restricted network
    `printf %s '${b64(evidence)}' | base64 -d > /tmp/src.txt`,
    `ADVISORY="${ADVISORY}"`,
    `OFFLIST="${OFFLIST}"`,
    // the L7 proxy denies a blocked host with connection-refused (000) or a blocked path with 403
    'denied(){ [ "$1" = "000" ] || [ "$1" = "403" ] || [ -z "$1" ]; }',
    'echo "=== EGRESS ==="',
    // vendor advisory enrichment — DENY under strict, ALLOW once a human loosens the posture
    'c=$(curl -sS -m 12 -o /tmp/adv -w "%{http_code}" "$ADVISORY" 2>/dev/null || true)',
    `if denied "$c"; then echo "DENY $ADVISORY curl GET blocked-by-policy($c)"; else echo "ALLOW $ADVISORY curl GET $c"; printf '\\n--- vendor advisory (enrichment) ---\\n' >> /tmp/src.txt; head -c 800 /tmp/adv >> /tmp/src.txt; fi`,
    // off-list negative control — always DENY under default-deny
    'c=$(curl -sS -m 8 -o /dev/null -w "%{http_code}" "$OFFLIST" 2>/dev/null || true)',
    'if denied "$c"; then echo "DENY $OFFLIST curl GET blocked-by-policy"; else echo "ALLOW $OFFLIST curl GET $c"; fi',
    taskCall({ thinking: true }),
  ].join("\n");
}

/** Synthesizer: correlate approved findings into a root cause + remediation runbook (Markdown). */
export function buildSynthScript(title: string, symptoms: string, findings: { source: string; summary: string }[]): string {
  const blocks = findings.map((f) => `### Finding from ${f.source}\n${f.summary}`).join("\n\n");
  const prompt = `You are the incident commander writing the post-incident RCA for "${title}". Symptoms: "${symptoms}". Correlate the investigator findings below into a single conclusion. Output ONLY Markdown with EXACTLY these sections and headings: "# Incident RCA — ${title}", "## Summary" (2-3 sentences), "## Root cause" (the single most likely cause, justified by the correlated evidence), "## Evidence" (bullet the key signal from each source), "## Remediation runbook" (a numbered list of concrete steps to resolve now), "## Prevention" (2-3 bullets to stop recurrence). No code fences, no extra commentary. Do not invent evidence not in the findings.`;
  return [
    `export PROMPT="$(printf %s '${b64(prompt)}' | base64 -d)"`,
    `printf %s '${b64(blocks)}' | base64 -d > /tmp/src.txt`,
    'echo "=== EGRESS ==="',
    taskCall({ thinking: false }),
  ].join("\n");
}

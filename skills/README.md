# Platform skills

[Agent Skills](https://agentskills.io/specification): one folder per skill, each
with a `SKILL.md` (YAML frontmatter + instructions) and optional `references/`,
`scripts/` and `assets/`. Any harness that follows the standard (pi,
Claude Code, Codex, Gemini CLI, OpenCode, Goose, …) can load them.

The lab serves this folder as the git repository `platform/skills` on the
in-cluster git server (`roles/19-skill-repo`); sandboxes clone it read-only into
`~/.agents/skills/platform`. Check a skill before you push it:

    ./scripts/skill-lint skills/<name>

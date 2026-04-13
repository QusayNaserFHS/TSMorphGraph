---
model_set: medium
---
# Create Commit

Create a git commit with a properly formatted message based on actual changes.

## Variables

issue_type: $1 (`feature`, `bug`, or `chore` — infer from changes if not provided)

## Instructions

- Generate a concise commit message in the format: `<type>: <message>`
- The `<type>` MUST be one of: `feat`, `fix`, `chore`
- The `<message>` should be:
  - Present tense ("add", "fix", "update")
  - 50 characters or less
  - Descriptive of the actual changes made
  - No period at the end
- Examples:
  - `feat: add directory grouping to force-graph nodes`
  - `fix: resolve force simulation freezing on cooldown`
  - `chore: update force-graph CDN to v1.47.3`
- Base the message on the actual diff content, not just file names.

## Workflow

1. Run `git status --short` to see what changed.
2. Run `git add -A` to stage all changes.
3. Run `git diff --staged --stat` to see per-file changes.
4. Run `git diff --staged` to read actual changes and understand what was done.
5. Run `git commit -m "<generated_commit_message>"` to create the commit.

## Report

Return ONLY a JSON object:

```json
{
  "commit_message": "feat: add user authentication"
}
```

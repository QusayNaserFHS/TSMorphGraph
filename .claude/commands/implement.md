---
model_set: high
---
# Implement

Follow the `Workflow` to implement the plan at `PATH_TO_PLAN` then `Report` the completed work.

## Variables

PATH_TO_PLAN: $1

## Instructions

- If `$1` is missing, print this and stop: `Usage: /implement <path to plan file>`
- Read `CLAUDE.md` from the project root for project context and conventions.
- Implement the plan top to bottom, in order. Do not skip any steps.
- After implementation, run validation to verify the work.
- If validation fails, fix issues before stopping.

## Workflow

1. Read the plan at `PATH_TO_PLAN`. Understand all tasks before starting.
2. For each step in the plan:
   - Read existing files before modifying them.
   - Follow existing code patterns in the project.
   - Implement the changes described.
3. After all steps are complete, verify:
   - Re-read the plan and check every step was completed.
   - Run `npm run analyze -- --repo ../GitNexus-CodeAtlas --base FETCH_HEAD --branch HEAD` to verify the analyzer still works.
   - Run `npm run generate` to verify test data generation still works.
   - Open generated HTML files to verify the viewer works.
4. If any step was missed, go back and complete it.

## Report

Only after ALL steps are verified complete:
- Completion checklist: list every step with pass/fail status
- Summarize the work in concise bullet points
- Report files and lines changed with `git diff --stat`

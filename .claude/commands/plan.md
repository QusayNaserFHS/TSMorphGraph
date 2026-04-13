---
model_set: high
---
# Plan

Create a new implementation plan for the `Issue` using the `Plan Format` below. Follow the `Instructions` to create the plan.

## Variables

issue_description: $1 (description of the task, feature, or bug to plan for)
issue_type: $2 (one of: `feature`, `bug`, `chore` — guess from description if not provided)

## Instructions

- If `$1` is missing, print this and stop: `Usage: /plan <issue description>`
- Read `CLAUDE.md` from the project root for project context and conventions.
- Read existing source files in `src/` to understand current patterns before planning changes.
- Assess the complexity of the issue as `simple`, `medium`, or `complex`.
- Save the plan to `docs/plans/plan-{task-name}.md` (create `docs/plans/` if needed).
- Follow existing patterns in the codebase — don't reinvent the wheel.
- Include code examples or pseudo-code where appropriate.
- Consider the data pipeline: git diff → ts-morph analysis → JSON → force-graph HTML.

## Workflow

1. Analyze Requirements — Parse the issue description to understand the core problem and desired outcome.
2. Explore Codebase — Read `src/analyze.ts`, `src/template.html`, `src/generate-test-data.ts` to understand current architecture.
3. Design Solution — Develop technical approach, identify which files need changes.
4. Document Plan — Write the plan following the format below.

## Plan Format

```markdown
# Plan: <title>

## Issue
<issue_type>: <one-line summary>

## Context
<what exists today and why this change is needed>

## Approach
<high-level technical approach>

## Relevant Files
### Modify
- `<path>` — <what changes>

### New Files
- `<path>` — <purpose>

## Step by Step Tasks
### 1. <task title>
<detailed description of what to do>

### 2. <task title>
<detailed description>

## Validation
- <how to verify the change works>

## Risks
- <anything that could go wrong>
```

## Report

After creating the plan, report:
- Plan saved to: `<path>`
- Summary of the approach in 2-3 bullet points
- Estimated complexity: simple/medium/complex

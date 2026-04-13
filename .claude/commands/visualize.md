---
model_set: medium
---
# Visualize

Run the analyzer against a git repo and open the resulting force-graph in the browser.

## Variables

repo_path: $1 (path to git repository — defaults to current directory)
base_branch: $2 (base branch to diff against — defaults to `main`)
target_branch: $3 (target branch — defaults to `HEAD`)

## Instructions

- If `$1` is missing, try the current directory. If not a git repo, print usage and stop: `Usage: /visualize <repo path> [base branch] [target branch]`
- Run the analyzer and open the output.

## Workflow

1. Verify `$1` is a git repository (has `.git/` directory).
2. Run `npm run analyze -- --repo $1 --base $2 --branch $3`.
3. Open `output/graph.html` in the browser.
4. Report the number of files and links found.

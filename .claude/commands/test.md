---
model_set: medium
---
# Run Test Suite

Execute validation tests to ensure the project is in a healthy state.

## Variables

TEST_COMMAND_TIMEOUT: 3 minutes

## Instructions

- Execute each test in sequence.
- If a test fails, stop and report the failure.
- Return ONLY a JSON array with test results.

## Test Execution Sequence

1. **TypeScript Check**
   - Command: `npx tsc --noEmit`
   - test_name: "type_check"
   - test_purpose: "Validates TypeScript types"

2. **Analyze (Real Repo)**
   - Command: `npm run analyze -- --repo ../GitNexus-CodeAtlas --base FETCH_HEAD --branch HEAD`
   - test_name: "analyze_real"
   - test_purpose: "Validates the analyzer works against a real git repo"

3. **Generate Test Data**
   - Command: `npm run generate`
   - test_name: "generate_data"
   - test_purpose: "Validates synthetic data generation"

4. **Output Files Exist**
   - Command: `test -f output/graph.html && test -f output/graph.json && test -f output/small.html && test -f output/medium.html && test -f output/huge.html && test -f output/impossible.html`
   - test_name: "output_files"
   - test_purpose: "Validates all expected output files were generated"

## Report

```json
[
  { "test_name": "type_check", "test_purpose": "...", "result": "passed|failed", "error": "..." }
]
```

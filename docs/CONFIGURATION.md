# Configuration

`agent-test` has one scan path: LLM-required functional acceptance. There is no basic/standard/deep/audit mode split.

The configuration contract is defined in [schemas/config.schema.json](../schemas/config.schema.json).

## Minimal Example

```json
{
  "project": {
    "target": ".",
    "type": "auto",
    "ignorePaths": []
  },
  "mode": {
    "name": "acceptance",
    "maxFiles": 1000
  },
  "llm": {
    "apiKeyEnv": "AGENT_TEST_LLM_API_KEY",
    "fallbackApiKeyEnv": "OPENAI_API_KEY",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-5-mini",
    "estimatedInputTokens": 30000,
    "estimatedOutputTokens": 6000,
    "inputUsdPer1M": 0,
    "outputUsdPer1M": 0,
    "maxCostUsd": 5
  },
  "profiles": ["auto"],
  "report": {
    "output": "reports/self/latest",
    "formats": ["md", "pdf", "json"]
  }
}
```

`md` produces the developer/agent report, `pdf` produces the concise non-technical decision report, and `json` preserves machine-readable evidence. PDF generation uses Playwright Chromium; run `npm run setup:browser` once after install if the browser runtime is missing.

## CLI Override Rules

CLI flags take precedence over configuration file values:

- `--target`
- `--out`
- `--max-files`
- `--ignore-path`

`--mode` is intentionally unsupported. The project has one acceptance mode, and it requires an LLM API key.

## API Keys And Cost

Before running `scan`, set an OpenAI-compatible key:

```powershell
$env:AGENT_TEST_LLM_API_KEY = "your_openai_compatible_key"
```

`scan` uses the LLM to read project evidence and generate a project-specific acceptance contract. This is required for complete functionality because layout rules, output-value rules, fallback expectations and cost-disclosure rules have to be inferred from the target project's own documentation.

Preflight always records estimated input/output tokens. If `llm.inputUsdPer1M` and `llm.outputUsdPer1M` are configured, preflight also estimates cost and fails before execution when the estimate exceeds `llm.maxCostUsd`. If prices are missing or zero, reports explicitly state that dollar cost is incomplete.

## UI Rule Generation

`scan` asks the LLM to derive any browser/UI checks from the target project's own documentation, user flows and visible surface. This includes obvious user-blocking layout problems such as hidden primary controls, overlapping or clipped content, broken scroll containers, blank first viewports, blocking overlays, and missing visible success/error/result feedback.

These UI checks are generated as part of the project-specific acceptance contract. They are not hard-coded product standards, and they do not change the project's functional-first weighting. Aesthetic preferences are out of scope unless the target project's documentation makes them functional requirements or they directly block the documented user flow.

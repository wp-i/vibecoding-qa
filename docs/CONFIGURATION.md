# Configuration

`agent-test` can run with CLI flags only, or with a JSON configuration file.

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
    "name": "basic",
    "llm": "no-llm",
    "maxCostUsd": 0,
    "maxFiles": 1000
  },
  "profiles": ["auto"],
  "report": {
    "output": "reports/self/latest",
    "formats": ["md", "json"]
  }
}
```

## CLI Override Rules

CLI flags take precedence over configuration file values:

- `--target`
- `--out`
- `--mode`
- `--ignore-path`

You can also pass the target as a positional scan argument:

```bash
node ./bin/agent-test.js scan . --out reports/latest
node ./bin/agent-test.js scan https://github.com/user/repo --out reports/repo
node ./bin/agent-test.js scan . --ignore-path docs/showcase --out reports/latest
```

## API Keys And Cost

The MVP supports `basic` mode with `mode.llm = "no-llm"`.

In this mode:

- no API key is required;
- no LLM call is made;
- preflight token estimate is 0;
- actual token usage is 0;
- preflight and actual cost are both `$0`.

Later modes must not silently run higher-cost or dynamic checks without explicit configuration, preflight token/cost estimate, required-key disclosure and actual usage reporting.

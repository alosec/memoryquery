# Testing Strategy Overview

## Active Testing Plan
**Primary Document**: See `streamlined-testing-plan.md` for the current implementation approach.

## Approach Philosophy
- **Non-interactive scripts** for both human and LLM execution
- **Simple CLI commands** with clear pass/fail output
- **Focus on core functionality** over comprehensive coverage
- **No external infrastructure** (no CI/CD, dashboards, or reporting systems)

## Quick Test Commands
```bash
# Run everything
npm test

# Test specific areas
npm run test:sync       # Sync daemon functionality
npm run test:mcp        # MCP tool queries  
npm run test:latency    # Measure sync performance
npm run test:integrity  # Data integrity checks
```

## Core Metrics
- **Sync works**: JSONL changes appear in database
- **MCP works**: Tools return correct data
- **Performance**: P50 < 500ms, P95 < 2s
- **Reliability**: Handles errors gracefully

---

*Note: The comprehensive testing plan below is preserved for reference but superseded by the streamlined approach.*

---


# Technical Debt Resolution Through Testing

## Priority Test Implementation Order

### Critical Path 1: Sync Latency Validation
**Why First**: This is the core metric that determines system success

#### Implementation Steps:
1. Create `src/sync-daemon/__tests__/integration/latency-benchmark.test.ts`
2. Instrument existing code with timing measurements
3. Generate realistic test data (100-1000 messages)
4. Measure end-to-end latency from file write to DB query
5. Identify bottlenecks in the pipeline

#### Expected Outcomes:
- Baseline latency measurements
- Performance bottleneck identification
- Optimization targets defined

### Critical Path 2: Type Safety Audit
**Why Second**: Prevents runtime errors and improves maintainability

#### Test Files to Create:
```typescript
// src/__tests__/type-safety/type-audit.test.ts
describe('Type Safety Audit', () => {
  test('CLI has no any types', () => {
    // Audit src/cli/index.ts for any types
  });
  
  test('MCP server has proper types', () => {
    // Check server instance types
  });
  
  test('Config objects are properly typed', () => {
    // Verify SyncConfig and ServerConfig interfaces
  });
});
```

#### Resolution Actions:
1. Replace `any` with proper interfaces:
   - `mcpServer: any` → `mcpServer: MemoryServer`
   - `promises: Promise<any>[]` → `promises: Promise<void>[]`
   - Config objects → Dedicated interfaces

### Critical Path 3: Configuration Consolidation
**Why Third**: Reduces bugs from inconsistent configuration

#### Test Implementation:
```typescript
// src/__tests__/integration/configuration.test.ts
describe('Configuration Management', () => {
  test('all components use same DB path', () => {
    // Verify SIMPLE_MEMORY_DB_PATH is respected
  });
  
  test('environment variables override defaults', () => {
    // Test each component's env var handling
  });
  
  test('hardcoded paths are eliminated', () => {
    // Scan for any remaining hardcoded paths
  });
});
```

#### Configuration Module Design:
```typescript
// src/shared/config.ts
export class ConfigManager {
  private static instance: ConfigManager;
  
  getDbPath(): string;
  getProjectsPath(): string;
  getLogLevel(): string;
  validate(): ConfigValidationResult;
}
```

### Critical Path 4: TODO Resolution Tracking
**Why Fourth**: Ensures all known issues are addressed

#### Automated TODO Scanner:
```typescript
// src/__tests__/quality/todo-tracker.test.ts
describe('TODO Tracking', () => {
  test('all TODOs have associated issues', () => {
    // Scan codebase for TODO comments
    // Verify each has GitHub issue or resolution plan
  });
  
  test('no critical TODOs in production paths', () => {
    // Ensure main execution paths have no TODOs
  });
});
```

## Test Implementation Checklist

### Week 1 - Foundation
- [ ] Set up Vitest configuration
- [ ] Create test directory structure
- [ ] Generate test data fixtures
- [ ] Implement latency measurement framework
- [ ] Write first latency benchmark test

### Week 2 - Core Components
- [ ] Parser unit tests (malformed JSONL handling)
- [ ] Database transaction tests
- [ ] Type safety audit and fixes
- [ ] Configuration consolidation tests

### Week 3 - Integration
- [ ] End-to-end sync pipeline tests
- [ ] MCP query accuracy tests
- [ ] Service coordination tests
- [ ] Error recovery scenarios

### Week 4 - Performance & Polish
- [ ] Performance profiling setup
- [ ] Memory leak detection
- [ ] CI/CD pipeline configuration
- [ ] Test report generation

## Specific Technical Debt Tests

### 1. Database Path Consistency Test
```typescript
test('database path consistency', async () => {
  const envPath = '/custom/path/mcp.db';
  process.env.SIMPLE_MEMORY_DB_PATH = envPath;
  
  // Start services
  const mcp = await createMemoryServer();
  const sync = await startSyncDaemon();
  
  // Verify both use same path
  expect(mcp.getDbPath()).toBe(envPath);
  expect(sync.getDbPath()).toBe(envPath);
  
  // Verify no hardcoded Claude Code paths
  const codebase = await scanCodebase();
  expect(codebase).not.toContain('.claude/claude-code.db');
});
```

### 2. Type Safety Validation Test
```typescript
test('no any types in critical paths', async () => {
  const tsConfig = await loadTsConfig();
  const program = ts.createProgram(files, tsConfig);
  const checker = program.getTypeChecker();
  
  const anyUsages = findAnyTypes(checker);
  expect(anyUsages).toHaveLength(0);
});
```

### 3. Environment Variable Consolidation Test
```typescript
test('centralized configuration', () => {
  const config = new ConfigManager();
  
  // Test default values
  expect(config.getDbPath()).toMatch(/simple-memory\/mcp.db$/);
  
  // Test env override
  process.env.SIMPLE_MEMORY_DB_PATH = '/test/path.db';
  config.reload();
  expect(config.getDbPath()).toBe('/test/path.db');
  
  // Test validation
  const validation = config.validate();
  expect(validation.isValid).toBe(true);
});
```

## Quick Wins - Immediate Tests to Implement

### 1. Basic Smoke Test
```typescript
// src/__tests__/smoke.test.ts
describe('Smoke Tests', () => {
  test('project builds without errors', async () => {
    const result = await exec('npm run build');
    expect(result.exitCode).toBe(0);
  });
  
  test('CLI shows help', async () => {
    const result = await exec('node dist/cli/index.js --help');
    expect(result.stdout).toContain('simple-memory');
  });
});
```

### 2. JSONL Parser Edge Cases
```typescript
// src/sync-daemon/__tests__/unit/parser-edge-cases.test.ts
describe('JSONL Parser Edge Cases', () => {
  test('handles empty lines', () => {
    const input = '\n\n{"type":"message"}\n\n';
    const result = parseJSONL(input);
    expect(result).toHaveLength(1);
  });
  
  test('handles BOM characters', () => {
    const input = '\uFEFF{"type":"message"}';
    const result = parseJSONL(input);
    expect(result).toHaveLength(1);
  });
  
  test('recovers from malformed JSON', () => {
    const input = '{"broken\n{"type":"message"}\n';
    const result = parseJSONL(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('message');
  });
});
```

### 3. Database Lock Contention Test
```typescript
// src/sync-daemon/__tests__/integration/lock-contention.test.ts
describe('Database Lock Contention', () => {
  test('handles concurrent writes gracefully', async () => {
    const writes = Array(10).fill(0).map((_, i) => 
      writeToDatabase({ messageId: `msg-${i}` })
    );
    
    const results = await Promise.allSettled(writes);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    expect(successful.length).toBeGreaterThan(0);
    // All should eventually succeed with retries
  });
});
```

## Metrics Collection Framework

### Latency Tracking Implementation
```typescript
// src/shared/metrics.ts
export class MetricsCollector {
  private latencies: SyncLatencyMetric[] = [];
  
  recordSyncStart(fileId: string): void;
  recordParseComplete(fileId: string): void;
  recordDatabaseWrite(fileId: string): void;
  recordSyncComplete(fileId: string): void;
  
  getMetrics(): {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    bottlenecks: Map<string, number>;
  };
}
```

### Test Runner Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/test-utils/**'],
    },
    setupFiles: ['./test-setup.ts'],
    testTimeout: 30000, // For integration tests
    hookTimeout: 30000,
  },
});
```

## Test Data Fixtures

### Generate Realistic Test Data
```typescript
// src/__tests__/fixtures/generate-test-data.ts
export function generateConversation(options: {
  messageCount: number;
  projectName: string;
  includeToolUse?: boolean;
}): string {
  const messages = [];
  
  for (let i = 0; i < options.messageCount; i++) {
    messages.push({
      id: `msg-${i}`,
      type: 'message',
      timestamp: new Date().toISOString(),
      user_text: `User message ${i}`,
      assistant_text: `Assistant response ${i}`,
      project_name: options.projectName,
    });
    
    if (options.includeToolUse && i % 3 === 0) {
      messages.push({
        id: `tool-${i}`,
        type: 'tool_use',
        tool_name: 'read_file',
        parameters: { path: `/test/file${i}.ts` },
      });
    }
  }
  
  return messages.map(m => JSON.stringify(m)).join('\n');
}
```

## Success Metrics

### Test Coverage Goals
- **Unit Tests**: 80% coverage minimum
- **Integration Tests**: All critical paths covered
- **Type Safety**: 0 `any` types in production code
- **Configuration**: 100% environment variable coverage

### Performance Benchmarks
- **Sync Latency P50**: <500ms ✅
- **Sync Latency P95**: <2s ✅
- **Database Query Time**: <10ms ✅
- **Memory per Service**: <50MB ✅

### Code Quality Metrics
- **TODO Comments**: All tracked with issues
- **Type Coverage**: 100% of public APIs typed
- **Hardcoded Paths**: 0 instances
- **Test Execution Time**: <2 minutes for unit tests

## Next Steps

1. **Immediate**: Create test directory structure
2. **Today**: Write first latency benchmark test
3. **This Week**: Implement parser and database unit tests
4. **Next Week**: Full integration test suite
5. **Following Week**: Performance profiling and optimization

This focused approach addresses the identified technical debt while building a robust testing foundation for the project.

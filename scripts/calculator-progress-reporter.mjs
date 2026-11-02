import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

// Deliberately excludes error text, stdout, attachments, page content, URLs,
// environment values and exported/imported player documents.
export default class CalculatorProgressReporter {
  constructor() {
    this.file = resolve('artifacts/calculator-progress/events.ndjson');
    this.ids = new Map();
    mkdirSync(resolve('artifacts/calculator-progress'), { recursive: true });
    writeFileSync(this.file, '');
  }
  write(event) {
    appendFileSync(this.file, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
  }
  onBegin(config, suite) {
    const tests = suite.allTests();
    tests.forEach((test, index) => this.ids.set(test.id, index + 1));
    this.write({ event: 'begin', declared: tests.length, workers: config.workers,
      tests: tests.map(test => ({ id: this.ids.get(test.id),
        file: relative(config.rootDir, test.location.file).replaceAll('\\', '/'),
        line: test.location.line, timeout: test.timeout })) });
  }
  onTestBegin(test, result) {
    this.write({ event: 'test-begin', id: this.ids.get(test.id), retry: result.retry, worker: result.workerIndex });
  }
  onTestEnd(test, result) {
    this.write({ event: 'test-end', id: this.ids.get(test.id), retry: result.retry,
      status: result.status, expectedStatus: test.expectedStatus, durationMs: result.duration });
  }
  onError() { this.write({ event: 'runner-error', detailsIntentionallyOmitted: true }); }
  onEnd(result) { this.write({ event: 'end', status: result.status, durationMs: result.duration }); }
}

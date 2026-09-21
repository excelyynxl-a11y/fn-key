import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const [runId, outputArgument = 'submission.json', baseUrl = process.env.API_BASE_URL ?? 'http://localhost:5000'] = process.argv.slice(2);
if (!runId) {
  console.error('Usage: npm run submission:export -- <runId> [output.json] [apiBaseUrl]');
  process.exit(1);
}

const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/runs/${encodeURIComponent(runId)}/submission`);
if (!response.ok) {
  const body = await response.text();
  throw new Error(`Submission export failed (${response.status}): ${body}`);
}
const submission = await response.json();
const outputPath = path.resolve(outputArgument);
await writeFile(outputPath, `${JSON.stringify(submission, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
console.log(`Wrote ${Object.keys(submission).length} rows to ${outputPath}`);

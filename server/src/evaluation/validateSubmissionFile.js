import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createDatasetRepository } from '../repositories/datasetRepository.js';
import { validateSubmissionArtifact } from '../services/submissionService.js';

const [submissionArgument, datasetArgument = process.env.DATASET_PATH ?? path.resolve(process.cwd(), '..', 'sdoc-hackathon-bundle')] = process.argv.slice(2);
if (!submissionArgument) {
  console.error('Usage: npm run submission:validate -- <submission.json> [datasetPath]');
  process.exit(1);
}

const submissionPath = path.resolve(submissionArgument);
const submission = JSON.parse(await readFile(submissionPath, 'utf8'));
const emails = await createDatasetRepository(path.resolve(datasetArgument)).listEmails();
const result = validateSubmissionArtifact(submission, emails.map(({ email_id: emailId }) => emailId));
console.log(JSON.stringify({ file: submissionPath, ...result }, null, 2));

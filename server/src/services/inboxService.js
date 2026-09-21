import path from 'node:path';
import Email from '../models/Email.js';
import { PIPELINE_VERSION } from '../constants/challenge.js';
import { createDatasetRepository } from '../repositories/datasetRepository.js';

export function defaultDatasetPath() {
  return process.env.DATASET_PATH
    ? path.resolve(process.env.DATASET_PATH)
    : path.resolve(process.cwd(), '..', 'shipmail-hackathon-bundle');
}

export async function importDataset({
  runId,
  rootPath = defaultDatasetPath(),
  emailModel = Email
}) {
  const repository = createDatasetRepository(rootPath);
  const sourceEmails = await repository.listEmails();
  const operations = [];
  let missingAttachments = 0;

  for (const email of sourceEmails) {
    const attachments = await Promise.all(
      email.attachments.map((reference) => repository.inspectAttachment(reference))
    );
    missingAttachments += attachments.filter((attachment) => !attachment.exists).length;

    operations.push({
      updateOne: {
        filter: { emailId: email.email_id },
        update: {
          $set: {
            sourceHash: email.sourceHash,
            source: {
              from: email.from,
              subject: email.subject,
              body: email.body,
              attachments
            },
            lastRunId: runId,
            pipelineVersion: PIPELINE_VERSION
          },
          $setOnInsert: { processingState: 'imported' }
        },
        upsert: true
      }
    });
  }

  if (operations.length > 0) {
    await emailModel.bulkWrite(operations, { ordered: false });
  }

  return {
    repository,
    emailIds: sourceEmails.map((email) => email.email_id),
    emailCount: sourceEmails.length,
    attachmentCount: sourceEmails.reduce((sum, email) => sum + email.attachments.length, 0),
    missingAttachments
  };
}


import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true, index: true },
  runId: { type: String, default: null, index: true },
  emailId: { type: String, default: null, index: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, immutable: true });

export const AuditEvent = mongoose.models.AuditEvent
  ?? mongoose.model('AuditEvent', auditEventSchema);
export default AuditEvent;

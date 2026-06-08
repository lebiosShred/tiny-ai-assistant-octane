const { z } = require('zod');

// Schema for /api/history POST payloads
const historySchema = z.object({
  id: z.string().optional(),
  type: z.string({ required_error: 'Type is required' }).min(1, 'Type is required'),
  company: z.string({ required_error: 'Company is required' }).min(1, 'Company is required'),
  date: z.string().optional(), // Can be ISO string or other formats, we validate presence/format downstream if needed
  name: z.string().optional(),
  email: z.string().email('Invalid email address format').or(z.string().length(0)).optional().nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  track: z.string().optional().nullable(),
  variant: z.string().optional().nullable(),
  score: z.union([z.number(), z.string(), z.null()]).optional(),
  rep: z.string().optional().nullable(),
  oneDriveFile: z.string().optional().nullable(),
  gDriveFile: z.string().optional().nullable(),
  gDriveFileId: z.string().optional().nullable(),
  gDriveFolderId: z.string().optional().nullable(),
  gDriveFileContent: z.string().optional().nullable(),
  stage: z.string().optional().nullable(),
  intakeAnswers: z.string().optional().nullable()
}).passthrough(); // Allow extra properties for forward compatibility

function validateHistory(payload) {
  return historySchema.safeParse(payload);
}

module.exports = {
  historySchema,
  validateHistory
};

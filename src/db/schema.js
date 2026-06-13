const { pgTable, text, jsonb, timestamp, index } = require('drizzle-orm/pg-core');

const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  gdrive_folder_id: text('gdrive_folder_id'),
  last_updated: timestamp('last_updated').defaultNow(),
});

const documentCompanionMetadata = pgTable('document_companion_metadata', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull(),
  fileName: text('file_name'),
  contentHash: text('content_hash'),
  extractedProfile: text('extracted_profile'),
  company: text('company'),
  prospectName: text('prospect_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    fileIdIdx: index('file_id_idx').on(table.fileId),
    contentHashIdx: index('content_hash_idx').on(table.contentHash),
  };
});

module.exports = { sessions, documentCompanionMetadata };


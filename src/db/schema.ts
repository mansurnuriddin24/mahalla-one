import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// 1. REGIONS
export const regions = pgTable('regions', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameUz: text('name_uz').notNull(),
  nameRu: text('name_ru').notNull(),
  nameKaa: text('name_kaa').notNull(),
  code: text('code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. DISTRICTS
export const districts = pgTable('districts', {
  id: uuid('id').defaultRandom().primaryKey(),
  regionId: uuid('region_id')
    .references(() => regions.id, { onDelete: 'cascade' })
    .notNull(),
  nameUz: text('name_uz').notNull(),
  nameRu: text('name_ru').notNull(),
  nameKaa: text('name_kaa').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. NEIGHBORHOODS (MAHALLALAR)
export const neighborhoods = pgTable('neighborhoods', {
  id: uuid('id').defaultRandom().primaryKey(),
  districtId: uuid('district_id')
    .references(() => districts.id, { onDelete: 'cascade' })
    .notNull(),
  nameUz: text('name_uz').notNull(),
  nameRu: text('name_ru').notNull(),
  nameKaa: text('name_kaa').notNull(),
  code: text('code').notNull().unique(),
  chairmanName: text('chairman_name'),
  phone: text('phone'),
  address: text('address'),
  coordinatesLat: doublePrecision('coordinates_lat'),
  coordinatesLng: doublePrecision('coordinates_lng'),
  subscriptionStatus: text('subscription_status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. USERS
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or Telegram UID
  phone: text('phone'),
  email: text('email'),
  fullName: text('full_name').notNull(),
  role: text('role').default('CITIZEN').notNull(), // CITIZEN, CHAIRMAN, STAFF, DISTRICT_ADMIN, SUPER_ADMIN
  regionId: uuid('region_id').references(() => regions.id),
  districtId: uuid('district_id').references(() => districts.id),
  neighborhoodId: uuid('neighborhood_id').references(() => neighborhoods.id),
  telegramId: text('telegram_id'),
  telegramUsername: text('telegram_username'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4B. NEIGHBORHOOD ACCESS CODES (Noyob va xavfsiz mahalla kirish kodlari)
export const neighborhoodCodes = pgTable('neighborhood_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  neighborhoodId: uuid('neighborhood_id')
    .references(() => neighborhoods.id, { onDelete: 'cascade' })
    .notNull(),
  accessCode: text('access_code').notNull().unique(), // e.g., M24-9K7P2X
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, REVOKED, EXPIRED
  createdById: uuid('created_by_id').references(() => users.id),
  description: text('description'),
  usageCount: integer('usage_count').default(0).notNull(),
  maxUsages: integer('max_usages'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. ROLES & PERMISSIONS
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description'),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  roleId: uuid('role_id')
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
});

// 6. COMPLAINTS
export const complaints = pgTable('complaints', {
  id: uuid('id').defaultRandom().primaryKey(),
  complaintCode: text('complaint_code').notNull().unique(), // e.g., MH-2026-0001
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // roads, street_lighting, water_supply, garbage_collection, drainage_sewage, public_spaces, landscaping, infrastructure, social_issues, other
  regionId: uuid('region_id').references(() => regions.id),
  districtId: uuid('district_id').references(() => districts.id),
  neighborhoodId: uuid('neighborhood_id')
    .references(() => neighborhoods.id)
    .notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  address: text('address'),
  citizenId: uuid('citizen_id')
    .references(() => users.id)
    .notNull(),
  status: text('status').default('NEW').notNull(), // NEW, ACCEPTED, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED, CLOSED
  priority: text('priority').default('MEDIUM').notNull(), // LOW, MEDIUM, HIGH, URGENT
  duplicateOfId: uuid('duplicate_of_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

// 7. COMPLAINT MEDIA
export const complaintMedia = pgTable('complaint_media', {
  id: uuid('id').defaultRandom().primaryKey(),
  complaintId: uuid('complaint_id')
    .references(() => complaints.id, { onDelete: 'cascade' })
    .notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size'),
  caption: text('caption'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. COMPLAINT HISTORY (AUDIT TRAIL)
export const complaintHistory = pgTable('complaint_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  complaintId: uuid('complaint_id')
    .references(() => complaints.id, { onDelete: 'cascade' })
    .notNull(),
  previousStatus: text('previous_status'),
  newStatus: text('new_status').notNull(),
  responsibleUserId: uuid('responsible_user_id').references(() => users.id),
  explanation: text('explanation').notNull(),
  evidenceUrl: text('evidence_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. ASSIGNMENTS
export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  complaintId: uuid('complaint_id')
    .references(() => complaints.id, { onDelete: 'cascade' })
    .notNull(),
  staffId: uuid('staff_id')
    .references(() => users.id)
    .notNull(),
  assignedById: uuid('assigned_by_id')
    .references(() => users.id)
    .notNull(),
  notes: text('notes'),
  status: text('status').default('PENDING').notNull(), // PENDING, IN_PROGRESS, COMPLETED
  deadline: timestamp('deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. ANNOUNCEMENTS
export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  neighborhoodId: uuid('neighborhood_id')
    .references(() => neighborhoods.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  targetAudience: text('target_audience').default('ALL').notNull(), // ALL, RESIDENTS, STAFF
  isPublished: boolean('is_published').default(true).notNull(),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. POLLS & VOTING
export const polls = pgTable('polls', {
  id: uuid('id').defaultRandom().primaryKey(),
  neighborhoodId: uuid('neighborhood_id')
    .references(() => neighborhoods.id, { onDelete: 'cascade' })
    .notNull(),
  question: text('question').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  closingDate: timestamp('closing_date'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pollOptions = pgTable('poll_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  pollId: uuid('poll_id')
    .references(() => polls.id, { onDelete: 'cascade' })
    .notNull(),
  optionText: text('option_text').notNull(),
  voteCount: integer('vote_count').default(0).notNull(),
});

export const pollVotes = pgTable('poll_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  pollId: uuid('poll_id')
    .references(() => polls.id, { onDelete: 'cascade' })
    .notNull(),
  optionId: uuid('option_id')
    .references(() => pollOptions.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. RATINGS
export const ratings = pgTable('ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  complaintId: uuid('complaint_id')
    .references(() => complaints.id, { onDelete: 'cascade' })
    .notNull().unique(),
  citizenId: uuid('citizen_id')
    .references(() => users.id)
    .notNull(),
  score: integer('score').notNull(), // 1 to 5
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. SUBSCRIPTION PLANS
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // START, STANDARD, PRO
  name: text('name').notNull(),
  priceUzs: integer('price_uzs').notNull(),
  billingInterval: text('billing_interval').default('MONTHLY').notNull(),
  description: text('description').notNull(),
  features: text('features').notNull(), // JSON string or text
});

// 14. NEIGHBORHOOD SUBSCRIPTIONS
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  neighborhoodId: uuid('neighborhood_id')
    .references(() => neighborhoods.id, { onDelete: 'cascade' })
    .notNull(),
  planId: uuid('plan_id')
    .references(() => subscriptionPlans.id)
    .notNull(),
  status: text('status').default('TRIAL').notNull(), // TRIAL, ACTIVE, EXPIRED, CANCELLED
  trialEndsAt: timestamp('trial_ends_at'),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. PAYMENTS
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  neighborhoodId: uuid('neighborhood_id')
    .references(() => neighborhoods.id)
    .notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),
  amountUzs: integer('amount_uzs').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, PAID, FAILED, REFUNDED
  paymentMethod: text('payment_method').default('BANK_TRANSFER').notNull(), // PAYME, CLICK, UZUM, BANK_TRANSFER
  transactionReference: text('transaction_reference'),
  notes: text('notes'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. NOTIFICATIONS
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').default('SYSTEM').notNull(), // COMPLAINT_UPDATE, ASSIGNMENT, ANNOUNCEMENT, POLL
  channel: text('channel').default('IN_APP').notNull(), // IN_APP, TELEGRAM, SMS
  isRead: boolean('is_read').default(false).notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. NOTIFICATION LOGS
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  notificationId: uuid('notification_id').references(() => notifications.id, { onDelete: 'cascade' }),
  recipient: text('recipient').notNull(),
  channel: text('channel').notNull(),
  status: text('status').notNull(), // SENT, FAILED, RETRYING
  errorMessage: text('error_message'),
  attempts: integer('attempts').default(1).notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

// 18. AUDIT LOGS
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(), // e.g. COMPLAINT_STATUS_UPDATE, USER_ROLE_CHANGE
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// RELATIONS
export const regionsRelations = relations(regions, ({ many }) => ({
  districts: many(districts),
  neighborhoods: many(neighborhoods),
}));

export const districtsRelations = relations(districts, ({ one, many }) => ({
  region: one(regions, {
    fields: [districts.regionId],
    references: [regions.id],
  }),
  neighborhoods: many(neighborhoods),
}));

export const neighborhoodsRelations = relations(neighborhoods, ({ one, many }) => ({
  district: one(districts, {
    fields: [neighborhoods.districtId],
    references: [districts.id],
  }),
  users: many(users),
  complaints: many(complaints),
  announcements: many(announcements),
  polls: many(polls),
  codes: many(neighborhoodCodes),
}));

export const neighborhoodCodesRelations = relations(neighborhoodCodes, ({ one }) => ({
  neighborhood: one(neighborhoods, {
    fields: [neighborhoodCodes.neighborhoodId],
    references: [neighborhoods.id],
  }),
  createdBy: one(users, {
    fields: [neighborhoodCodes.createdById],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  neighborhood: one(neighborhoods, {
    fields: [users.neighborhoodId],
    references: [neighborhoods.id],
  }),
  complaints: many(complaints),
  notifications: many(notifications),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  citizen: one(users, {
    fields: [complaints.citizenId],
    references: [users.id],
  }),
  neighborhood: one(neighborhoods, {
    fields: [complaints.neighborhoodId],
    references: [neighborhoods.id],
  }),
  media: many(complaintMedia),
  history: many(complaintHistory),
  assignments: many(assignments),
  rating: one(ratings, {
    fields: [complaints.id],
    references: [ratings.complaintId],
  }),
}));

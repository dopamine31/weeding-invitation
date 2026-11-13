import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("USER"), // USER | SUPER_ADMIN
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: created(),
});

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // free | premium | exclusive
  name: text("name").notNull(),
  priceIdr: integer("price_idr").notNull(),
  guestLimit: integer("guest_limit").notNull(),
  blastLimit: integer("blast_limit").notNull(),
  tvMode: boolean("tv_mode").notNull().default(false),
  premiumTemplates: boolean("premium_templates").notNull().default(false),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull(),
  planId: text("plan_id").notNull().default("free"),
  suspended: boolean("suspended").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: created(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("OWNER"), // OWNER | EDITOR | VIEWER
  },
  (t) => [uniqueIndex("memberships_ws_user").on(t.workspaceId, t.userId)],
);

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE | CANCELED
  amountIdr: integer("amount_idr").notNull(),
  interval: text("interval").notNull().default("MONTH"), // MONTH | YEAR | ONCE
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
});

export const payments = pgTable("payments", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull(),
  planId: text("plan_id").notNull(),
  amountIdr: integer("amount_idr").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | PAID | FAILED
  provider: text("provider").notNull().default("mock"),
  kind: text("kind").notNull().default("SUBSCRIPTION"), // SUBSCRIPTION | TEMPLATE
  createdAt: created(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const events = pgTable(
  "events",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    status: text("status").notNull().default("DRAFT"), // DRAFT | PUBLISHED | ARCHIVED
    timezone: text("timezone").notNull().default("WIB"), // WIB | WITA | WIT
    language: text("language").notNull().default("id"),
    templateSlug: text("template_slug").notNull().default("elegant-ivory"),
    groomName: text("groom_name").notNull(),
    brideName: text("bride_name").notNull(),
    groomFull: text("groom_full").notNull().default(""),
    brideFull: text("bride_full").notNull().default(""),
    groomParents: text("groom_parents").notNull().default(""),
    brideParents: text("bride_parents").notNull().default(""),
    password: text("password"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    noindex: boolean("noindex").notNull().default(false),
    wishPolicy: text("wish_policy").notNull().default("AUTO"), // AUTO | MANUAL
    config: jsonb("config").notNull().default({}), // theme overrides, sections, texts
    tvKey: text("tv_key").notNull(),
    staffPinHash: text("staff_pin_hash").notNull().default(""),
    retentionDays: integer("retention_days").notNull().default(90),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_ws").on(t.workspaceId)],
);

export const subEvents = pgTable(
  "sub_events",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    name: text("name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    venue: text("venue").notNull().default(""),
    address: text("address").notNull().default(""),
    mapsUrl: text("maps_url").notNull().default(""),
    dressCode: text("dress_code").notNull().default(""),
    streamingUrl: text("streaming_url").notNull().default(""),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("sub_events_event").on(t.eventId)],
);

export const pics = pgTable("pics", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const guestGroups = pgTable("guest_groups", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
});

export const guests = pgTable(
  "guests",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    groupId: uuid("group_id"),
    name: text("name").notNull(),
    normName: text("norm_name").notNull().default(""),
    phone: text("phone"),
    email: text("email"),
    category: text("category").notNull().default("REGULAR"), // REGULAR | VIP | FAMILY
    maxPax: integer("max_pax").notNull().default(2),
    plusOne: boolean("plus_one").notNull().default(false),
    token: text("token").notNull().unique(),
    notes: text("notes").notNull().default(""),
    consent: boolean("consent").notNull().default(true),
    optedOut: boolean("opted_out").notNull().default(false),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("guests_event").on(t.eventId), index("guests_phone").on(t.eventId, t.phone)],
);

export const linkOpens = pgTable(
  "link_opens",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("link_opens_event").on(t.eventId)],
);

export const menuOptions = pgTable("menu_options", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
});

export const rsvps = pgTable(
  "rsvps",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    subEventId: uuid("sub_event_id").notNull(),
    status: text("status").notNull(), // attending | declined | maybe
    pax: integer("pax").notNull().default(1),
    menuId: uuid("menu_id"),
    allergy: text("allergy").notNull().default(""),
    severity: text("severity").notNull().default("NONE"), // NONE | MILD | SEVERE
    answers: jsonb("answers").notNull().default({}),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rsvps_guest_sub").on(t.guestId, t.subEventId), index("rsvps_event").on(t.eventId)],
);

export const tables = pgTable("seat_tables", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  shape: text("shape").notNull().default("round"), // round | square | long | zone
  capacity: integer("capacity").notNull().default(8),
  x: real("x").notNull().default(50),
  y: real("y").notNull().default(50),
  rotation: real("rotation").notNull().default(0),
});

export const seatAssignments = pgTable(
  "seat_assignments",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    tableId: uuid("table_id").notNull(),
  },
  (t) => [uniqueIndex("seat_guest").on(t.guestId)],
);

export const wishes = pgTable(
  "wishes",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    guestId: uuid("guest_id"),
    name: text("name").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | FLAGGED
    score: integer("score").notNull().default(0),
    reasons: jsonb("reasons").notNull().default([]),
    pinned: boolean("pinned").notNull().default(false),
    reply: text("reply"),
    createdAt: created(),
  },
  (t) => [index("wishes_event").on(t.eventId, t.status)],
);

export const giftAccounts = pgTable("gift_accounts", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  type: text("type").notNull().default("BANK"), // BANK | EWALLET | QRIS
  provider: text("provider").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  claimedBy: text("claimed_by"),
});

export const blastCampaigns = pgTable("blast_campaigns", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  template: text("template").notNull(),
  status: text("status").notNull().default("DRAFT"), // DRAFT | RUNNING | PAUSED | DONE | CANCELED
  segment: jsonb("segment").notNull().default({}),
  settings: jsonb("settings").notNull().default({}),
  createdAt: created(),
});

export const blastMessages = pgTable(
  "blast_messages",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull(),
    eventId: uuid("event_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    phone: text("phone").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("QUEUED"), // QUEUED SENDING SENT DELIVERED READ FAILED SKIPPED
    error: text("error"),
    attempt: integer("attempt").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    providerMessageId: text("provider_message_id"),
    sendAfter: timestamp("send_after", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blast_idem").on(t.idempotencyKey),
    index("blast_campaign").on(t.campaignId, t.status),
  ],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: id(),
    eventId: uuid("event_id").notNull(),
    guestId: uuid("guest_id"),
    subEventId: uuid("sub_event_id"),
    walkInName: text("walk_in_name"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
    gate: text("gate").notNull().default("Gate 1"),
    clientEventId: text("client_event_id").notNull(),
    source: text("source").notNull().default("ONLINE"), // ONLINE | OFFLINE_SYNC | MANUAL
    pax: integer("pax").notNull().default(1),
    souvenir: boolean("souvenir").notNull().default(false),
  },
  (t) => [
    uniqueIndex("checkin_client").on(t.clientEventId),
    index("checkin_event").on(t.eventId),
  ],
);

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  meta: jsonb("meta").notNull().default({}),
  createdAt: created(),
});

export const moderationLogs = pgTable("moderation_logs", {
  id: id(),
  wishId: uuid("wish_id").notNull(),
  decision: text("decision").notNull(),
  score: integer("score").notNull(),
  reasons: jsonb("reasons").notNull().default([]),
  createdAt: created(),
});

export const consentLogs = pgTable("consent_logs", {
  id: id(),
  eventId: uuid("event_id").notNull(),
  guestId: uuid("guest_id"),
  purpose: text("purpose").notNull(),
  createdAt: created(),
});

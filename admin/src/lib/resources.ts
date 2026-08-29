export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money-paise"
  | "boolean"
  | "select"
  | "datetime"
  | "json";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
  required?: boolean;
  readOnly?: boolean;
  hiddenInList?: boolean;
  hiddenInForm?: boolean;
  monospace?: boolean;
  copyable?: boolean;
  truncate?: boolean;
  helpText?: string;
}

export interface RelationConfig {
  field: string;
  resource: string;
  labelField: string;
}

export interface ResourceConfig {
  name: string;
  label: string;
  group: string;
  description?: string;
  /** Supabase table name, or "__auth_users" for the special auth-admin resource */
  table: string;
  /** Optional view used for reads (list/show); writes always target `table` */
  readTable?: string;
  primaryKey: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  danger?: boolean;
  defaultSort: { field: string; order: "asc" | "desc" };
  searchFields: string[];
  fields: FieldConfig[];
  relations?: RelationConfig[];
  /** For encrypted resources: fields used to derive the encryption key */
  encryptedRelationshipFields?: { parentUserId: string; childUserId: string };
}

export const ROLE_OPTIONS = [
  { label: "Parent", value: "parent" },
  { label: "Child", value: "child" },
  { label: "Admin", value: "admin" },
];

const createdFields = (): FieldConfig[] => [
  {
    name: "created_at",
    label: "Created",
    type: "datetime",
    readOnly: true,
    monospace: false,
  },
];

const updatedField = (): FieldConfig => ({
  name: "updated_at",
  label: "Updated",
  type: "datetime",
  readOnly: true,
});

export const RESOURCES: ResourceConfig[] = [
  {
    name: "users",
    label: "Auth Users",
    group: "Access & Users",
    description:
      "Supabase auth accounts. Deleting a user cascades to all their devices, pairs and mirrored data.",
    table: "__auth_users",
    primaryKey: "id",
    canCreate: false,
    canEdit: false,
    canDelete: true,
    danger: true,
    defaultSort: { field: "created_at", order: "desc" },
    searchFields: ["email"],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "email", label: "Email", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email_confirmed_at", label: "Email Confirmed", type: "datetime" },
      { name: "last_sign_in_at", label: "Last Sign-in", type: "datetime" },
      { name: "banned_until", label: "Banned Until", type: "datetime" },
      ...createdFields(),
    ],
  },
  {
    name: "profiles",
    label: "Profiles",
    group: "Access & Users",
    description: "Display names synced from Google OAuth metadata.",
    table: "profiles",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "created_at", order: "desc" },
    searchFields: ["display_name"],
    relations: [{ field: "id", resource: "users", labelField: "email" }],
    fields: [
      { name: "id", label: "User ID", type: "text", monospace: true, copyable: true },
      { name: "display_name", label: "Display Name", type: "text" },
      ...createdFields(),
      updatedField(),
    ],
  },
  {
    name: "user-onboarding-state",
    label: "Onboarding State",
    group: "Access & Users",
    description: "Per-user onboarding progress and selected role. Survives reinstalls.",
    table: "user_onboarding_state",
    primaryKey: "user_id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "updated_at", order: "desc" },
    searchFields: [],
    fields: [
      { name: "user_id", label: "User ID", type: "text", required: true, monospace: true, copyable: true },
      { name: "selected_role", label: "Role", type: "select", options: ROLE_OPTIONS },
      {
        name: "onboarding_step",
        label: "Step",
        type: "select",
        options: [
          { label: "Role Selection", value: "role_selection" },
          { label: "Pairing", value: "pairing" },
          { label: "Permissions", value: "permissions" },
          { label: "App Selection", value: "app_selection" },
          { label: "Completed", value: "completed" },
        ],
      },
      { name: "onboarding_completed", label: "Completed", type: "boolean" },
      ...createdFields(),
      updatedField(),
    ],
    relations: [{ field: "user_id", resource: "profiles", labelField: "display_name" }],
  },
  {
    name: "devices",
    label: "Devices",
    group: "Devices & Pairing",
    description: "Registered child/parent devices with presence and push tokens.",
    table: "devices",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "last_seen_at", order: "desc" },
    searchFields: [],
    relations: [{ field: "user_id", resource: "profiles", labelField: "display_name" }],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "user_id", label: "Owner", type: "text", required: true, monospace: true, copyable: true },
      { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, required: true },
      { name: "platform", label: "Platform", type: "text" },
      { name: "push_token", label: "Push Token", type: "textarea", hiddenInList: true },
      { name: "is_foreground", label: "Foreground", type: "boolean" },
      { name: "last_seen_at", label: "Last Seen", type: "datetime" },
      ...createdFields(),
      updatedField(),
    ],
  },
  {
    name: "pairs",
    label: "Pairs",
    group: "Devices & Pairing",
    description: "Parent-child device pairings.",
    table: "pairs",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "created_at", order: "desc" },
    searchFields: [],
    relations: [
      { field: "parent_user_id", resource: "profiles", labelField: "display_name" },
      { field: "child_user_id", resource: "profiles", labelField: "display_name" },
    ],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "parent_device_id", label: "Parent Device", type: "text", monospace: true, copyable: true },
      { name: "child_device_id", label: "Child Device", type: "text", monospace: true, copyable: true },
      { name: "parent_user_id", label: "Parent User", type: "text", monospace: true, copyable: true },
      { name: "child_user_id", label: "Child User", type: "text", monospace: true, copyable: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Active", value: "active" },
          { label: "Revoked", value: "revoked" },
        ],
      },
      { name: "paired_at", label: "Paired At", type: "datetime" },
      { name: "parent_setup_completed", label: "Parent Setup Done", type: "boolean" },
      { name: "parent_skipped_app_selection", label: "Skipped App Selection", type: "boolean" },
      { name: "child_inventory_synced_at", label: "Inventory Synced", type: "datetime" },
      { name: "child_monitorable_app_count", label: "Monitored Apps", type: "number" },
      ...createdFields(),
      updatedField(),
    ],
  },
  {
    name: "pairing-tokens",
    label: "Pairing Tokens",
    group: "Devices & Pairing",
    description: "QR pairing JWTs and short codes. Tokens are sensitive credentials.",
    table: "pairing_tokens",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "created_at", order: "desc" },
    searchFields: ["code"],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "code", label: "Code", type: "text", monospace: true, copyable: true },
      { name: "token", label: "Token (JWT)", type: "textarea", hiddenInList: true, monospace: true },
      { name: "pair_id", label: "Pair", type: "text", monospace: true, copyable: true },
      { name: "child_device_id", label: "Child Device", type: "text", monospace: true, copyable: true },
      { name: "expires_at", label: "Expires At", type: "datetime" },
      { name: "consumed_at", label: "Consumed At", type: "datetime" },
      ...createdFields(),
    ],
  },
  {
    name: "mirrored-notifications",
    label: "Mirrored Notifications",
    group: "Notifications",
    description:
      "Encrypted notification mirror. Content fields are decrypted server-side for display.",
    table: "mirrored_notifications",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "notification_posted_at", order: "desc" },
    searchFields: ["notification_key", "delivery_mode"],
    encryptedRelationshipFields: {
      parentUserId: "parent_user_id",
      childUserId: "child_user_id",
    },
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "notification_title", label: "Title", type: "text", truncate: true },
      { name: "notification_body", label: "Body", type: "textarea", hiddenInList: true },
      { name: "source_package", label: "Package", type: "text", monospace: true, truncate: true },
      { name: "source_app_name", label: "App Name", type: "text", truncate: true },
      // `pair_id` is now an audit-only column (FK was dropped by the
      // relationship-key migration). Edits to it would break decryption
      // and audit traceability, so it is read-only.
      { name: "pair_id", label: "Pair (audit)", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "parent_user_id", label: "Parent User", type: "text", monospace: true, copyable: true },
      { name: "child_user_id", label: "Child User", type: "text", monospace: true, copyable: true },
      { name: "child_device_id", label: "Child Device", type: "text", hiddenInForm: true, monospace: true, copyable: true },
      {
        name: "delivery_mode",
        label: "Delivery",
        type: "select",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Realtime", value: "realtime" },
          { label: "Push", value: "push" },
          { label: "Both", value: "both" },
        ],
      },
      { name: "notification_key", label: "Key", type: "text", monospace: true, truncate: true },
      { name: "app_icon_base64", label: "Icon (base64)", type: "textarea", hiddenInList: true, hiddenInForm: true },
      { name: "notification_posted_at", label: "Posted At", type: "datetime" },
      { name: "ingested_at", label: "Ingested At", type: "datetime", hiddenInForm: true },
      // `push_sent_at` is the durable signal that the FCM push for this
      // notification has been attempted. The ingest edge function checks
      // this column to skip duplicate pushes. It is read-only here to
      // preserve that guarantee — manually editing it would re-arm a push
      // on the next ingest.
      { name: "push_sent_at", label: "Push Sent At", type: "datetime", readOnly: true },
      ...createdFields().map((f) => ({ ...f, hiddenInList: true })),
    ],
  },
  {
    name: "push-delivery-logs",
    label: "Push Delivery Logs",
    group: "Notifications",
    description: "FCM delivery attempts for mirrored notifications.",
    table: "push_delivery_logs",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "attempted_at", order: "desc" },
    searchFields: [],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Success", value: "success" },
          { label: "Failed", value: "failed" },
          { label: "Unregistered", value: "unregistered" },
        ],
      },
      {
        name: "delivery_mode",
        label: "Mode",
        type: "select",
        options: [
          { label: "Parent Push", value: "parent_push" },
          { label: "Child Recovery Push", value: "child_recovery_push" },
        ],
      },
      { name: "notification_id", label: "Notification", type: "text", monospace: true, copyable: true },
      { name: "parent_user_id", label: "Parent User", type: "text", monospace: true, copyable: true },
      { name: "child_user_id", label: "Child User", type: "text", monospace: true, copyable: true },
      // `pair_id` and `device_id` are audit-only now (FK dropped, NOT NULL
      // dropped for pair_id). Edits would break traceability.
      { name: "pair_id", label: "Pair (audit)", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "device_id", label: "Device (audit)", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "attempted_at", label: "Attempted At", type: "datetime" },
      ...createdFields().map((f) => ({ ...f, hiddenInList: true })),
    ],
  },
  {
    name: "child-app-filters",
    label: "App Filters",
    group: "Notifications",
    description: "Which child apps are enabled for mirroring.",
    table: "child_app_filters",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "created_at", order: "asc" },
    searchFields: ["package_name", "app_name"],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "package_name", label: "Package", type: "text", monospace: true, truncate: true },
      { name: "app_name", label: "App Name", type: "text" },
      { name: "is_enabled", label: "Enabled", type: "boolean" },
      { name: "child_device_id", label: "Child Device", type: "text", monospace: true, copyable: true },
      { name: "app_icon_base64", label: "Icon (base64)", type: "textarea", hiddenInList: true },
      ...createdFields().map((f) => ({ ...f, hiddenInList: true })),
    ],
  },
  {
    name: "plans",
    label: "Plans",
    group: "Monetization",
    description: "Subscription plan catalog served by list-plans edge function.",
    table: "plans",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "sort_order", order: "asc" },
    searchFields: ["name"],
    fields: [
      { name: "id", label: "Plan ID", type: "text", required: true, monospace: true },
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "tier",
        label: "Tier",
        type: "select",
        required: true,
        options: [
          { label: "Tier A", value: "tier_a" },
          { label: "Tier B", value: "tier_b" },
        ],
      },
      {
        name: "frequency",
        label: "Frequency",
        type: "select",
        required: true,
        options: [
          { label: "Monthly", value: "monthly" },
          { label: "Yearly", value: "yearly" },
        ],
      },
      { name: "amount_paise", label: "Amount (paise)", type: "money-paise", required: true },
      { name: "max_amount_paise", label: "Max Amount (paise)", type: "money-paise" },
      { name: "discount_label", label: "Discount Label", type: "text" },
      { name: "active", label: "Active", type: "boolean" },
      { name: "sort_order", label: "Sort Order", type: "number" },
      { name: "description", label: "Description", type: "textarea", hiddenInList: true },
      ...createdFields().map((f) => ({ ...f, hiddenInList: true })),
      { ...updatedField(), hiddenInList: true },
    ],
  },
  {
    name: "subscriptions",
    label: "Subscriptions",
    group: "Monetization",
    description: "PhonePe UPI AutoPay subscriptions. One live subscription per user.",
    table: "subscriptions",
    primaryKey: "id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    danger: true,
    defaultSort: { field: "updated_at", order: "desc" },
    searchFields: ["merchant_order_id", "merchant_subscription_id"],
    relations: [{ field: "plan_id", resource: "plans", labelField: "name" }],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "user_id", label: "User", type: "text", required: true, monospace: true, copyable: true },
      { name: "plan_id", label: "Plan", type: "text", monospace: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Active", value: "active" },
          { label: "Paused", value: "paused" },
          { label: "Expired", value: "expired" },
          { label: "Cancelled", value: "cancelled" },
          { label: "Revoked", value: "revoked" },
        ],
      },
      { name: "last_charge_amount_paise", label: "Last Charge", type: "money-paise" },
      { name: "next_charge_at", label: "Next Charge", type: "datetime" },
      { name: "current_cycle_start", label: "Cycle Start", type: "datetime" },
      { name: "current_cycle_end", label: "Cycle End", type: "datetime" },
      { name: "merchant_order_id", label: "Merchant Order", type: "text", monospace: true, truncate: true },
      { name: "merchant_subscription_id", label: "Merchant Subscription", type: "text", monospace: true, truncate: true },
      { name: "phonepe_order_id", label: "PhonePe Order", type: "text", monospace: true, truncate: true },
      { name: "error_message", label: "Error", type: "textarea", hiddenInList: true },
      ...createdFields().map((f) => ({ ...f, hiddenInList: true })),
      updatedField(),
    ],
  },
  {
    name: "subscription-events",
    label: "Subscription Events",
    group: "Monetization",
    description:
      "Append-only audit log of billing events written by webhooks. Read-only in admin.",
    table: "subscription_events",
    primaryKey: "id",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    defaultSort: { field: "created_at", order: "desc" },
    searchFields: ["event_type"],
    fields: [
      { name: "id", label: "ID", type: "text", readOnly: true, monospace: true, copyable: true },
      { name: "event_type", label: "Event Type", type: "text", monospace: true },
      { name: "user_id", label: "User", type: "text", monospace: true, copyable: true },
      { name: "subscription_id", label: "Subscription", type: "text", monospace: true, copyable: true },
      { name: "payload", label: "Payload", type: "json", hiddenInList: true },
      ...createdFields(),
    ],
  },
  {
    name: "user-trials",
    label: "User Trials",
    group: "Monetization",
    description:
      "7-day trials for parent users only — children never hold trials or see billing. Expand a row to see the children paired to that parent.",
    table: "user_trials",
    readTable: "admin_parent_trials",
    primaryKey: "user_id",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "started_at", order: "desc" },
    searchFields: [],
    relations: [{ field: "user_id", resource: "profiles", labelField: "display_name" }],
    fields: [
      { name: "user_id", label: "User", type: "text", required: true, monospace: true, copyable: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Used", value: "used" },
          { label: "Expired", value: "expired" },
        ],
      },
      { name: "started_at", label: "Started At", type: "datetime" },
      { name: "ends_at", label: "Ends At", type: "datetime", required: true },
    ],
  },
  {
    name: "app-categories",
    label: "App Categories",
    group: "Content",
    description: "Whitelist of monitorable packages by category.",
    table: "app_categories",
    primaryKey: "package_name",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "category", order: "asc" },
    searchFields: ["package_name"],
    fields: [
      { name: "package_name", label: "Package", type: "text", required: true, monospace: true, truncate: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: [
          { label: "Social", value: "social" },
          { label: "Messaging", value: "messaging" },
          { label: "Dating", value: "dating" },
        ],
      },
      { name: "enabled", label: "Enabled", type: "boolean" },
    ],
  },
  {
    name: "legal-documents",
    label: "Legal Documents",
    group: "Content",
    description: "In-app legal content (privacy, terms, licenses).",
    table: "legal_documents",
    primaryKey: "key",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultSort: { field: "key", order: "asc" },
    searchFields: ["key", "title"],
    fields: [
      { name: "key", label: "Key", type: "text", required: true, monospace: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "content", label: "Content", type: "textarea", hiddenInList: true },
      { name: "updated_at", label: "Updated", type: "datetime", readOnly: true },
    ],
  },
];

export function getResource(name: string): ResourceConfig | undefined {
  return RESOURCES.find((r) => r.name === name);
}

export const RESOURCE_GROUPS = Array.from(new Set(RESOURCES.map((r) => r.group)));

/** Fields that may appear in create/update payloads */
export function writableFields(cfg: ResourceConfig): FieldConfig[] {
  return cfg.fields.filter(
    (f) =>
      !f.readOnly &&
      !f.hiddenInForm &&
      (f.name !== cfg.primaryKey || cfg.canCreate),
  );
}

export type NotificationPrefs = {
  product: boolean;
  billing: boolean;
  marketing: boolean;
  exportReady: boolean;
};

export type PrivacyPrefs = {
  analytics: boolean;
  crashReports: boolean;
};

export type UserPreferences = {
  theme: "dark" | "system";
  language: "en";
  notifications: NotificationPrefs;
  privacy: PrivacyPrefs;
};

export type PlanId = "free" | "pro" | "team" | "enterprise";

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
  pendingEmail?: string | null;
  plan?: PlanId;
  preferences?: UserPreferences;
  deletedAt?: string | null;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  plan: PlanId;
  preferences: UserPreferences;
};

export type Session = {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  ipHash: string;
};

export type AuthToken = {
  hash: string;
  userId: string;
  kind: "reset" | "verify" | "email";
  email?: string;
  expiresAt: number;
};

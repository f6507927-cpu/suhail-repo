import { approvedArabicCopy } from "@/i18n/approved-arabic";

export type Locale = "ar" | "en";
export type Role = "admin" | "editor" | "user";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type AccountProfile = {
  id: string;
  full_name: string | null;
  role: Role;
};

export type AuthSession = {
  access_token: string;
  user: { id: string };
};

export type BrowserAuth = {
  auth: {
    getSession: () => Promise<{ data: { session: AuthSession | null } }>;
    onAuthStateChange: (
      callback: (_event: string, session: AuthSession | null) => void,
    ) => {
      data: { subscription: { unsubscribe: () => void } };
    };
    signOut: () => Promise<{ error: { message: string } | null }>;
  };
};

const accountMessages = [
  "Enable JavaScript to continue with Google.",
  "Open sign-in in a new tab",
  "Google sign-in needs a separate browser tab. Open sign-in in a new tab, then continue with Google.",
  "Google sign-in could not be started. Check your connection and try again in a new tab. If it still fails, contact the site owner to check Google provider and callback settings.",
  "Google navigation did not complete. Open sign-in in a new tab and try again.",
  "Accept and continue",
  "Accepted",
  "Account",
  "ACCOUNT ACCESS",
  "ACCOUNT / CONSENT",
  "Account deletion could not be completed. Try again.",
  "Account role",
  "Action",
  "Additional verification is still required.",
  "admin",
  "Admin",
  "ADMIN ACCESS",
  "ADMIN / ACCESS CONTROL",
  "ADMIN ACCESS / ENROLL",
  "Admin access requires a time-based authenticator. Your role alone does not grant access.",
  "ADMIN ACCESS / VERIFY",
  "ADMIN / APPEND-ONLY",
  "ADMIN / DEFERRED",
  "ADMIN / EDITORIAL CONFIGURATION",
  "Admin navigation",
  "Allow editor picks for ineligible securities",
  "An admin or editor account cannot be deleted. Ask another admin to remove your role first.",
  "and",
  "Apply filters",
  "Arabic",
  "A read-only record of privileged changes.",
  "A small set of preferences and account details.",
  "Audit trail",
  "Admin section",
  "Authenticator enrollment",
  "Authenticator verification",
  "Authenticator code",
  "Authenticator setup is unavailable",
  "Authenticator setup QR code",
  "Authenticator verified.",
  "Begin setup",
  "By continuing, you agree to the",
  "Cancel",
  "Change account role",
  "Change role",
  "Checking account",
  "Close",
  "Confirm role change",
  "Connecting to Google",
  "Continue with Google",
  "Copy setup key",
  "Could not prepare authenticator enrollment. Try again.",
  "Could not sign out. Please try again.",
  "Created",
  "Decline and sign out",
  "Default methodology version",
  "Delete account",
  "Delete my account",
  "Deleting",
  "editor",
  "EDITORIAL",
  "Editors may publish an explicitly marked pick even when it is not eligible under the selected screening configuration.",
  "Email",
  "English",
  "Enter the current code from your verified authenticator to continue to the editorial workspace.",
  "Enter the six-digit code",
  "Entity",
  "Entity ID",
  "Event ID",
  "Event type",
  "From",
  "Google",
  "GOOGLE OAUTH",
  "If scanning is unavailable, enter this key manually.",
  "Interface language",
  "Language preference could not be saved. Try again.",
  "Language saved",
  "Last sign-in",
  "Methodologies",
  "Lost your authenticator? Contact another administrator for a reset.",
  "Name",
  "Name not provided",
  "New role",
  "Next page",
  "No default",
  "No email",
  "No events match these filters.",
  "Not enrolled",
  "Not provided",
  "Not recorded",
  "No users found.",
  "No verified authenticator is available for this account.",
  "One Google account. No password to manage.",
  "Only public, eligible versions are listed.",
  "Open account menu",
  "Page",
  "Policy acceptance",
  "Policy acceptance is recorded on your account.",
  "Preparing secure setup",
  "Previous page",
  "Privacy Policy",
  "Private to your account",
  "Profile",
  "Profile is temporarily unavailable.",
  "QR code unavailable. Use the setup key instead.",
  "Reason (required)",
  "RECORDS",
  "RESEARCH, WITH ITS REASONS",
  "Review your agreement",
  "Role",
  "ROLE CHANGE",
  "Role changes are audited. A promoted user must enroll an authenticator before entering admin.",
  "Role could not be updated. Try again.",
  "Roles are granted deliberately and every change is recorded.",
  "Role updated.",
  "Save language",
  "Save settings",
  "Saving",
  "Scan with your authenticator app",
  "Search",
  "Search by name or email",
  "Settings",
  "Settings could not be saved. Try again.",
  "Settings saved.",
  "Set up an authenticator",
  "Setup key copied",
  "Setup key unavailable",
  "Sign in",
  "Sign-in was cancelled. You can try again.",
  "Signing out",
  "Sign-in method",
  "Sign out",
  "SUHAIL / ACCOUNT",
  "SUHAIL ACCOUNT",
  "Suhail · Public research",
  "Terms of Use",
  "That code could not be verified. Check the time on your device and try again.",
  "That code could not be verified. Try again.",
  "The account provider is not configured for this browser session. Contact an administrator.",
  "Google sign-in could not be started. Please try again.",
  "These settings affect editorial defaults. Changes are audited.",
  "This area is reserved for a later editorial workflow. No data can be changed here.",
  "This controls the language used when you open Suhail.",
  "This permanently removes your account and cannot be undone.",
  "This section is not available yet",
  "Securities and data",
  "Ingestion",
  "Editions",
  "Analysts",
  "To",
  "TOTP",
  'Type "DELETE" to confirm',
  "user",
  "User",
  "Users",
  "Verification could not be completed. Try again.",
  "Verified",
  "Verify and continue",
  "Verifying",
  "Verify your identity",
  "WORKSPACE",
  "Your account",
  "Your agreement needs to be renewed before you continue using your account.",
  "Your public research remains open to everyone.",
  // D-101: audit event types and current code-valued summaries share approved copy.
  "methodology_create",
  "methodology_update",
  "methodology_version_create",
  "methodology_version_production_enable",
  "criterion_create",
  "criterion_update",
  "screening_run",
  "explanation_generated",
  "data_ingest",
  "alert_created",
  "edition_draft_created",
  "edition_published",
  "edition_revision",
  "edition_status_change",
  "score_model_version_create",
  "score_model_status_change",
  "score_model_backtest",
  "editor_pick_saved",
  "approval_recorded",
  "performance_recorded",
  "price_advance",
  "editorial_setting_change",
  "user_registered",
  "user_role_change",
  "user_mfa_reset",
  "user_account_deleted",
  "consent_recorded",
] as const;

export const accountCopyDictionary = Object.fromEntries(
  accountMessages.map((english) => [
    english,
    {
      en: english,
      ar: approvedArabicCopy[english] ?? `⟦AR-REVIEW⟧ ${english}`,
    },
  ]),
) as Record<string, { ar: string; en: string }>;

export function reviewText(locale: Locale, source: string) {
  const entry = Object.hasOwn(accountCopyDictionary, source) ? accountCopyDictionary[source] : undefined;
  if (entry) return entry[locale];
  const approved = Object.hasOwn(approvedArabicCopy, source) ? approvedArabicCopy[source] : undefined;
  return locale === "ar" ? approved ?? `⟦AR-REVIEW⟧ ${source}` : source;
}

export function initials(name: string | null): string {
  const source = (name?.trim() || "?").split(/\s+/);
  return source
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

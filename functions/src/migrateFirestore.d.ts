/**
 * ============================================================
 * ONE-TIME FIRESTORE MIGRATION SCRIPT
 * ============================================================
 * This script moves old root-level collections into the correct
 * church-scoped subcollection paths:
 *
 *   broadcasts       → churches/{churchId}/broadcasts
 *   worshipSongs     → churches/{churchId}/worshipSongs
 *   settings         → churches/{churchId}/settings
 *   member_profiles  → churches/{churchId}/members
 *
 * NOTE: The root-level `users` collection is intentionally
 *       left at the root (it stores global auth/FCM data).
 *
 * HOW TO RUN:
 *   cd c:\Users\sunil\we_christian\functions
 *   npx ts-node src/migrateFirestore.ts
 * ============================================================
 */
export {};
//# sourceMappingURL=migrateFirestore.d.ts.map
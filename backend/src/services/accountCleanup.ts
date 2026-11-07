import pool from "../db";
import { deleteBatchFromCloudinary, getAvatarPublicId } from "../utils/cloudinary";

const RETENTION_DAYS = 30;
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Permanently purges user accounts that were soft-deleted more than 30 days ago.
 * Complies with GDPR/NDPR right-to-be-forgotten commitments stated in the Privacy Policy.
 *
 * Uses a single atomic DELETE ... RETURNING query:
 * 1. Atomically deletes all expired user records from PostgreSQL in one query.
 * 2. Deterministically derives hashed Cloudinary public_ids from the user IDs.
 * 3. Batch deletes all associated avatar assets from Cloudinary in a single API call.
 */
export async function purgeExpiredDeletedAccounts(): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // 1. Atomically delete expired users from Postgres in a single query
    const deleteQuery = `
      DELETE FROM users 
      WHERE deleted_at IS NOT NULL 
        AND deleted_at < $1
      RETURNING id, username, avatar_url;
    `;
    const { rows: purgedUsers } = await pool.query(deleteQuery, [cutoffDate]);

    if (!purgedUsers || purgedUsers.length === 0) {
      return;
    }

    console.log(
      `[AccountCleanup] Successfully purged ${purgedUsers.length} account(s) from database (soft-deleted before ${cutoffDate.toISOString()}).`
    );

    // 2. Derive hashed Cloudinary public IDs for users who had an avatar
    const avatarPublicIds: string[] = purgedUsers
      .filter((u) => Boolean(u.avatar_url))
      .map((u) => getAvatarPublicId(u.id));

    // 3. Batch delete avatar assets from Cloudinary in a single API call (chunked by 100 if needed)
    if (avatarPublicIds.length > 0) {
      try {
        const chunkSize = 100;
        for (let i = 0; i < avatarPublicIds.length; i += chunkSize) {
          const chunk = avatarPublicIds.slice(i, i + chunkSize);
          await deleteBatchFromCloudinary(chunk);
        }
        console.log(
          `[AccountCleanup] Successfully batch deleted ${avatarPublicIds.length} avatar asset(s) from Cloudinary.`
        );
      } catch (cloudErr: any) {
        console.warn(
          "[AccountCleanup] Cloudinary batch cleanup error:",
          cloudErr?.message || cloudErr
        );
      }
    }
  } catch (err) {
    console.error("[AccountCleanup] Error during daily account purge check:", err);
  }
}

/**
 * Initializes the automated daily retention cleanup service.
 * Executes once immediately on server start, then recurs every 24 hours.
 */
export function initAccountCleanup(): void {
  // Initial check on boot
  purgeExpiredDeletedAccounts();

  // Clear existing timer if re-initialized
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  // Run heartbeat every 24 hours
  cleanupTimer = setInterval(() => {
    purgeExpiredDeletedAccounts();
  }, 24 * 60 * 60 * 1000);

  console.log(
    "[AccountCleanup] Daily account retention purge worker initialized (24h heartbeat, single atomic delete)."
  );
}

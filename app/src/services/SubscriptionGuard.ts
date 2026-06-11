/**
 * SubscriptionGuard
 *
 * Enforces WeChristian subscription tier limits:
 *   - free:     max 100 members
 *   - standard: max 1,000 members
 *   - premium:  unlimited
 *
 * Usage:
 *   const guard = new SubscriptionGuard(activeChurch);
 *   const check = guard.canAddMember();
 *   if (!check.allowed) Alert.alert('Limit Reached', check.message);
 */

import { ChurchDetails } from './ChurchService';

const TIER_LIMITS: Record<string, number> = {
  free: 100,
  standard: 1000,
  premium: Infinity,
};

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  standard: 'Standard',
  premium: 'Premium',
};

interface GuardResult {
  allowed: boolean;
  message?: string;
  limit?: number;
  current?: number;
  tier?: string;
}

export class SubscriptionGuard {
  private church: ChurchDetails | null;

  constructor(church: ChurchDetails | null) {
    this.church = church;
  }

  get tier(): string {
    return this.church?.subscriptionTier || 'free';
  }

  get limit(): number {
    return TIER_LIMITS[this.tier] ?? 100;
  }

  get currentCount(): number {
    return this.church?.memberCount ?? 0;
  }

  /**
   * Check if a new member can be added based on the current tier.
   */
  canAddMember(): GuardResult {
    if (!this.church) {
      return {
        allowed: false,
        message: 'No church found. Please join or create a church first.',
      };
    }

    if (this.currentCount >= this.limit) {
      const tierLabel = TIER_LABELS[this.tier];
      const upgradeMsg =
        this.tier === 'premium'
          ? 'Your church has reached the maximum member limit.'
          : `Your church is on the ${tierLabel} plan (max ${this.limit} members). Please upgrade to add more members.`;

      return {
        allowed: false,
        message: upgradeMsg,
        limit: this.limit,
        current: this.currentCount,
        tier: this.tier,
      };
    }

    return { allowed: true, limit: this.limit, current: this.currentCount, tier: this.tier };
  }

  /**
   * Check if a specific feature is enabled for this church.
   */
  hasFeature(feature: keyof ChurchDetails['features']): boolean {
    return this.church?.features?.[feature] ?? false;
  }

  /**
   * Get a human-readable summary of the current subscription.
   */
  getSummary(): string {
    const tierLabel = TIER_LABELS[this.tier];
    const limitLabel = this.limit === Infinity ? 'Unlimited' : `${this.limit}`;
    return `${tierLabel} Plan · ${this.currentCount} / ${limitLabel} Members`;
  }

  /**
   * Increment the church's memberCount in Firestore when a new member joins.
   * Call this after a successful member registration.
   */
  static async incrementMemberCount(churchId: string): Promise<void> {
    try {
      const { firestore, FieldValue } = require('./firebaseConfig');
      await firestore().collection('churches').doc(churchId).update({
        memberCount: FieldValue.increment(1),
      });
    } catch (e) {
      console.warn('SubscriptionGuard: failed to increment memberCount', e);
    }
  }

  /**
   * Decrement the church's memberCount in Firestore when a member leaves.
   */
  static async decrementMemberCount(churchId: string): Promise<void> {
    try {
      const { firestore, FieldValue } = require('./firebaseConfig');
      await firestore().collection('churches').doc(churchId).update({
        memberCount: FieldValue.increment(-1),
      });
    } catch (e) {
      console.warn('SubscriptionGuard: failed to decrement memberCount', e);
    }
  }
}

import { firestore } from './firebaseConfig';

export interface ChurchTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface ChurchDetails {
  id: string;
  name: string;
  subdomain: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  theme: ChurchTheme;
  features: {
    hasSermons: boolean;
    hasDailyPromises: boolean;
    hasWorshipSongs: boolean;
    hasGiving: boolean;
  };
  socialLinks?: {
    youtube?: string;
    facebook?: string;
    instagram?: string;
    website?: string;
  };
}

class ChurchService {
  /**
   * Fetch details for a specific church tenant
   */
  async getChurchDetails(churchId: string): Promise<ChurchDetails | null> {
    try {
      const docSnap = await firestore().collection('churches').doc(churchId).get();
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ChurchDetails;
      }
      return null;
    } catch (error) {
      console.error('Error fetching church details:', error);
      return null;
    }
  }

  /**
   * Fetch all registered churches (for selection screen)
   */
  async getAllChurches(): Promise<ChurchDetails[]> {
    try {
      const snapshot = await firestore().collection('churches').orderBy('name').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChurchDetails[];
    } catch (error) {
      console.error('Error fetching all churches:', error);
      return [];
    }
  }

  /**
   * Fetch church by subdomain/slug
   */
  async getChurchBySubdomain(subdomain: string): Promise<ChurchDetails | null> {
    try {
      const snapshot = await firestore()
        .collection('churches')
        .where('subdomain', '==', subdomain)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ChurchDetails;
      }
      return null;
    } catch (error) {
      console.error('Error fetching church by subdomain:', error);
      return null;
    }
  }
}

export default new ChurchService();

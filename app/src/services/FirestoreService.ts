import { firestore, FieldValue } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Data Interfaces ─────────────────────────────────────────────────────────

export interface AppMember {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  userType?: string;
  churchId: string;
  joinDate?: string;
  accountId?: string;
  description?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingStreet?: string;
}

export interface FirestorePromise {
  id: string;
  date: string; // YYYY-MM-DD
  verse: string;
  reference: string;
  devotionalNote: string;
  pastor: string;
  verseTelugu?: string;
  bgTheme?: string;
  createdAt: any;
}

export interface FirestoreVideo {
  id: string;
  youtubeId: string;
  title: string;
  duration: string;
  publishedAt: string;
  description?: string;
  isLive?: boolean;
}

export interface DailyPromise {
  id?: string;
  verse: string;
  verseTelugu?: string;
  date: string;
  devotionalNote?: string;
  pastor?: string;
  status?: string;
  youtubeId?: string;
  verseReference?: string;
  verseReferenceEn?: string;
  verseReferenceTe?: string;
  videoTitle?: string;
  duration?: string;
  imageUrl?: string;
}

export interface WorshipSong {
  id: string;
  title: string;
  titleTe?: string;
  artist: string;
  key: string;
  lyrics?: string;
  category?: string;
  youtubeId?: string;
  isThemeSong?: boolean;
}

export interface ScheduleEvent {
  id: string;
  name?: string;
  title: string;
  titleTelugu?: string;
  date: string;
  time?: string;
  startTime: string;
  endTime: string;
  location: string;
  address?: string;
  description: string;
  descEn?: string;
  category: string;
  image: string;
  bannerUrl?: string;
  youtubeId?: string;
}

export interface Sermon {
  id: string;
  title: string;
  titleTelugu?: string;
  youtubeId: string;
  date: string;
  pastor: string;
  duration: string;
  description?: string;
  scripture?: string;
  viewCount?: number;
  status?: string;
  series?: string;
  audioUrl?: string;
}

// ─── Service Layer ────────────────────────────────────────────────────────────

class FirestoreService {
  private churchId: string | null = null;

  async setChurchId(id: string) {
    this.churchId = id;
    await AsyncStorage.setItem('@active_church_id', id);
  }

  async getChurchId(): Promise<string | null> {
    if (this.churchId) return this.churchId;
    this.churchId = await AsyncStorage.getItem('@active_church_id');
    return this.churchId;
  }

  // Helper to get church-scoped collection
  async getCollection(collectionName: string) {
    const id = await this.getChurchId();
    if (!id) throw new Error('Church ID not set');
    return firestore().collection('churches').doc(id).collection(collectionName);
  }

  // --- 👤 Member Logic ---

  async getMemberProfile(uid: string): Promise<AppMember | null> {
    try {
      const docSnap = await firestore().collection('member_profiles').doc(uid).get();
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as AppMember;
      }
      return null;
    } catch (error) {
      console.error('Error fetching member profile:', error);
      return null;
    }
  }

  async checkContactExists(phone: string, uid?: string): Promise<any> {
    // Stub for now. We will replace this with Firestore query based on phone.
    const rawDigits = phone.replace(/\D/g, '');
    const last10 = rawDigits.slice(-10);
    try {
      const snapshot = await firestore().collection('member_profiles').where('phone', '==', last10).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { exists: true, member: { id: doc.id, ...doc.data() } };
      }
      return { exists: false };
    } catch (error) {
      return { exists: false };
    }
  }

  async updateMemberProfile(contactId: string, details: any) {
    try {
      await firestore().collection('member_profiles').doc(contactId).update(details);
      return true;
    } catch (error) {
      console.error('Error updating member profile', error);
      throw error;
    }
  }

  async updateLastAppOpened(contactId: string) {
    try {
      await firestore().collection('member_profiles').doc(contactId).update({
        lastAppOpened: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.warn('Error updating lastAppOpened', error);
    }
  }

  async syncMember(contactId: string, uid: string) {
    try {
      await firestore().collection('member_profiles').doc(contactId).update({ uid });
    } catch (e) {
      console.warn('Error syncing member', e);
    }
  }

  async getRelatedContacts(accountId: string): Promise<any[]> {
    try {
      const snapshot = await firestore().collection('member_profiles').where('accountId', '==', accountId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return [];
    }
  }

  async addFamilyMember(accountId: string, newMember: any) {
    try {
      await firestore().collection('member_profiles').add({ ...newMember, accountId });
      return true;
    } catch (e) {
      throw e;
    }
  }

  async createMember(data: any) {
    try {
      const docRef = await firestore().collection('member_profiles').add(data);
      return { success: true, id: docRef.id };
    } catch (e) {
      throw e;
    }
  }

  // --- 🎥 Videos, Sermons, Promises ---

  async getDailyPromisesArchive(limit: number = 30): Promise<DailyPromise[]> {
    try {
      const col = await this.getCollection('dailyPromises');
      const snapshot = await col.orderBy('date', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DailyPromise[];
    } catch (error) {
      return [];
    }
  }

  async getDailyPromise(): Promise<DailyPromise | null> {
    try {
      const col = await this.getCollection('dailyPromises');
      const snapshot = await col.orderBy('date', 'desc').limit(1).get();
      if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DailyPromise;
      return null;
    } catch (error) {
      return null;
    }
  }

  async getDailyVideos(limit: number = 10): Promise<FirestoreVideo[]> {
    try {
      const col = await this.getCollection('dailyVideos');
      const snapshot = await col.orderBy('publishedAt', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirestoreVideo[];
    } catch (error) {
      return [];
    }
  }

  async getSermons(limit = 50): Promise<Sermon[]> {
    try {
      const col = await this.getCollection('sermons');
      const snapshot = await col.orderBy('date', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sermon[];
    } catch (error) {
      return [];
    }
  }

  async getWorshipSongs(): Promise<WorshipSong[]> {
    try {
      const col = await this.getCollection('worshipSongs');
      const snapshot = await col.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WorshipSong[];
    } catch (error) {
      return [];
    }
  }

  // --- 📅 Events ---

  async getTodayEvents(): Promise<ScheduleEvent[]> {
    try {
      const col = await this.getCollection('events');
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await col.where('date', '==', today).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScheduleEvent[];
    } catch (error) {
      return [];
    }
  }

  async getUpcomingEvents(limit = 15): Promise<ScheduleEvent[]> {
    try {
      const col = await this.getCollection('events');
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await col.where('date', '>=', today).orderBy('date', 'asc').limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScheduleEvent[];
    } catch (error) {
      return [];
    }
  }

  async getPastEvents(limit = 5): Promise<ScheduleEvent[]> {
    try {
      const col = await this.getCollection('events');
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await col.where('date', '<', today).orderBy('date', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScheduleEvent[];
    } catch (error) {
      return [];
    }
  }

  // --- 🙏 Prayer Wall ---

  async getPrayerRequests(filters: any = {}) {
    try {
      const col = await this.getCollection('prayerRequests');
      let query: any = col;
      if (filters.contactId) {
        query = query.where('authorId', '==', filters.contactId);
      }
      const snapshot = await query.orderBy('createdAt', 'desc').get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return [];
    }
  }

  async submitPrayerRequest(data: any) {
    try {
      const col = await this.getCollection('prayerRequests');
      await col.add({ ...data, createdAt: FieldValue.serverTimestamp() });
      return true;
    } catch (error) {
      throw error;
    }
  }

  async addPrayerComment(requestId: string, comment: string, authorName: string) {
    try {
      const col = await this.getCollection('prayerRequests');
      await col.doc(requestId).collection('comments').add({
        comment,
        authorName,
        createdAt: FieldValue.serverTimestamp()
      });
      return true;
    } catch (e) {
      throw e;
    }
  }

  async deletePrayerRequest(id: string) {
    try {
      const col = await this.getCollection('prayerRequests');
      await col.doc(id).delete();
      return true;
    } catch (e) {
      throw e;
    }
  }

  // --- 💸 Giving ---

  async createDonation(data: any) {
    try {
      const col = await this.getCollection('donations');
      await col.add({ ...data, createdAt: FieldValue.serverTimestamp() });
      return true;
    } catch (e) {
      throw e;
    }
  }

  // --- 📖 Bible Progress ---

  async getBibleProgress(memberId: string): Promise<any> {
    try {
      const doc = await firestore().collection('member_profiles').doc(memberId).collection('bible').doc('progress').get();
      return doc.exists() ? doc.data() : null;
    } catch (e) {
      return null;
    }
  }

  async saveBibleProgress(memberId: string, progress: any) {
    try {
      await firestore().collection('member_profiles').doc(memberId).collection('bible').doc('progress').set(progress, { merge: true });
      return true;
    } catch (e) {
      throw e;
    }
  }

  // --- 🔔 Notifications ---

  async getNotificationPrefs(userId: string) {
    try {
      const docSnap = await firestore().collection('member_profiles').doc(userId).get();
      if (docSnap.exists()) {
        return docSnap.data()?.notifications || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async saveNotificationPrefs(userId: string, prefs: any) {
    try {
      await firestore().collection('member_profiles').doc(userId).set({
        notifications: prefs,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default new FirestoreService();

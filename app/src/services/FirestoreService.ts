import { firestore, FieldValue } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Data Interfaces ─────────────────────────────────────────────────────────

export interface GlobalUser {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  primaryChurchId?: string;
  fcmToken?: string;
  createdAt?: any;
  lastLogin?: any;
}

export interface AppMember {
  id: string; // The uid
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

  // --- 👤 Global User & Member Logic ---

  async getGlobalUser(uid: string): Promise<GlobalUser | null> {
    try {
      const docSnap = await firestore().collection('users').doc(uid).get();
      if (docSnap.exists()) {
        return { uid: docSnap.id, ...docSnap.data() } as GlobalUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching global user:', error);
      return null;
    }
  }

  async getMemberProfile(churchId: string, uid: string): Promise<AppMember | null> {
    try {
      const docSnap = await firestore().collection('churches').doc(churchId).collection('members').doc(uid).get();
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as AppMember;
      }
      return null;
    } catch (error) {
      console.error('Error fetching nested member profile:', error);
      return null;
    }
  }

  async checkContactExists(phone: string, churchId?: string): Promise<any> {
    const rawDigits = phone.replace(/\D/g, '');
    const last10 = rawDigits.slice(-10);
    const plus91 = `+91${last10}`;
    
    try {
      if (!churchId) churchId = await this.getChurchId() || undefined;
      
      if (!churchId) return { exists: false };

      // Query both common formats
      const snapshot = await firestore()
        .collection('churches')
        .doc(churchId)
        .collection('members')
        .where('phone', 'in', [last10, plus91, phone])
        .limit(1)
        .get();
        
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { exists: true, member: { id: doc.id, ...doc.data() } };
      }
      return { exists: false };
    } catch (error) {
      return { exists: false };
    }
  }

  async updateMemberProfile(churchId: string, memberId: string, details: any) {
    try {
      await firestore().collection('churches').doc(churchId).collection('members').doc(memberId).update(details);
      return true;
    } catch (error) {
      console.error('Error updating member profile', error);
      throw error;
    }
  }

  async updateMemberRole(memberId: string, userType: string): Promise<boolean> {
    try {
      const col = await this.getCollection('members');
      await col.doc(memberId).update({ userType });
      return true;
    } catch (error) {
      console.error('Error updating member role', error);
      return false;
    }
  }

  async updateLastAppOpened(uid: string) {
    try {
      await firestore().collection('users').doc(uid).update({
        lastLogin: FieldValue.serverTimestamp()
      });
      
      const churchId = await this.getChurchId();
      if (churchId) {
        await firestore().collection('churches').doc(churchId).collection('members').doc(uid).update({
          lastAppOpened: FieldValue.serverTimestamp(),
          lastLogin: FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      console.warn('Error updating lastLogin globally', error);
    }
  }

  async syncMember(churchId: string, contactId: string, uid: string) {
    try {
      await firestore().collection('churches').doc(churchId).collection('members').doc(contactId).update({ uid });
    } catch (e) {
      console.warn('Error syncing member', e);
    }
  }

  async getRelatedContacts(churchId: string, accountId: string): Promise<any[]> {
    try {
      const snapshot = await firestore().collection('churches').doc(churchId).collection('members').where('accountId', '==', accountId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return [];
    }
  }

  async addFamilyMember(churchId: string, accountId: string, newMember: any) {
    try {
      await firestore().collection('churches').doc(churchId).collection('members').add({ ...newMember, accountId });
      return true;
    } catch (e) {
      throw e;
    }
  }

  async createMember(churchId: string, data: any, customId?: string) {
    try {
      if (customId) {
        await firestore().collection('churches').doc(churchId).collection('members').doc(customId).set(data);
        return { success: true, id: customId };
      } else {
        const docRef = await firestore().collection('churches').doc(churchId).collection('members').add(data);
        return { success: true, id: docRef.id };
      }
    } catch (e) {
      throw e;
    }
  }

  async getAdminMembers(): Promise<any[]> {
    try {
      const col = await this.getCollection('members');
      const snapshot = await col.where('userType', '==', 'Admin').get();
      return snapshot.docs.map((doc: any) => ({ 
        id: doc.id, 
        name: doc.data().name || doc.data().firstName || 'Unknown',
        email: doc.data().email || '',
        ...doc.data() 
      }));
    } catch (error) {
      console.error('Error fetching admin members:', error);
      return [];
    }
  }

  // --- 🎥 Videos, Sermons, Promises ---



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

  async createSermon(data: any) {
    try {
      const col = await this.getCollection('sermons');
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      if (cleanData.id) {
        await col.doc(cleanData.id as string).set({ ...cleanData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return cleanData.id;
      } else {
        const docRef = await col.add({ ...cleanData, createdAt: FieldValue.serverTimestamp() });
        return docRef.id;
      }
    } catch (e) {
      throw e;
    }
  }

  async deleteSermon(id: string) {
    try {
      const col = await this.getCollection('sermons');
      await col.doc(id).delete();
      return true;
    } catch (e) {
      throw e;
    }
  }

  async createWorshipSong(data: any) {
    try {
      const col = await this.getCollection('worshipSongs');
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      if (cleanData.id) {
        await col.doc(cleanData.id as string).set({ ...cleanData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return cleanData.id;
      } else {
        const docRef = await col.add({ ...cleanData, createdAt: FieldValue.serverTimestamp() });
        return docRef.id;
      }
    } catch (e) {
      throw e;
    }
  }

  async deleteWorshipSong(id: string) {
    try {
      const col = await this.getCollection('worshipSongs');
      await col.doc(id).delete();
      return true;
    } catch (e) {
      throw e;
    }
  }

  async updateWorshipSong(id: string, data: any) {
    try {
      const col = await this.getCollection('worshipSongs');
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await col.doc(id).update({ ...cleanData, updatedAt: FieldValue.serverTimestamp() });
      return true;
    } catch (e) {
      throw e;
    }
  }

  // --- 📅 Events ---



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

      let rawItems: any[] = [];
      if (filters.isAdmin) {
        // Admin sees all requests
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        rawItems = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      } else {
        // Members see all approved requests
        let approvedQuery = query.where('isAnswered', '==', true);
        const approvedSnapshot = await approvedQuery.get();
        let list = approvedSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        // Plus member's own pending requests (so they see their request immediately after submitting)
        const userIdentifier = filters.contactId || filters.phone;
        if (userIdentifier) {
          let pendingQuery = query.where('isAnswered', '==', false);
          if (filters.contactId) {
            pendingQuery = pendingQuery.where('contactId', '==', filters.contactId);
          } else {
            pendingQuery = pendingQuery.where('phone', '==', filters.phone);
          }
          const pendingSnapshot = await pendingQuery.get();
          const pendingList = pendingSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

          // Merge lists and prevent duplicates
          const seen = new Set(list.map((p: any) => p.id));
          for (const p of pendingList) {
            if (!seen.has(p.id)) {
              list.push(p);
            }
          }
        }

        // Sort combined list by createdAt desc
        list.sort((a: any, b: any) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1;
        });

        rawItems = list;
      }

      // Fetch comments for each request document in parallel
      const itemsWithComments = await Promise.all(rawItems.map(async (item: any) => {
        try {
          const commentsSnapshot = await col.doc(item.id).collection('comments').orderBy('createdAt', 'asc').get();
          const replies = commentsSnapshot.docs.map((cDoc: any) => {
            const cData = cDoc.data();
            return {
              id: cDoc.id,
              author: cData.authorName || cData.author || 'Anonymous',
              body: cData.comment || cData.body || '',
              date: cData.createdAt ? (cData.createdAt.toDate ? cData.createdAt.toDate().toISOString() : new Date(cData.createdAt).toISOString()) : new Date().toISOString()
            };
          });
          return { ...item, replies };
        } catch (commentErr) {
          console.warn(`Error fetching comments for request ${item.id}:`, commentErr);
          return { ...item, replies: [] };
        }
      }));

      return itemsWithComments;
    } catch (error) {
      console.error('Error in getPrayerRequests:', error);
      return [];
    }
  }

  async submitPrayerRequest(data: any) {
    try {
      const col = await this.getCollection('prayerRequests');
      const textVal = data.text || data.request || data.requestEn || '';
      const textTeVal = data.textTe || data.requestTe || '';
      const authorIdVal = data.authorId || data.contactId || null;
      
      await col.add({
        ...data,
        text: textVal,
        request: textVal,
        requestEn: textVal,
        textTe: textTeVal,
        requestTe: textTeVal,
        authorId: authorIdVal,
        contactId: authorIdVal,
        isAnswered: data.isAnswered ?? false,
        prayCount: data.prayCount ?? 0,
        createdAt: FieldValue.serverTimestamp()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  async markAsAnswered(id: string) {
    try {
      const col = await this.getCollection('prayerRequests');
      await col.doc(id).update({
        isAnswered: true,
        updatedAt: FieldValue.serverTimestamp()
      });
      return true;
    } catch (e) {
      throw e;
    }
  }

  async addPrayerComment(requestId: string, comment: string, authorName: string) {
    try {
      const col = await this.getCollection('prayerRequests');
      await col.doc(requestId).collection('comments').add({
        comment,
        body: comment,
        authorName,
        author: authorName,
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

  async getBibleProgress(churchId: string, memberId: string): Promise<any> {
    try {
      const doc = await firestore().collection('churches').doc(churchId).collection('members').doc(memberId).collection('bible').doc('progress').get();
      return doc.exists() ? doc.data() : null;
    } catch (e) {
      return null;
    }
  }

  async saveBibleProgress(churchId: string, memberId: string, progress: any) {
    try {
      await firestore().collection('churches').doc(churchId).collection('members').doc(memberId).collection('bible').doc('progress').set(progress, { merge: true });
      return true;
    } catch (e) {
      throw e;
    }
  }

  // --- 🌟 Promises ---

  async createDailyPromise(data: any) {
    try {
      const col = await this.getCollection('promises');
      // Strip undefined values to prevent Firestore errors
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      
      if (cleanData.id) {
        await col.doc(cleanData.id as string).set({ ...cleanData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return cleanData.id;
      } else {
        const docRef = await col.add({ ...cleanData, createdAt: FieldValue.serverTimestamp() });
        return docRef.id;
      }
    } catch (e) {
      throw e;
    }
  }

  async getDailyPromisesArchive(): Promise<DailyPromise[]> {
    try {
      const col = await this.getCollection('promises');
      const snapshot = await col.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyPromise));
    } catch (e) {
      return [];
    }
  }


  async getCalendarData(year: number, month: number): Promise<DailyPromise[]> {
    try {
      const col = await this.getCollection('promises');
      const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endStr = `${year}-${String(month).padStart(2, '0')}-31`;
      const snapshot = await col.where('date', '>=', startStr).where('date', '<=', endStr).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyPromise));
    } catch (e) {
      console.error('Error fetching calendar data:', e);
      return [];
    }
  }

  async getDailyPromise(): Promise<DailyPromise | null> {
    try {
      const col = await this.getCollection('promises');
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const snapshot = await col.where('date', '==', todayStr).limit(1).get();
      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DailyPromise;
      }
      return null;
    } catch (e) {
      console.warn('Error fetching daily promise:', e);
      return null;
    }
  }

  // --- 📅 Events ---

  async getEvents(): Promise<ScheduleEvent[]> {
    try {
      const col = await this.getCollection('events');
      const snapshot = await col.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEvent));
    } catch (e) {
      console.error('Error fetching events:', e);
      return [];
    }
  }

  async getTodayEvents(): Promise<ScheduleEvent[]> {
    try {
      const col = await this.getCollection('events');
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const snapshot = await col.where('date', '==', todayStr).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEvent));
    } catch (e) {
      console.error('Error fetching today events:', e);
      return [];
    }
  }

  async getUpcomingEvents(limit: number = 3): Promise<ScheduleEvent[]> {
    try {
      const col = await this.getCollection('events');
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const snapshot = await col.where('date', '>=', todayStr).orderBy('date', 'asc').limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEvent));
    } catch (e) {
      console.error('Error fetching upcoming events:', e);
      return [];
    }
  }

  private generateRecurringDates(startDateStr: string, recurringType: string, monthsAhead: number = 12): string[] {
    const dates: string[] = [];
    const [year, month, day] = startDateStr.split('-').map(Number);
    // Note: JavaScript months are 0-indexed
    let current = new Date(year, month - 1, day);
    const endDate = new Date(year, month - 1 + Number(monthsAhead), day);
    
    while (current <= endDate) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      
      if (recurringType === 'Every week' || recurringType === 'Every Sunday') {
        current.setDate(current.getDate() + 7);
      } else if (recurringType === 'Monthly') {
        current.setMonth(current.getMonth() + 1);
      } else if (recurringType === 'First Sunday') {
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
        while (current.getDay() !== 0) {
          current.setDate(current.getDate() + 1);
        }
      } else {
        break; // Unsupported recurrence type
      }
    }
    return dates;
  }

  async createEvent(data: any) {
    try {
      const col = await this.getCollection('events');
      
      // Extract custom update mode if passed
      const updateMode = data.updateMode; // 'single' | 'future'
      delete data.updateMode;
      
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      
      if (cleanData.id) {
        // UPDATING EXISTING
        if (cleanData.recurringGroupId && updateMode === 'future') {
           const allDocs = await col.where('recurringGroupId', '==', cleanData.recurringGroupId).get();
           const batch = firestore().batch();
           allDocs.docs.forEach(doc => {
             const oldData = doc.data();
             if (oldData.date >= (cleanData.date as string)) {
               const docRef = col.doc(doc.id);
               // Preserve the original specific date of the future occurrence
               const updatePayload = { ...cleanData, date: oldData.date, id: doc.id, updatedAt: FieldValue.serverTimestamp() };
               batch.set(docRef, updatePayload, { merge: true });
             }
           });
           await batch.commit();
           return cleanData.id;
        } else {
           await col.doc(cleanData.id as string).set({ ...cleanData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
           return cleanData.id;
        }
      } else {
        // CREATING NEW
        const isRecurring = cleanData.recurring && cleanData.recurring !== 'One-time event';
        
        if (isRecurring && !cleanData.recurringGroupId) {
          const groupId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          cleanData.recurringGroupId = groupId;
          
          const monthsAhead = (cleanData.recurrenceDuration as number) || 1;
          const futureDates = this.generateRecurringDates(cleanData.date as string, cleanData.recurring as string, monthsAhead);
          const batch = firestore().batch();
          
          let firstId = '';
          futureDates.forEach((dateStr, index) => {
            const docRef = col.doc();
            if (index === 0) firstId = docRef.id;
            
            const instanceData = { 
              ...cleanData, 
              id: docRef.id, 
              date: dateStr, 
              createdAt: FieldValue.serverTimestamp() 
            };
            batch.set(docRef, instanceData);
          });
          
          await batch.commit();
          return firstId;
        } else {
          const docRef = await col.add({ ...cleanData, createdAt: FieldValue.serverTimestamp() });
          return docRef.id;
        }
      }
    } catch (e) {
      throw e;
    }
  }

  async deleteEvent(id: string, deleteMode?: 'single' | 'future') {
    try {
      const col = await this.getCollection('events');
      
      if (deleteMode === 'future') {
        const doc = await col.doc(id).get();
        const data = doc.data();
        if (data) {
          if (data.recurringGroupId) {
             const allDocs = await col.where('recurringGroupId', '==', data.recurringGroupId).get();
             const batch = firestore().batch();
             allDocs.docs.forEach(d => {
               if (d.data().date >= data.date) {
                 batch.delete(d.ref);
               }
             });
             await batch.commit();
             return true;
          }
        }
      }
      
      await col.doc(id).delete();
      return true;
    } catch (e) {
      throw e;
    }
  }

  // --- 🔔 Notifications ---

  async getNotificationPrefs(uid: string) {
    try {
      const docSnap = await firestore().collection('users').doc(uid).get();
      if (docSnap.exists()) {
        return docSnap.data()?.notifications || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async saveNotificationPrefs(uid: string, prefs: any) {
    try {
      await firestore().collection('users').doc(uid).set({
        notifications: prefs,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  async createNotificationBroadcast(data: any) {
    try {
      const col = await this.getCollection('broadcasts');
      const docRef = await col.add({ ...data, createdAt: FieldValue.serverTimestamp() });
      return docRef.id;
    } catch (e) {
      throw e;
    }
  }

  // --- 🎉 Celebrations ---

  async getAllCelebrations(): Promise<any[]> {
    try {
      const col = await this.getCollection('members');
      const snapshot = await col.get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          Id: doc.id,
          Name: data.name || (data.firstName ? data.firstName + ' ' + (data.lastName || '') : 'Unknown'),
          Phone: data.phone || data.mobile,
          Birthdate: data.dateOfBirth || data.dob || data.birthday, // YYYY-MM-DD
          Anniversary_Date__c: data.marriageDate || data.anniversaryDate || data.anniversary, // YYYY-MM-DD
          Gender__c: data.gender || data.Gender__c,
          AccountId: data.accountId || data.familyId || doc.id
        };
      });
    } catch (e) {
      console.error('Error fetching celebrations:', e);
      return [];
    }
  }

  async getTodayBirthdays() {
    try {
      const all = await this.getAllCelebrations();
      const today = new Date();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      return all.filter(c => c.type === 'birthday' && parseInt(c.date.split('-')[1]) === m && parseInt(c.date.split('-')[2]) === d);
    } catch (e) {
      return [];
    }
  }

  async getTodayAnniversaries() {
    try {
      const all = await this.getAllCelebrations();
      const today = new Date();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      return all.filter(c => c.type === 'anniversary' && parseInt(c.date.split('-')[1]) === m && parseInt(c.date.split('-')[2]) === d);
    } catch (e) {
      return [];
    }
  }

  async sendPersonalGreeting(contactId: string, phone: string, title: string, body: string, type: string) {
    try {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      // Write to church-scoped broadcasts (not root)
      const col = await this.getCollection('broadcasts');
      await col.add({
        contactId,
        targetPhone: phone,
        title,
        content: body,
        date: dateStr,
        type: type,
        createdAt: FieldValue.serverTimestamp()
      });
      return true;
    } catch (e) {
      console.error('Error sending personal greeting:', e);
      return false;
    }
  }


  async getPastorEvents(): Promise<any[]> {
    try {
      const col = await this.getCollection('pastorEvents');
      const snapshot = await col.get();
      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (e) {
      console.error('Error fetching pastor events:', e);
      return [];
    }
  }

  async createPastorEvent(payload: any): Promise<{ success: boolean; id?: string }> {
    try {
      const col = await this.getCollection('pastorEvents');
      const docRef = await col.add({
        ...payload,
        createdAt: FieldValue.serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (e) {
      console.error('Error creating pastor event:', e);
      return { success: false };
    }
  }

  async updatePastorEvent(eventId: string, payload: any): Promise<{ success: boolean }> {
    try {
      const col = await this.getCollection('pastorEvents');
      await col.doc(eventId).update({
        ...payload,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (e) {
      console.error('Error updating pastor event:', e);
      return { success: false };
    }
  }

  async deletePastorEvent(eventId: string): Promise<{ success: boolean }> {
    try {
      const col = await this.getCollection('pastorEvents');
      await col.doc(eventId).delete();
      return { success: true };
    } catch (e) {
      console.error('Error deleting pastor event:', e);
      return { success: false };
    }
  }
}

export default new FirestoreService();

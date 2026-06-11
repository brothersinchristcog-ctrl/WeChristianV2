import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions, 
  StatusBar,
  Image
} from 'react-native';
import { MapPin, Clock, Calendar, Trash2 } from 'lucide-react-native';
import { AdminTabContext } from '../../context/AdminTabContext';
import { Alert } from 'react-native';

import SalesforceService from '../../services/SalesforceService';

const { width } = Dimensions.get('window');

export default function AdminEventList() {
  const { setActiveTab, setEditingData } = useContext(AdminTabContext);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await SalesforceService.getEvents();
      console.log('📊 [AdminEventList] Fetched Events:', JSON.stringify(data.slice(0, 2), null, 2));
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingCount = events.filter(e => e.date >= today).length;
  const pastCount = events.filter(e => e.date < today).length;

  const formatDate = (sfDate: string) => {
    if (!sfDate) return '';
    try {
      const d = new Date(sfDate);
      if (isNaN(d.getTime())) return sfDate;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return sfDate;
    }
  };

  const formatDisplayTime = (sfTime: string) => {
    if (!sfTime || typeof sfTime !== 'string') return '';
    // If it's already formatted (e.g. "10:00 AM"), return as is
    if (sfTime.includes('AM') || sfTime.includes('PM')) return sfTime;
    
    try {
      // Salesforce Time field returns HH:mm:ss.SSSZ
      const timePart = sfTime.split('.')[0]; // Get HH:mm:ss
      const [hours, minutes] = timePart.split(':');
      let h = parseInt(hours, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${minutes} ${ampm}`;
    } catch (e) {
      return sfTime;
    }
  };

  const handleEdit = (event: any) => {
    setEditingData(event);
    setActiveTab(8); // Switch to Event Editor tab
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await SalesforceService.deleteEvent(id);
              await fetchEvents();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete event');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FCD34D" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Section Heading ── */}
        <View style={styles.secHd}>
          <View>
            <Text style={styles.secTitle}>📅 Event Manager</Text>
            <Text style={styles.secSub}>Church Gatherings · కూటములు</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={() => { setEditingData(null); setActiveTab(8); }}>
            <Text style={styles.newBtnTxt}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#15803D' }]}>
              {events.filter(e => 
                !e.status || 
                e.status.toLowerCase().includes('pub') || 
                e.status.toLowerCase().includes('act')
              ).length}
            </Text>
            <Text style={styles.statLbl}>Published</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#c0392b' }]}>{upcomingCount}</Text>
            <Text style={styles.statLbl}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#1a2d5a' }]}>{pastCount}</Text>
            <Text style={styles.statLbl}>Past Events</Text>
          </View>
        </View>

        <Text style={styles.listLabel}>Upcoming events</Text>

        {events
          .filter(e => e.date >= today)
          .map((event, idx) => (
          <View key={event.id} style={[styles.eventItem, idx === 0 && styles.featuredItem]}>
            <TouchableOpacity style={[styles.eiThumb, { backgroundColor: event.bannerColor || '#1a2d5a' }]} onPress={() => handleEdit(event)}>
              {event.bannerUrl ? (
                <Image source={{ uri: event.bannerUrl }} style={styles.eiThumbImg} resizeMode="cover" />
              ) : (
                <Text style={styles.eiThumbTxt}>IMG</Text>
              )}
            </TouchableOpacity>
            <View style={styles.eiBody}>
              <Text style={styles.eiTitle} numberOfLines={1}>{event.name || 'No Title'}</Text>
              <Text style={styles.eiTe} numberOfLines={1}>{event.titleTe || ''}</Text>
              <View style={styles.eiMetaRow}>
                <Calendar size={10} color="#c0392b" />
                <Text style={[styles.eiMetaTxt, { color: '#c0392b', fontWeight: '600' }]}>{formatDate(event.date)}</Text>
                
                <Clock size={10} color="#6B7280" style={{ marginLeft: 8 }} />
                <Text style={styles.eiMetaTxt}>
                  {formatDisplayTime(event.startTime)}
                  {event.endTime ? ` — ${formatDisplayTime(event.endTime)}` : ''}
                </Text>
              </View>
              <View style={styles.eiMetaRow}>
                <MapPin size={10} color="#6B7280" />
                <Text style={styles.eiMetaTxt} numberOfLines={1}>{event.venueEn || event.location || 'No Venue'}</Text>
              </View>
              <View style={styles.eiFoot}>
                <View style={[event.status?.toLowerCase().includes('dra') ? styles.badgeDraft : styles.badgePub, { flexShrink: 1 }]}>
                  <Text style={event.status?.toLowerCase().includes('dra') ? styles.badgeDraftTxt : styles.badgePubTxt} numberOfLines={1}>
                    {(event.status || 'Published').toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(event.id, event.name)} style={{ padding: 4 }}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => handleEdit(event)} style={styles.eiEdit}>
                <Text style={{ color: '#1a2d5a', fontSize: 10, fontWeight: '800' }}>Edit →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f7' },
  scroll: { padding: 14, paddingBottom: 80 },

  secHd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#c0392b' },
  secTitle: { fontSize: 15, fontWeight: '600', color: '#1a2d5a' },
  secSub: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  newBtn: { backgroundColor: '#c0392b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 0.5, borderColor: '#e5e7eb' },
  statNum: { fontSize: 22, fontWeight: '600' },
  statLbl: { fontSize: 9, color: '#6B7280', marginTop: 2 },

  listLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },

  eventItem: { backgroundColor: '#fff', borderRadius: 11, borderWidth: 0.5, borderColor: '#e5e7eb', padding: 12, paddingHorizontal: 14, marginBottom: 8, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featuredItem: { borderWidth: 1.5, borderColor: '#1a2d5a', backgroundColor: '#EFF6FF' },
  eiThumb: { width: 100, height: 56, backgroundColor: '#0f172a', borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  eiThumbImg: { width: '100%', height: '100%' },
  eiThumbTxt: { color: '#475569', fontSize: 8, fontWeight: '800' },
  eiBody: { flex: 1 },
  eiTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  eiTe: { fontSize: 11, color: '#1a2d5a', fontStyle: 'italic', marginTop: 1 },
  eiMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  eiMetaTxt: { fontSize: 10, color: '#6B7280', marginLeft: 4 },
  eiFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 4 },
  eiEdit: { position: 'absolute', top: 12, right: 12, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },

  badgePub: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgePubTxt: { color: '#166534', fontSize: 9, fontWeight: '800' },
  badgeDraft: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeDraftTxt: { color: '#475569', fontSize: 9, fontWeight: '800' }
});

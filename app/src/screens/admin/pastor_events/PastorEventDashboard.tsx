import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  StatusBar,
  TextInput,
  Alert
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius, typography, shadow } from '../../../theme/Theme';
import { PastorEvent } from '../../../types/event';
import FirestoreService from '../../../services/FirestoreService';
import EventTypeBadge from '../../../components/EventTypeBadge';
import DistanceBadge from '../../../components/DistanceBadge';
import { getStartingLocation, saveStartingLocation, formatDuration } from '../../../utils/locationStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { openInMaps } from '../../../utils/maps';
import { Audio } from 'expo-av';
import AIAssistantService from '../../../services/AIAssistantService';

// No hardcoded events fallbacks

export const PastorEventDashboard = ({ navigation }: { navigation: any }) => {
  const route = useRoute<any>();
  const [events, setEvents] = useState<PastorEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'past'>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempPickerDate, setTempPickerDate] = useState(new Date());

  // AI Assistant State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  async function startRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        const p = await requestPermission();
        if (p.status !== 'granted') {
           Alert.alert('Microphone Error', 'Microphone permissions are required for the AI assistant.');
           return;
        }
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: r } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(r);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Microphone Error', 'Could not start recording. Make sure permissions are granted.');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setRecording(null);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    if (uri) processAudio(uri);
  }

  async function processAudio(uri: string) {
    setIsProcessing(true);
    try {
      const transcript = await AIAssistantService.transcribeAudio(uri);
      const details = await AIAssistantService.extractEventDetails(transcript);
      navigation.navigate('CreateEvent', { prefill: details });
    } catch (error) {
      console.error('AI Processing Error', error);
      Alert.alert('AI Assistant Error', 'Failed to process voice command. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const sfEvents = await FirestoreService.getPastorEvents();
      if (sfEvents && sfEvents.length > 0) {
        // Categorize into today, upcoming, past
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const categorized = sfEvents.map(evt => {
          let section: 'today' | 'upcoming' | 'past' = 'upcoming';
          if (evt.date === todayStr) {
            section = 'today';
          } else if (evt.date < todayStr) {
            section = 'past';
          }
          return { ...evt, section };
        });
        setEvents(categorized);
      } else {
        setEvents([]);
      }
    } catch (e) {
      console.warn('Error querying Salesforce events:', e);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, []);

  // Helper to convert "9:00 AM" or "1:00 PM" into a sortable minutes-since-midnight integer
  const timeToMins = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(' ');
    if (parts.length < 2) return 0;
    const [time, modifier] = parts;
    let [hours, minutes] = time.split(':');
    let h = parseInt(hours, 10);
    let m = parseInt(minutes || '0', 10);
    if (h === 12) h = 0;
    if (modifier.toUpperCase() === 'PM') h += 12;
    return h * 60 + m;
  };

  // Filter events based on tab OR selected date filter, and sort chronologically ALWAYS
  const filteredEvents = (selectedDateFilter
    ? events.filter(evt => evt.date === selectedDateFilter)
    : events.filter(evt => evt.section === activeTab)
  ).sort((a, b) => {
    const aDate = a.date || '';
    const bDate = b.date || '';
    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }
    return timeToMins(a.startTime) - timeToMins(b.startTime);
  });

  const [dynamicStats, setDynamicStats] = useState({ km: 0, mins: 0, loading: false });
  const [currentLocName, setCurrentLocName] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const calcStats = async () => {
      setDynamicStats({ km: 0, mins: 0, loading: true });
      const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

      let prevLat = 16.3067; // Fallback
      let prevLng = 80.4365;

      try {
        const saved = await getStartingLocation();
        if (saved && saved.lat && saved.lng && saved.name) {
          prevLat = saved.lat;
          prevLng = saved.lng;
          setCurrentLocName(saved.name);
        }
      } catch (e) {
        // Fallback to defaults
      }

      if (!GOOGLE_KEY || filteredEvents.length === 0) {
        setDynamicStats({ km: 0, mins: 0, loading: false });
        return;
      }
      
      try {
        let totalKm = 0;
        let totalMins = 0;

        for (let i = 0; i < filteredEvents.length; i++) {
          const evt = filteredEvents[i];
          if (evt.lat && evt.lng) {
            // First event connects to home base, others connect sequentially
            const originStr = i === 0 ? `${prevLat},${prevLng}` : `${filteredEvents[i-1].lat},${filteredEvents[i-1].lng}`;
            const destStr = `${evt.lat},${evt.lng}`;
            
            const cacheKey = `dist_${originStr}_${destStr}`;
            let distanceValue = 0;
            let durationValue = 0;
            
            try {
              const cached = await AsyncStorage.getItem(cacheKey);
              if (cached) {
                const parsed = JSON.parse(cached);
                distanceValue = parsed.distance;
                durationValue = parsed.duration;
              }
            } catch (e) {}

            if (distanceValue === 0) {
              const distResp = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_KEY}`);
              const distData = await distResp.json();
              if (distData.status === 'OK' && distData.rows[0].elements[0].status === 'OK') {
                const element = distData.rows[0].elements[0];
                distanceValue = element.distance.value;
                durationValue = element.duration.value;
                
                try {
                  await AsyncStorage.setItem(cacheKey, JSON.stringify({ distance: distanceValue, duration: durationValue }));
                } catch (e) {}
              } else {
                console.warn('⚠️ Google Maps API Error:', distData.status, distData.error_message || '(No error message)');
              }
            }
            
            let homeDistanceValue = distanceValue;
            let homeDurationValue = durationValue;

            if (i > 0) {
              const homeOriginStr = `${prevLat},${prevLng}`;
              const homeCacheKey = `dist_${homeOriginStr}_${destStr}`;
              let foundHome = false;
              try {
                const cached = await AsyncStorage.getItem(homeCacheKey);
                if (cached) {
                  const parsed = JSON.parse(cached);
                  homeDistanceValue = parsed.distance;
                  homeDurationValue = parsed.duration;
                  foundHome = true;
                }
              } catch (e) {}

              if (!foundHome) {
                const distResp = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${homeOriginStr}&destinations=${destStr}&key=${GOOGLE_KEY}`);
                const distData = await distResp.json();
                if (distData.status === 'OK' && distData.rows[0].elements[0].status === 'OK') {
                  const element = distData.rows[0].elements[0];
                  homeDistanceValue = element.distance.value;
                  homeDurationValue = element.duration.value;
                  try {
                    await AsyncStorage.setItem(homeCacheKey, JSON.stringify({ distance: homeDistanceValue, duration: homeDurationValue }));
                  } catch (e) {}
                }
              }
            }

            const km = distanceValue / 1000;
            const mins = Math.round(durationValue / 60);

            const homeKm = homeDistanceValue / 1000;
            const homeMins = Math.round(homeDurationValue / 60);
            
            totalKm += km;
            totalMins += mins;
            
            evt.travel = {
              isFirstEvent: i === 0,
              distKm: km,
              car: mins,
              bike: Math.round(mins * 0.9), // Motorcycle is slightly faster in traffic
              bus: Math.round(mins * 1.5), // Rough approximation
              homeDistKm: homeKm,
              homeCar: homeMins,
              prevVenue: i > 0 ? filteredEvents[i-1].venue : undefined
            };
          }
        }
        setDynamicStats({ km: totalKm, mins: totalMins, loading: false });
      } catch(e) {
        console.warn('Dashboard stats calc failed', e);
        setDynamicStats(prev => ({ ...prev, loading: false }));
      }
    };

    calcStats();
  }, [activeTab, selectedDateFilter, events]);

  const handleAddressSubmit = async (newAddress: string) => {
    if (!newAddress.trim()) return;
    const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';
    if (!GOOGLE_KEY) return;
    
    setIsGeocoding(true);
    try {
      const geoResp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(newAddress)}&key=${GOOGLE_KEY}`);
      const geoData = await geoResp.json();
      if (geoData.status === 'OK' && geoData.results.length > 0) {
        const { lat, lng } = geoData.results[0].geometry.location;
        await saveStartingLocation({ name: newAddress, lat, lng });
        
        // Force refresh
        fetchEvents();
      } else {
        alert(`Geocoding failed: ${geoData.status} - ${geoData.error_message || 'Check if Geocoding API is enabled.'}`);
      }
    } catch (e) {
      console.log('Geocoding network failed', e);
      alert('Network error while geocoding the address.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Statistics summaries
  const totalEvents = filteredEvents.length;
  const totalDistance = dynamicStats.km;
  const totalTravelTimeCar = dynamicStats.mins;

  const renderEventCard = ({ item }: { item: PastorEvent }) => {
    // Attempt to extract shortened venue name for the map pin label
    const shortVenue = item.venue ? item.venue.split(' ')[0].substring(0, 8) : 'DEST';

    return (
      <TouchableOpacity
        style={[styles.card, { padding: 16 }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('EventDetail', { event: item, allEvents: events })}
      >
        <Text style={[styles.titleText, { marginBottom: 16, fontSize: 18, color: '#111827' }]}>{item.title}</Text>
        
        <View style={{ gap: 8, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: colors.primary }}>
              {item.date ? item.date.split('-').reverse().join('-') : 'No Date'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: colors.primary }}>
              Start: {item.startTime}{item.endTime ? ` | End: ${item.endTime}` : ''}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
              Meeting length: {item.durationMins >= 60 ? `${Math.round(item.durationMins / 60 * 10) / 10} hours` : `${item.durationMins} mins`}
            </Text>
          </View>
        </View>
        
        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />

        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 }}>
          VENUE & LOCATION
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
          {item.venue || 'No Venue'}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
          {item.address || 'No Address'}
        </Text>
        
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF6FF', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginBottom: 20 }}
          onPress={() => openInMaps(item.lat || 0, item.lng || 0, item.title, item.address || item.venue)}
        >
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text style={{ marginLeft: 8, fontSize: 15, fontWeight: '600', color: colors.primary }}>Get Directions</Text>
        </TouchableOpacity>

        {item.travel && item.travel.distKm > 0 && (
          <View style={{ gap: 8 }}>
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border }}>
              
              <View style={{ alignItems: 'center', width: 60 }}>
                <Ionicons name={item.travel.isFirstEvent ? "home" : "location"} size={26} color={colors.textSecondary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, marginTop: 6, textTransform: 'uppercase' }} numberOfLines={1}>
                  {item.travel.isFirstEvent ? 'HOME' : (item.travel.prevVenue ? item.travel.prevVenue.split(' ')[0].substring(0, 8) : 'PREV')}
                </Text>
              </View>
              
              <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 8 }}>
                  {item.travel.distKm.toFixed(1)} km • {item.travel.car >= 60 ? `${Math.floor(item.travel.car/60)}h ${Math.round(item.travel.car%60)}m` : `${Math.round(item.travel.car)}m`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: colors.border }} />
                  <Ionicons name="car" size={18} color={colors.primary} style={{ marginHorizontal: 8 }} />
                  <View style={{ flex: 1, height: 2, backgroundColor: colors.border }} />
                </View>
              </View>

              <View style={{ alignItems: 'center', width: 60 }}>
                <Ionicons name="location" size={26} color={colors.primary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 6, textTransform: 'uppercase' }} numberOfLines={1}>
                  {shortVenue}
                </Text>
              </View>
            </View>

            {!item.travel.isFirstEvent && item.travel.homeDistKm !== undefined && item.travel.homeDistKm > 0 && (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border }}>
                <View style={{ alignItems: 'center', width: 60 }}>
                  <Ionicons name="home" size={26} color={colors.textSecondary} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, marginTop: 6, textTransform: 'uppercase' }}>
                    HOME
                  </Text>
                </View>
                
                <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 8 }}>
                    {item.travel.homeDistKm.toFixed(1)} km • {item.travel.homeCar >= 60 ? `${Math.floor(item.travel.homeCar/60)}h ${Math.round(item.travel.homeCar%60)}m` : `${Math.round(item.travel.homeCar)}m`}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ flex: 1, height: 2, backgroundColor: colors.border }} />
                    <Ionicons name="car" size={18} color={colors.primary} style={{ marginHorizontal: 8 }} />
                    <View style={{ flex: 1, height: 2, backgroundColor: colors.border }} />
                  </View>
                </View>

                <View style={{ alignItems: 'center', width: 60 }}>
                  <Ionicons name="location" size={26} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 6, textTransform: 'uppercase' }} numberOfLines={1}>
                    {shortVenue}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgSecondary} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>Pastor's Itinerary</Text>
          <Text style={styles.subtitleText}>Manage schedule & travel routing</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.actionIconButton, recording && { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}
            onPress={recording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name={recording ? "mic" : "mic-outline"} size={20} color={recording ? '#EF4444' : colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionIconButton, { marginLeft: spacing.sm }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionIconButton, { backgroundColor: colors.primary, marginLeft: spacing.sm }]}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={tempPickerDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setTempPickerDate(selectedDate);
              const y = selectedDate.getFullYear();
              const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const d = String(selectedDate.getDate()).padStart(2, '0');
              setSelectedDateFilter(`${y}-${m}-${d}`);
            }
          }}
        />
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['today', 'upcoming', 'past'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab, 
              activeTab === tab && !selectedDateFilter && styles.activeTab,
              selectedDateFilter && styles.disabledTab
            ]}
            onPress={() => {
              setSelectedDateFilter(null);
              setActiveTab(tab);
            }}
            disabled={loading}
          >
            <Text style={[styles.tabText, activeTab === tab && !selectedDateFilter && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Filter Indicator Banner */}
      {selectedDateFilter && (
        <View style={styles.filterBanner}>
          <View style={styles.filterBannerLeft}>
            <Ionicons name="funnel-outline" size={14} color={colors.primary} />
            <Text style={styles.filterBannerText}>
              Filtered: {new Date(selectedDateFilter).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.clearFilterButton} 
            onPress={() => setSelectedDateFilter(null)}
          >
            <Text style={styles.clearFilterText}>Show All</Text>
            <Ionicons name="close-circle" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Starting Location Bar */}
      <View style={{ backgroundColor: '#fff', padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.md, elevation: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
          STARTING FROM
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            style={{ flex: 1, backgroundColor: colors.bgSecondary, padding: 8, borderRadius: radius.sm, fontSize: 14, color: colors.textPrimary }}
            value={currentLocName}
            onChangeText={setCurrentLocName}
            onEndEditing={(e) => handleAddressSubmit(e.nativeEvent.text)}
            onSubmitEditing={(e) => handleAddressSubmit(e.nativeEvent.text)}
            placeholder="Type starting address..."
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={{ marginLeft: 8, backgroundColor: colors.primary, padding: 8, borderRadius: radius.sm }}
            onPress={() => handleAddressSubmit(currentLocName)}
            disabled={isGeocoding}
          >
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>Update</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>
          {isGeocoding ? 'Updating...' : 'Press Enter to update distances.'}
        </Text>
      </View>

      {/* Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{totalEvents}</Text>
          <Text style={styles.statLbl}>Events</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{Math.round(totalDistance)} km</Text>
          <Text style={styles.statLbl}>Travel Dist</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{formatDuration(totalTravelTimeCar)}</Text>
          <Text style={styles.statLbl}>Travel Time</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No events found in this section</Text>
          <Text style={styles.emptySubtext}>Use standard Screen Flows to record new pastor events.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEventCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          extraData={dynamicStats}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        />
      )}

      {/* Floating Buttons */}
      <View style={styles.floatingButtonsContainer}>
        <TouchableOpacity
          style={[styles.floatingButton, { backgroundColor: colors.success }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('RoutePlanner', { events: filteredEvents })}
        >
          <Ionicons name="trail-sign" size={24} color="#FFF" />
          <Text style={styles.floatingButtonText}>Route Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('EventMap', { events: filteredEvents })}
        >
          <Ionicons name="map" size={24} color="#FFF" />
          <Text style={styles.floatingButtonText}>Map View</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  welcomeText: {
    ...typography.h1,
    color: colors.primaryDark
  },
  subtitleText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  refreshButton: {
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: 2,
    marginVertical: spacing.sm
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm
  },
  activeTab: {
    backgroundColor: colors.bgPrimary,
    ...shadow.card
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600'
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.bgPrimary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    ...shadow.card
  },
  statBox: {
    alignItems: 'center',
    flex: 1
  },
  statVal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  statLbl: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100
  },
  card: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  },
  titleText: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  venueText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm
  },
  addressText: {
    fontSize: 12,
    color: colors.textTertiary
  },
  travelContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  travelLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md
  },
  emptySubtext: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: 12
  },
  floatingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    gap: 8,
    ...shadow.card
  },
  floatingButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionIconButton: {
    padding: spacing.sm,
    backgroundColor: 'transparent',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38
  },
  disabledTab: {
    opacity: 0.6
  },
  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    marginHorizontal: spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginVertical: spacing.xs,
    ...shadow.card
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  filterBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  }
});

export default PastorEventDashboard;

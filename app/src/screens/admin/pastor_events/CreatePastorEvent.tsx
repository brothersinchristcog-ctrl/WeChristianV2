import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius, typography, shadow } from '../../../theme/Theme';
import FirestoreService from '../../../services/FirestoreService';
import { useAuth } from '../../../context/AuthContext';
import { CustomAlert, AlertButton } from '../../../components/CustomAlert';

export const CreatePastorEvent = ({ route, navigation }: { route: any; navigation: any }) => {
  const { member } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fallbackContactId, setFallbackContactId] = useState<string | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    buttons?: AlertButton[];
  }>({ visible: false, title: '', message: '', type: 'info' });

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // Form State
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // UI state for Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Derived state
  const isFormValid = title.length > 2 && venue.length > 2 && address.length > 5;

  useEffect(() => {
    if (route.params?.prefill) {
      const p = route.params.prefill;
      if (p.title) setTitle(p.title);
      if (p.venue) setVenue(p.venue);
      if (p.address) setAddress(p.address);
      if (p.description) setDescription(p.description);
      if (p.notes) setNotes(p.notes);
      
      if (p.date) {
        const d = new Date(p.date);
        if (!isNaN(d.getTime())) setDate(d);
      }
      
      if (p.startTime) {
        try {
          const st = new Date();
          const [time, modifier] = p.startTime.split(' ');
          let [h, m] = time.split(':').map(Number);
          if (modifier === 'PM' && h < 12) h += 12;
          if (modifier === 'AM' && h === 12) h = 0;
          st.setHours(h, m, 0);
          setStartTime(st);
        } catch (e) {}
      }
      
      if (p.endTime) {
        try {
          const et = new Date();
          const [time, modifier] = p.endTime.split(' ');
          let [h, m] = time.split(':').map(Number);
          if (modifier === 'PM' && h < 12) h += 12;
          if (modifier === 'AM' && h === 12) h = 0;
          et.setHours(h, m, 0);
          setEndTime(et);
        } catch (e) {}
      }
    }
  }, [route.params?.prefill]);

  const durationMinsNum = Math.max(0, (endTime.getTime() - startTime.getTime()) / 60000);
  const durationHoursDerived = durationMinsNum > 0 ? (durationMinsNum / 60).toFixed(1).replace(/\.0$/, '') : '0';

  const editEvent = route?.params?.editEvent;

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title || '');
      setEventType(editEvent.type === 'worship' ? '' : editEvent.type);
      
      if (editEvent.date) setDate(new Date(editEvent.date));
      
      if (editEvent.startTime && typeof editEvent.startTime === 'string') {
        const timeDate = new Date();
        const [time, modifier] = editEvent.startTime.split(' ');
        if (time && modifier) {
          let [hours, minutes] = time.split(':');
          let h = parseInt(hours, 10);
          if (h === 12) h = 0;
          if (modifier.toUpperCase() === 'PM') h += 12;
          timeDate.setHours(h, parseInt(minutes || '0', 10), 0, 0);
          setStartTime(timeDate);
          
          if (editEvent.durationMins) {
            setEndTime(new Date(timeDate.getTime() + editEvent.durationMins * 60000));
          } else {
            setEndTime(new Date(timeDate.getTime() + 60 * 60000));
          }
        }
      }
      
      setVenue(editEvent.venue || '');
      
      // Attempt to strip out the venue from the location string if it matches our pattern "Venue — Address"
      let addr = editEvent.address || '';
      if (editEvent.venue && addr.startsWith(`${editEvent.venue} — `)) {
        addr = addr.substring(editEvent.venue.length + 3);
      }
      setAddress(addr);
      setDescription(editEvent.description || '');
    }
  }, [editEvent]);

  useEffect(() => {
    // If not authenticated or member profile is missing, search Salesforce for an admin contact
    if (!member?.id) {
      const loadFallbackContact = async () => {
        try {
          const admins = await FirestoreService.getAdminMembers();
          if (admins && admins.length > 0) {
            setFallbackContactId(admins[0].Id);
          }
        } catch (e) {
          console.warn('Failed to load fallback admin contact', e);
        }
      };
      loadFallbackContact();
    }
  }, [member]);

  const handleSave = async () => {
    const targetContactId = member?.id || fallbackContactId;
    if (!targetContactId) {
      setAlertConfig({ visible: true, title: 'Salesforce Error', message: 'Could not locate an Admin Contact record to link this event to. Please check your internet connection.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Calculate start and end date times
      const startDateTime = new Date(date);
      startDateTime.setHours(startTime.getHours());
      startDateTime.setMinutes(startTime.getMinutes());
      startDateTime.setSeconds(0);
      startDateTime.setMilliseconds(0);

      const endDateTime = new Date(startDateTime.getTime() + durationMinsNum * 60 * 1000);

      // Build full address with PIN code for geocoding
      const fullAddress = pinCode
        ? `${address.trim()}, ${pinCode.trim()}`
        : address.trim();

      let lat = 0;
      let lng = 0;
      const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

      if (GOOGLE_KEY && fullAddress) {
        try {
          const geoResp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_KEY}`);
          const geoData = await geoResp.json();
          if (geoData.status === 'OK' && geoData.results.length > 0) {
            lat = geoData.results[0].geometry.location.lat;
            lng = geoData.results[0].geometry.location.lng;
          }
        } catch (e) {
          console.warn('Geocoding failed for event creation', e);
        }
      }

      // Construct Firestore Event payload matching PastorEvent interface
      const payload: any = {
        title,
        type: eventType || 'meeting',
        date: startDateTime.toISOString().split('T')[0],
        startTime: startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }),
        endTime: endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }),
        durationMins: durationMinsNum,
        venue: venue.trim(),
        address: fullAddress,
        lat,
        lng,
        description: description.trim(),
        notes: notes.trim()
      };

      const executeSave = async () => {
        try {
          if (editEvent) {
            await FirestoreService.updatePastorEvent(editEvent.id, payload);
            setAlertConfig({
              visible: true,
              title: 'Success',
              message: 'Pastor event updated successfully!',
              type: 'success',
              buttons: [{ text: 'OK', onPress: () => { closeAlert(); navigation.goBack(); } }]
            });
          } else {
            await FirestoreService.createPastorEvent(payload);
            setAlertConfig({
              visible: true,
              title: 'Success',
              message: 'Pastor event created successfully!',
              type: 'success',
              buttons: [{ text: 'OK', onPress: () => { closeAlert(); navigation.goBack(); } }]
            });
          }
        } catch (e: any) {
          const msg = e?.message || 'An unexpected error occurred.';
          console.error('❌ [CreatePastorEvent] Save failed:', msg);
          setAlertConfig({ visible: true, title: 'Save Failed', message: msg, type: 'error' });
        } finally {
          setLoading(false);
        }
      };

      // --- Schedule Conflict Detection Logic ---
      try {
        if (GOOGLE_KEY) {
          const existingEvents = await FirestoreService.getPastorEvents();
          
          // Helper to parse the 12-hour AM/PM string into a comparable Date
          const parseTime = (timeStr: string, dateObj: Date) => {
            if (!timeStr) return new Date(dateObj);
            const parts = timeStr.split(' ');
            if (parts.length < 2) return new Date(dateObj);
            const [time, modifier] = parts;
            let [hours, minutes] = time.split(':');
            let h = parseInt(hours || '0', 10);
            if (h === 12) h = 0;
            if (modifier && modifier.toUpperCase() === 'PM') h += 12;
            const d = new Date(dateObj);
            d.setHours(h, parseInt(minutes || '0', 10), 0, 0);
            return d;
          };

          const targetDateStr = startDateTime.toISOString().split('T')[0];
          
          const sameDayEvents = existingEvents
            .filter((e: any) => e.date === targetDateStr && e.id !== editEvent?.id)
            .sort((a: any, b: any) => parseTime(a.startTime, startDateTime).getTime() - parseTime(b.startTime, startDateTime).getTime());

          const newEventStartMs = startDateTime.getTime();
          
          // Find the event that happens immediately BEFORE this new event
          const prevEvents = sameDayEvents.filter(e => parseTime(e.startTime, startDateTime).getTime() < newEventStartMs);
          
          if (prevEvents.length > 0) {
            const prevEvent = prevEvents[prevEvents.length - 1];

            if (lat && lng && prevEvent.lat && prevEvent.lng) {
              const origins = `${prevEvent.lat},${prevEvent.lng}`;
              const destinations = `${lat},${lng}`;
              const distResp = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${GOOGLE_KEY}`);
              const distData = await distResp.json();

              if (distData.status === 'OK' && distData.rows[0].elements[0].status === 'OK') {
                const travelTimeSeconds = distData.rows[0].elements[0].duration.value;
                const travelTimeMins = Math.round(travelTimeSeconds / 60);
                
                const prevStartTimeMs = parseTime(prevEvent.startTime, startDateTime).getTime();
                const prevEndTimeMs = prevStartTimeMs + ((prevEvent.durationMins || 60) * 60000);
                
                const requiredArrivalTimeMs = prevEndTimeMs + (travelTimeMins * 60000);
                
                if (requiredArrivalTimeMs > newEventStartMs) {
                  setAlertConfig({
                    visible: true,
                    title: 'Schedule Conflict',
                    message: `Insufficient travel time between your previous stop (${prevEvent.title}) and this new location.\n\nEstimated travel time is ${travelTimeMins >= 60 ? `${Math.round(travelTimeMins / 60 * 10) / 10} hours` : `${travelTimeMins} minutes`}.`,
                    type: 'warning',
                    buttons: [
                      { text: 'Cancel', style: 'cancel', onPress: () => { setLoading(false); closeAlert(); } },
                      { text: 'Proceed Anyway', onPress: () => { closeAlert(); executeSave(); } }
                    ]
                  });
                  return; // Pause here!
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Conflict detection failed, proceeding with save.', err);
      }

      await executeSave();

    } catch (e: any) {
      const msg = e?.message || 'An unexpected error occurred.';
      console.error('❌ [CreatePastorEvent] Pre-save failed:', msg);
      setAlertConfig({ visible: true, title: 'Save Failed', message: msg, type: 'error' });
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgPrimary} />
      
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={closeAlert}
      />

      {/* Validation Handlers */}
      {(() => {
        // Exposing these for the next buttons, though we could just put them in the component body
      })()}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editEvent ? 'Edit Pastor Event' : 'Create Pastor Event'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stepper UI */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ alignItems: 'center', width: 80 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step >= 1 ? colors.primary : '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: step >= 1 ? '#FFF' : '#64748B', fontWeight: 'bold' }}>1</Text>
          </View>
          <Text style={{ fontSize: 12, marginTop: 4, color: step >= 1 ? colors.primary : '#64748B', fontWeight: step >= 1 ? '700' : '500' }}>Event Info</Text>
        </View>
        <View style={{ height: 2, flex: 1, backgroundColor: step >= 2 ? colors.primary : '#E2E8F0', maxWidth: 40 }} />
        <View style={{ alignItems: 'center', width: 80 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step >= 2 ? colors.primary : '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: step >= 2 ? '#FFF' : '#64748B', fontWeight: 'bold' }}>2</Text>
          </View>
          <Text style={{ fontSize: 12, marginTop: 4, color: step >= 2 ? colors.primary : '#64748B', fontWeight: step >= 2 ? '700' : '500' }}>Destination</Text>
        </View>
        <View style={{ height: 2, flex: 1, backgroundColor: step >= 3 ? colors.primary : '#E2E8F0', maxWidth: 40 }} />
        <View style={{ alignItems: 'center', width: 80 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step >= 3 ? colors.primary : '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: step >= 3 ? '#FFF' : '#64748B', fontWeight: 'bold' }}>3</Text>
          </View>
          <Text style={{ fontSize: 12, marginTop: 4, color: step >= 3 ? colors.primary : '#64748B', fontWeight: step >= 3 ? '700' : '500' }}>Notes</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Event Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={[styles.input, errors.title ? { borderColor: colors.error } : null]}
                placeholderTextColor={colors.textTertiary}
                placeholder="e.g. Sunday Service & Prayer"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                }}
              />
              {errors.title ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.title}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Type</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={colors.textTertiary}
                placeholder="e.g. Worship Service, Prayer Meeting"
                value={eventType}
                onChangeText={setEventType}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dropdownText}>
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Start Time *</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.dropdownText}>
                    {startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="default"
                    is24Hour={false}
                    onChange={(event, selectedTime) => {
                      setShowTimePicker(false);
                      if (selectedTime) setStartTime(selectedTime);
                    }}
                  />
                )}
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
                <Text style={styles.label}>End Time *</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setShowEndTimePicker(true)}>
                  <Text style={styles.dropdownText}>
                    {endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showEndTimePicker && (
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="default"
                    is24Hour={false}
                    onChange={(event, selectedTime) => {
                      setShowEndTimePicker(false);
                      if (selectedTime) setEndTime(selectedTime);
                    }}
                  />
                )}
              </View>
            </View>
            {errors.time ? <Text style={{ color: colors.error, fontSize: 12, marginTop: -8, marginBottom: spacing.md }}>{errors.time}</Text> : null}

            <View style={[styles.inputGroup, { marginTop: errors.time ? 0 : spacing.md }]}>
              <Text style={styles.label}>Meeting Length (Calculated)</Text>
              <View style={[styles.input, { backgroundColor: colors.bgSecondary, justifyContent: 'center' }]}>
                <Text style={{ color: colors.textPrimary }}>
                  {durationHoursDerived} Hour{parseFloat(durationHoursDerived) !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                let newErrors: any = {};
                let valid = true;
                if (!title.trim()) {
                  newErrors.title = 'Event Title is required';
                  valid = false;
                }
                if (endTime <= startTime) {
                  newErrors.time = 'End Time must be after Start Time';
                  valid = false;
                }
                setErrors(newErrors);
                if (valid) setStep(2);
              }}
            >
              <Text style={styles.saveButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Destination</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Venue Name *</Text>
              <TextInput
                style={[styles.input, errors.venue ? { borderColor: colors.error } : null]}
                placeholderTextColor={colors.textTertiary}
                placeholder="e.g. Kurnool"
                value={venue}
                onChangeText={(text) => {
                  setVenue(text);
                  if (errors.venue) setErrors(prev => ({ ...prev, venue: '' }));
                }}
              />
              {errors.venue ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.venue}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Address * (Used for Maps Routing)</Text>
              <TextInput
                style={[styles.input, styles.textArea, errors.address ? { borderColor: colors.error } : null]}
                placeholderTextColor={colors.textTertiary}
                placeholder="e.g. Nandyal Check Post, Kurnool, AP, 518002"
                multiline
                numberOfLines={3}
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                }}
              />
              {errors.address ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.address}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PIN Code * (Improves map accuracy)</Text>
              <TextInput
                style={[styles.input, errors.pinCode ? { borderColor: colors.error } : null]}
                placeholderTextColor={colors.textTertiary}
                placeholder="e.g. 518002"
                keyboardType="numeric"
                maxLength={10}
                value={pinCode}
                onChangeText={(text) => {
                  setPinCode(text);
                  if (errors.pinCode) setErrors(prev => ({ ...prev, pinCode: '' }));
                }}
              />
              {errors.pinCode ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.pinCode}</Text> : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.md }}>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setStep(1)}
              >
                <Text style={[styles.saveButtonText, { color: colors.textPrimary }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={() => {
                  let newErrors: any = {};
                  let valid = true;
                  if (!venue.trim()) {
                    newErrors.venue = 'Venue Name is required';
                    valid = false;
                  }
                  if (!address.trim()) {
                    newErrors.address = 'Full Address is required for maps routing';
                    valid = false;
                  }
                  if (!pinCode.trim()) {
                    newErrors.pinCode = 'PIN Code is required';
                    valid = false;
                  }
                  setErrors(newErrors);
                  if (valid) setStep(3);
                }}
              >
                <Text style={styles.saveButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Additional Context</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholderTextColor={colors.textTertiary}
                placeholder="What is this itinerary appointment for?"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Special Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholderTextColor={colors.textTertiary}
                placeholder="Any items to bring, contacts to meet, or preparations to make?"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.md }}>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setStep(2)}
              >
                <Text style={[styles.saveButtonText, { color: colors.textPrimary }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>{editEvent ? 'Update Event' : 'Create Event'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 56,
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    padding: spacing.xs
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center'
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card
  },
  cardTitle: {
    ...typography.h3,
    color: colors.primaryDark,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgTertiary,
    paddingBottom: spacing.xs
  },
  inputGroup: {
    marginBottom: spacing.md
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.bgSecondary
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  row: {
    flexDirection: 'row'
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: colors.bgSecondary
  },
  dropdownText: {
    fontSize: 14,
    color: colors.textPrimary
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.bgPrimary,
    ...shadow.card
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgTertiary
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryLight
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.textPrimary
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '600'
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    ...shadow.card
  },
  saveButtonDisabled: {
    backgroundColor: colors.textTertiary
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700'
  }
});

export default CreatePastorEvent;

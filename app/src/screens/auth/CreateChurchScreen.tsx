import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useChurch } from '../../context/ChurchContext';
import { useAuth } from '../../context/AuthContext';
import { firestore, FieldValue } from '../../services/firebaseConfig';
import { ChevronLeft, Building2, Palette, Phone, Mail, Globe, Check } from 'lucide-react-native';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'CreateChurch'>;
};

const PRESET_COLORS = [
  '#1a2d5a', '#c0392b', '#16a34a', '#7c3aed',
  '#b45309', '#0891b2', '#be185d', '#334155',
];

function generateChurchCode(name: string): string {
  // Take first letters of each word, max 6 chars
  const initials = name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return (initials + random).substring(0, 8);
}

export default function CreateChurchScreen({ navigation }: Props) {
  const { setChurchId } = useChurch();
  const { member } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    website: '',
  });
  const [primaryColor, setPrimaryColor] = useState('#1a2d5a');
  const [secondaryColor, setSecondaryColor] = useState('#c0392b');

  const updateForm = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Please enter your church name.');
      return;
    }
    if (!form.contactEmail.trim()) {
      Alert.alert('Required', 'Please enter a contact email.');
      return;
    }
    setLoading(true);
    try {
      const churchCode = generateChurchCode(form.name);
      const churchData = {
        name: form.name.trim(),
        subdomain: churchCode.toLowerCase(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        address: form.address.trim(),
        theme: {
          primaryColor,
          secondaryColor,
          backgroundColor: '',
          textColor: '',
          logoUrl: '',
          bannerUrl: '',
        },
        socialLinks: {
          website: form.website.trim(),
        },
        features: {
          hasSermons: true,
          hasDailyPromises: true,
          hasWorshipSongs: true,
          hasGiving: true,
        },
        createdBy: member?.id || '',
        createdAt: FieldValue.serverTimestamp(),
        memberCount: 1,
        subscriptionTier: 'free',
      };

      const docRef = await firestore().collection('churches').add(churchData);

      // Update the creator's profile to be admin of this church
      if (member?.id) {
        await firestore().collection('member_profiles').doc(member.id).update({
          churchId: docRef.id,
          userType: 'Admin',
        });
      }

      await setChurchId(docRef.id);
      navigation.replace('JoinSuccess', { churchName: form.name, isNewChurch: true, churchCode });
    } catch (e: any) {
      console.error('Error creating church:', e);
      Alert.alert('Error', 'Failed to create church. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Register Church</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Building2 size={20} color="#fbbf24" />
            <Text style={styles.infoTxt}>
              Register your church to get started. You'll receive a unique Church Code to share with your members.
            </Text>
          </View>

          {/* Church Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CHURCH INFORMATION</Text>

            <Text style={styles.fieldLabel}>Church Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Church of God, Bangalore"
              placeholderTextColor="#64748b"
              value={form.name}
              onChangeText={v => updateForm('name', v)}
            />

            <Text style={styles.fieldLabel}>Contact Email *</Text>
            <View style={styles.inputRow}>
              <Mail size={16} color="#64748b" />
              <TextInput
                style={styles.inputFlex}
                placeholder="pastor@church.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.contactEmail}
                onChangeText={v => updateForm('contactEmail', v)}
              />
            </View>

            <Text style={styles.fieldLabel}>Contact Phone</Text>
            <View style={styles.inputRow}>
              <Phone size={16} color="#64748b" />
              <TextInput
                style={styles.inputFlex}
                placeholder="+91 99887 76655"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={form.contactPhone}
                onChangeText={v => updateForm('contactPhone', v)}
              />
            </View>

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Street, City, State"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
              value={form.address}
              onChangeText={v => updateForm('address', v)}
            />

            <Text style={styles.fieldLabel}>Website</Text>
            <View style={styles.inputRow}>
              <Globe size={16} color="#64748b" />
              <TextInput
                style={styles.inputFlex}
                placeholder="https://yourchurch.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="url"
                value={form.website}
                onChangeText={v => updateForm('website', v)}
              />
            </View>
          </View>

          {/* Branding */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Palette size={12} color="#94a3b8" /> {'  '}CHURCH BRANDING
            </Text>
            <Text style={styles.brandingNote}>
              Choose your church's primary and accent colors.
            </Text>

            <Text style={styles.fieldLabel}>Primary Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c },
                    primaryColor === c && styles.colorSwatchSelected]}
                  onPress={() => setPrimaryColor(c)}
                >
                  {primaryColor === c && <Check size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Accent Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c },
                    secondaryColor === c && styles.colorSwatchSelected]}
                  onPress={() => setSecondaryColor(c)}
                >
                  {secondaryColor === c && <Check size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: primaryColor }]}>
              <View style={[styles.previewAccent, { backgroundColor: secondaryColor }]} />
              <Text style={styles.previewTxt}>{form.name || 'Your Church Name'}</Text>
              <Text style={styles.previewSub}>Preview</Text>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: primaryColor }, loading && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnTxt}>Register Church</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            By registering, you agree to WeChristian's terms of service. You will be set as the Admin of this church.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },

  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },

  infoBanner: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14,
    marginBottom: 24, borderLeftWidth: 3, borderLeftColor: '#fbbf24',
  },
  infoTxt: { flex: 1, color: '#cbd5e1', fontSize: 13, lineHeight: 20 },

  section: { marginBottom: 28 },
  sectionTitle: {
    color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: 16,
  },

  fieldLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },

  input: {
    backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: '#f8fafc',
    borderWidth: 1, borderColor: '#334155',
  },
  inputMulti: { height: 70, textAlignVertical: 'top' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, borderWidth: 1, borderColor: '#334155',
  },
  inputFlex: { flex: 1, fontSize: 14, color: '#f8fafc' },

  brandingNote: { color: '#64748b', fontSize: 12, marginBottom: 12 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3, borderColor: '#fff',
  },

  preview: {
    borderRadius: 14, padding: 20, marginTop: 16,
    alignItems: 'center', overflow: 'hidden', minHeight: 80,
  },
  previewAccent: {
    position: 'absolute', top: 0, right: 0, width: 60, height: 60,
    borderBottomLeftRadius: 60, opacity: 0.6,
  },
  previewTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  previewSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },

  submitBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    marginBottom: 16, elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});

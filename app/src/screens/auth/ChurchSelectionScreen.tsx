import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useChurch } from '../../context/ChurchContext';
import { Church, Search, ArrowRight, Plus } from 'lucide-react-native';
import ChurchService, { ChurchDetails } from '../../services/ChurchService';
import { SubscriptionGuard } from '../../services/SubscriptionGuard';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ChurchSelection'>;
};

export default function ChurchSelectionScreen({ navigation }: Props) {
  const { setChurchId } = useChurch();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ChurchDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [tab, setTab] = useState<'code' | 'search'>('code');

  const handleJoinByCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      Alert.alert('Invalid Code', 'Please enter a valid Church Code.');
      return;
    }
    setLoading(true);
    try {
      const church = await ChurchService.getChurchBySubdomain(trimmed.toLowerCase());
      if (church) {
        // Enforce subscription tier limit
        const guard = new SubscriptionGuard(church);
        const check = guard.canAddMember();
        if (!check.allowed) {
          Alert.alert('Church Full', check.message);
          return;
        }
        await setChurchId(church.id);
        await SubscriptionGuard.incrementMemberCount(church.id);
        navigation.replace('JoinSuccess', { churchName: church.name });
      } else {
        Alert.alert('Not Found', 'No church found with that code. Please check and try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchTerm.trim().length < 2) return;
    setSearchLoading(true);
    try {
      const all = await ChurchService.getAllChurches();
      const filtered = all.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSearchResults(filtered);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectChurch = async (church: ChurchDetails) => {
    setLoading(true);
    try {
      // Enforce subscription tier limit
      const guard = new SubscriptionGuard(church);
      const check = guard.canAddMember();
      if (!check.allowed) {
        Alert.alert('Church Full', check.message);
        return;
      }
      await setChurchId(church.id);
      await SubscriptionGuard.incrementMemberCount(church.id);
      navigation.replace('JoinSuccess', { churchName: church.name });
    } catch (e) {
      Alert.alert('Error', 'Could not join church. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Church size={40} color="#fff" />
              </View>
              <Text style={styles.title}>Join Your Church</Text>
              <Text style={styles.subtitle}>
                Connect with your church community on WeChristian
              </Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'code' && styles.tabActive]}
                onPress={() => setTab('code')}
              >
                <Text style={[styles.tabTxt, tab === 'code' && styles.tabTxtActive]}>
                  Church Code
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'search' && styles.tabActive]}
                onPress={() => setTab('search')}
              >
                <Text style={[styles.tabTxt, tab === 'search' && styles.tabTxtActive]}>
                  Search
                </Text>
              </TouchableOpacity>
            </View>

            {/* Code Tab */}
            {tab === 'code' && (
              <View style={styles.section}>
                <Text style={styles.label}>ENTER CHURCH CODE</Text>
                <Text style={styles.hint}>
                  Your church admin will provide you with a unique code (e.g. COGBLR)
                </Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="e.g. COGBLR"
                  placeholderTextColor="#94a3b8"
                  value={code}
                  onChangeText={t => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, (!code.trim() || loading) && styles.btnDisabled]}
                  onPress={handleJoinByCode}
                  disabled={!code.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnTxt}>Join Church</Text>
                      <ArrowRight size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Search Tab */}
            {tab === 'search' && (
              <View style={styles.section}>
                <Text style={styles.label}>SEARCH BY NAME</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search church name..."
                    placeholderTextColor="#94a3b8"
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                  <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    {searchLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Search size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {searchResults.length > 0 && (
                  <View style={styles.resultsList}>
                    {searchResults.map(church => (
                      <TouchableOpacity
                        key={church.id}
                        style={styles.resultCard}
                        onPress={() => handleSelectChurch(church)}
                        disabled={loading}
                      >
                        <View style={[styles.resultDot, { backgroundColor: church.theme?.primaryColor || '#1a2d5a' }]} />
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName}>{church.name}</Text>
                          {church.address && (
                            <Text style={styles.resultAddr}>{church.address}</Text>
                          )}
                        </View>
                        <ArrowRight size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchResults.length === 0 && searchTerm.length > 0 && !searchLoading && (
                  <Text style={styles.noResults}>No churches found. Try a different name.</Text>
                )}
              </View>
            )}

            {/* Create Church */}
            <View style={styles.createSection}>
              <Text style={styles.createTitle}>Are you a Church Admin?</Text>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('CreateChurch')}
              >
                <Plus size={18} color="#1a2d5a" />
                <Text style={styles.createBtnTxt}>Register Your Church</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, padding: 24 },

  header: { alignItems: 'center', marginBottom: 32, marginTop: 16 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1a2d5a', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1a2d5a', shadowOpacity: 0.6, shadowRadius: 20, elevation: 10,
  },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  tabs: {
    flexDirection: 'row', backgroundColor: '#1e293b',
    borderRadius: 12, padding: 4, marginBottom: 28,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#1a2d5a' },
  tabTxt: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  tabTxtActive: { color: '#fff' },

  section: { marginBottom: 32 },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  hint: { color: '#64748b', fontSize: 12, marginBottom: 14, lineHeight: 18 },

  codeInput: {
    backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 20,
    paddingVertical: 18, fontSize: 22, fontWeight: '800', color: '#f8fafc',
    letterSpacing: 4, textAlign: 'center', borderWidth: 1, borderColor: '#334155',
    marginBottom: 20,
  },

  primaryBtn: {
    backgroundColor: '#1a2d5a', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    elevation: 4, shadowColor: '#1a2d5a', shadowOpacity: 0.5, shadowRadius: 10,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchInput: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, color: '#f8fafc', borderWidth: 1, borderColor: '#334155',
  },
  searchBtn: {
    backgroundColor: '#1a2d5a', borderRadius: 12,
    width: 52, justifyContent: 'center', alignItems: 'center',
  },

  resultsList: { gap: 10 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: '#334155',
  },
  resultDot: { width: 12, height: 12, borderRadius: 6 },
  resultInfo: { flex: 1 },
  resultName: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  resultAddr: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  noResults: { color: '#64748b', textAlign: 'center', marginTop: 16, fontSize: 13 },

  createSection: {
    borderTopWidth: 1, borderTopColor: '#1e293b',
    paddingTop: 28, alignItems: 'center', gap: 12,
  },
  createTitle: { color: '#64748b', fontSize: 13 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
  },
  createBtnTxt: { color: '#1a2d5a', fontSize: 14, fontWeight: '700' },
});

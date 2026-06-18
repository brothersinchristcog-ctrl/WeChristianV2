import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Dimensions, 
  Platform,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Users, Phone, Mail, ChevronDown, ChevronUp, Clock, UserCheck } from 'lucide-react-native';
import FirestoreService from '../../services/FirestoreService';

const { width } = Dimensions.get('window');

export default function AdminMembers() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMembers = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await FirestoreService.getAdminMembers();
      setMembers(data);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err?.message || 'Failed to fetch members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handlePromoteAdmin = async (memberId: string) => {
    try {
      setLoading(true);
      const success = await FirestoreService.updateMemberRole(memberId, 'admin');
      if (success) {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, userType: 'admin' } : m));
      } else {
        setError('Failed to promote member');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const totalMembers = members.length;
  const activeMembers = members.length; // Assuming all firebase members are active for now
  const inactiveMembers = 0;

  const handleToggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const formatLastAppOpened = (dateVal: any) => {
    if (!dateVal) return 'Never';
    try {
      let date: Date;
      // Handle Firestore Timestamp objects
      if (dateVal && typeof dateVal.toDate === 'function') {
        date = dateVal.toDate();
      } else if (dateVal && typeof dateVal._seconds === 'number') {
        date = new Date(dateVal._seconds * 1000);
      } else if (dateVal && typeof dateVal.seconds === 'number') {
        date = new Date(dateVal.seconds * 1000);
      } else {
        date = new Date(dateVal);
      }
      
      if (isNaN(date.getTime())) return String(dateVal);
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      
      return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return String(dateVal);
    }
  };

  const filteredMembers = members.filter(m => {
    // Map Firebase schema fields
    const nameStr = (m.name || m.firstName || '').toLowerCase();
    const emailStr = (m.email || '').toLowerCase();
    const phoneStr = m.phone || '';
    
    const matchesSearch = 
      nameStr.includes(searchQuery.toLowerCase()) ||
      emailStr.includes(searchQuery.toLowerCase()) ||
      phoneStr.includes(searchQuery);

    const isActive = true; // Assuming active by default in Firebase
    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Active' && isActive) ||
      (statusFilter === 'Inactive' && !isActive);

    return matchesSearch && matchesStatus;
  });

  if (loading && members.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a2d5a" />
        <Text style={{ marginTop: 10, color: '#1a2d5a', fontWeight: '600' }}>Loading members...</Text>
      </View>
    );
  }

  if (error && members.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTxt}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMembers()}>
          <Text style={styles.retryBtnTxt}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMembers(true)}
            colors={['#1a2d5a']}
          />
        }
      >
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Church Members</Text>
            <Text style={styles.subtitle}>Directory & Status Tracking</Text>
          </View>
          <View style={styles.headerIconCircle}>
            <Users size={20} color="#fff" />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#1a2d5a' }]}>{totalMembers}</Text>
            <Text style={styles.statLbl}>Total Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#15803D' }]}>{activeMembers}</Text>
            <Text style={styles.statLbl}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#c0392b' }]}>{inactiveMembers}</Text>
            <Text style={styles.statLbl}>Inactive</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <TextInput
            placeholder="Search by name, email, or phone..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['All', 'Active', 'Inactive'] as const).map(filter => (
            <TouchableOpacity 
              key={filter} 
              style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text style={[styles.filterChipTxt, statusFilter === filter && styles.filterChipTxtActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Member Cards List */}
        <View style={styles.membersList}>
          {filteredMembers.map((member) => {
            const isExpanded = expandedId === member.id;
            const associated = member.accountId
              ? members.filter(m => m.accountId === member.accountId && m.id !== member.id)
              : [];
            const isActive = true; // Placeholder for future active/inactive flag in Firebase
            const displayName = (`${member.firstName || ''} ${member.lastName || ''}`.trim()) || member.name || 'Unknown';
            const displayRole = member.userType || 'member';

            return (
              <View 
                key={member.id} 
                style={[styles.memberCard, isExpanded && styles.memberCardExpanded]}
              >
                <TouchableOpacity 
                  style={styles.cardHeader} 
                  activeOpacity={0.7}
                  onPress={() => handleToggleExpand(member.id)}
                >
                  <View style={styles.profileSection}>
                    {member.profilePhoto ? (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>{getInitials(displayName)}</Text>
                        {/* Placeholder for actual image if needed */}
                      </View>
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>{getInitials(displayName)}</Text>
                      </View>
                    )}
                    <View style={styles.nameSection}>
                      <Text style={styles.name}>{displayName}</Text>
                      <View style={badgeRowStyles(isActive).badgeRow}>
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleTxt}>{displayRole.toUpperCase()}</Text>
                        </View>
                        <View style={[
                          styles.statusBadge, 
                          isActive ? styles.statusActive : styles.statusInactive
                        ]}>
                          <Text style={styles.statusTxt}>{isActive ? 'Active' : 'Inactive'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.chevronWrap}>
                    {isExpanded ? (
                      <ChevronUp size={18} color="#6B7280" />
                    ) : (
                      <ChevronDown size={18} color="#6B7280" />
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.contactDetails}>
                  <View style={styles.contactRow}>
                    <Phone size={12} color="#6B7280" />
                    <Text style={styles.contactTxt}>{member.phone || 'No Phone'}</Text>
                  </View>
                  <View style={styles.contactRow}>
                    <Mail size={12} color="#6B7280" />
                    <Text style={styles.contactTxt}>{member.email || 'No Email'}</Text>
                  </View>
                </View>

                {isExpanded && (
                  <View style={styles.expandedContent}>


                    {/* App Activity Stats */}
                    <View style={styles.statsSubGrid}>
                      <View style={styles.subStatBox}>
                        <View style={styles.subStatLabelRow}>
                          <Clock size={12} color="#c0392b" />
                          <Text style={styles.subStatLabel}>Last App Opened</Text>
                        </View>
                        <Text style={styles.subStatValue}>{formatLastAppOpened(member.lastLogin || member.lastAppOpened)}</Text>
                      </View>
                      <View style={styles.subStatBox}>
                        <View style={styles.subStatLabelRow}>
                          <UserCheck size={12} color="#15803D" />
                          <Text style={styles.subStatLabel}>Household Contacts</Text>
                        </View>
                        <Text style={styles.subStatValue}>
                          {associated.length} Associated
                        </Text>
                      </View>
                    </View>

                    {/* Admin Actions */}
                    {displayRole !== 'admin' && (
                      <TouchableOpacity 
                        style={styles.promoteBtn}
                        onPress={() => handlePromoteAdmin(member.id)}
                      >
                        <UserCheck size={14} color="#fff" />
                        <Text style={styles.promoteBtnTxt}>Promote to Admin</Text>
                      </TouchableOpacity>
                    )}

                    {/* Household Members breakdown */}
                    <Text style={styles.householdHeader}>
                      HOUSEHOLD: {displayName.toUpperCase()}
                    </Text>

                    <View style={styles.householdList}>
                      {associated.length > 0 ? (
                        associated.map((assoc) => (
                          <View key={assoc.id} style={styles.householdItem}>
                            <View style={styles.hiLeft}>
                              <Text style={styles.hiName}>{(`${assoc.firstName || ''} ${assoc.lastName || ''}`.trim()) || assoc.name}</Text>
                              <Text style={styles.hiEmail}>{assoc.email || assoc.phone || 'No contact details'}</Text>
                            </View>
                            <View style={styles.hiRight}>
                              <Text style={styles.hiRelation}>{assoc.userType || 'Member'}</Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyHouseholdTxt}>
                          No other household contacts registered.
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.footerBranding}>Church Admin · Member Activity Logs</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Separate function for dynamic badge styling to keep code clean
const badgeRowStyles = (isActive: boolean) => StyleSheet.create({
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f7', padding: 20 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f7', padding: 20 },
  errorTxt: { fontSize: 14, color: '#c0392b', textAlign: 'center', marginBottom: 15, fontWeight: '600' },
  retryBtn: { backgroundColor: '#1a2d5a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scroll: { padding: 16 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#c0392b', 
    paddingBottom: 10 
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1a2d5a' },
  subtitle: { fontSize: 10, color: '#9CA3AF' },
  headerIconCircle: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#1a2d5a', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    paddingVertical: 15, 
    alignItems: 'center', 
    borderWidth: 0.5, 
    borderColor: '#e5e7eb' 
  },
  statVal: { fontSize: 24, fontWeight: '700' },
  statLbl: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  searchBarContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    height: 44, 
    justifyContent: 'center', 
    borderWidth: 0.5, 
    borderColor: '#d1d5db', 
    marginBottom: 12 
  },
  searchInput: { fontSize: 14, color: '#111827' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#E5E7EB', 
    borderWidth: 0.5, 
    borderColor: '#D1D5DB' 
  },
  filterChipActive: { backgroundColor: '#1a2d5a', borderColor: '#1a2d5a' },
  filterChipTxt: { fontSize: 11, fontWeight: '600', color: '#374151' },
  filterChipTxtActive: { color: '#fff' },

  membersList: { gap: 10 },
  memberCard: { 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    padding: 15, 
    borderWidth: 0.5, 
    borderColor: '#e5e7eb' 
  },
  memberCardExpanded: { borderColor: '#1a2d5a', borderWidth: 1 },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#1a2d5a', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  nameSection: { flexDirection: 'column', gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: '#111827' },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  roleBadge: { 
    backgroundColor: '#EFF6FF', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  roleTxt: { fontSize: 9, color: '#1a2d5a', fontWeight: '700' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusActive: { backgroundColor: '#F0FDF4' },
  statusInactive: { backgroundColor: '#FEF2F2' },
  statusTxt: { fontSize: 9, fontWeight: '700', color: '#1a2d5a' },
  chevronWrap: { padding: 4 },

  contactDetails: { 
    marginTop: 10, 
    borderTopWidth: 0.5, 
    borderTopColor: '#f3f4f6', 
    paddingTop: 10, 
    gap: 6 
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactTxt: { fontSize: 12, color: '#4B5563' },

  expandedContent: { 
    marginTop: 12, 
    borderTopWidth: 0.5, 
    borderTopColor: '#e5e7eb', 
    paddingTop: 12 
  },
  statsSubGrid: { gap: 10, marginBottom: 12 },
  subStatBox: { 
    backgroundColor: '#f8fafc', 
    borderRadius: 8, 
    padding: 10, 
    borderWidth: 0.5, 
    borderColor: '#e5e7eb' 
  },
  subStatLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  subStatLabel: { fontSize: 9, textTransform: 'uppercase', color: '#6B7280', fontWeight: '700' },
  subStatValue: { fontSize: 12, fontWeight: '700', color: '#1e293b' },

  promoteBtn: {
    backgroundColor: '#1a2d5a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  promoteBtnTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },

  householdHeader: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#1a2d5a', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5, 
    marginBottom: 8, 
    marginTop: 4 
  },
  householdList: { gap: 6 },
  householdItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#f9fafb', 
    borderWidth: 0.5, 
    borderColor: '#e5e7eb', 
    borderRadius: 6, 
    padding: 8 
  },
  hiLeft: { flex: 1, gap: 2 },
  hiName: { fontSize: 12, fontWeight: '700', color: '#111827' },
  hiEmail: { fontSize: 10, color: '#6B7280' },
  hiRight: { 
    backgroundColor: '#E5E7EB', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 4 
  },
  hiRelation: { fontSize: 9, color: '#374151', fontWeight: '600' },
  emptyHouseholdTxt: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },

  footerBranding: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 20 }
});

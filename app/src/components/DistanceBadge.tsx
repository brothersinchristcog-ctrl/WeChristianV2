import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../theme/Theme';

export const DistanceBadge = ({ distKm, minutes }: { distKm: number; minutes: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Ionicons name="location" size={12} color={colors.primary} />
    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
      {distKm.toFixed(1)} km · {minutes} min
    </Text>
  </View>
);

export default DistanceBadge;

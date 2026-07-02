import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { openWhatsApp } from '../utils/whatsapp';

interface WhatsAppContactButtonProps {
  phone: string;
  message?: string;
  buttonText?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const WhatsAppContactButton: React.FC<WhatsAppContactButtonProps> = ({
  phone,
  message = '',
  buttonText = 'Contact on WhatsApp',
  style,
  textStyle,
}) => {
  const handlePress = () => {
    openWhatsApp(phone, message);
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <MessageCircle size={20} color="#FFFFFF" style={styles.icon} />
      <Text style={[styles.text, textStyle]}>{buttonText}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366', // WhatsApp Green
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

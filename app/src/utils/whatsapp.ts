import { Linking, Alert, Platform } from 'react-native';

/**
 * Opens WhatsApp to chat with a specific phone number
 * @param phone The phone number including country code (e.g. +919876543210)
 * @param text Optional text to pre-fill in the message box
 */
export const openWhatsApp = async (phone: string, text: string = '') => {
  try {
    // Remove all non-numeric characters from the phone number except the '+' at the start
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback to web URL if WhatsApp app is not installed
      const webUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(text)}`;
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening WhatsApp:', error);
    Alert.alert('Error', 'Could not open WhatsApp. Please make sure it is installed.');
  }
};

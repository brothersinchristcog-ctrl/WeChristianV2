import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import FirestoreService from '../services/FirestoreService';
import firestore from '@react-native-firebase/firestore';

export default function PaymentResultScreen({ route, navigation }: any) {
  const { txnId } = route.params || {};
  const { colors } = useTheme();
  const primary = colors.primary;
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'SUCCESS' | 'FAILED' | 'PENDING'>('PENDING');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!txnId) {
      setStatus('FAILED');
      setErrorMessage('No transaction ID found.');
      setLoading(false);
      return;
    }

    let unsubscribe: () => void = () => {};

    const setupListener = async () => {
      try {
        const col = await FirestoreService.getCollection('transactions');
        unsubscribe = col
          .doc(txnId)
          .onSnapshot((doc) => {
            if (doc.data()) {
              const data = doc.data();
              if (data?.status === 'SUCCESS' || data?.status === 'FAILED') {
                setStatus(data.status);
                if (data.error) setErrorMessage(data.error);
                setLoading(false);
              }
            }
          });
      } catch (e) {
        console.warn('PaymentResult listener error:', e);
      }
    };

    setupListener();

    // Timeout after 30 seconds if still pending
    const timeout = setTimeout(() => {
      setLoading(false);
      if (status === 'PENDING') {
        setStatus('PENDING');
        setErrorMessage('We are still waiting for confirmation from PhonePe. Please check your transaction history later.');
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [txnId]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color={primary} />
            <Text style={styles.title}>Processing Payment...</Text>
            <Text style={styles.subtitle}>Please do not close the app or press back.</Text>
          </>
        ) : status === 'SUCCESS' ? (
          <>
            <CheckCircle size={64} color="#10b981" />
            <Text style={styles.title}>Payment Successful!</Text>
            <Text style={styles.subtitle}>Thank you for your generous contribution.</Text>
          </>
        ) : status === 'PENDING' ? (
           <>
            <ActivityIndicator size="large" color="#fbbf24" />
            <Text style={styles.title}>Payment Pending</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
          </>
        ) : (
          <>
            <XCircle size={64} color="#ef4444" />
            <Text style={styles.title}>Payment Failed</Text>
            <Text style={styles.subtitle}>{errorMessage || 'There was an issue processing your payment.'}</Text>
          </>
        )}

        {!loading && (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: primary }]} 
            onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          >
            <Text style={styles.btnText}>Return to Home</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center'
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  }
});

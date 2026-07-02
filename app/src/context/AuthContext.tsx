import React, { createContext, useContext, useState, useEffect } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';

import FirestoreService, { AppMember } from '../services/FirestoreService';

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  member: AppMember | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  setMember: (member: AppMember | null) => void;
  viewMode: 'admin' | 'member';
  setViewMode: (mode: 'admin' | 'member') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [member, setMember] = useState<AppMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'admin' | 'member'>('admin');

  const updateMember = (newMember: AppMember | null) => {
    setMember(newMember);
  };

  useEffect(() => {
    // Attempt to load cached member instantly on boot
    const loadCachedMember = async () => {
      try {
        const cachedStr = await AsyncStorage.getItem('@cached_member');
        if (cachedStr) {
          const cachedMember = JSON.parse(cachedStr);
          console.log('👤 [Auth] Loaded cached member:', cachedMember.name);
          setMember(cachedMember);
        }
      } catch (e) {
        // Ignore cache errors
      }
    };
    loadCachedMember();

    // Handle user state changes
    const subscriber = auth().onAuthStateChanged(async (userState) => {
      setUser(userState);
      
      if (userState && !userState.isAnonymous) {
        try {
          console.log('🔐 [Auth] User Logged In:', userState.uid);
          // Fetch GLOBAL profile from Firestore
          const globalUser = await FirestoreService.getGlobalUser(userState.uid);
          
          if (globalUser) {
            console.log('🌍 [Auth] Global User Loaded:', globalUser.name);
            
            // FCM Setup
            try {
              const authStatus = await messaging().requestPermission();
              const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

              if (enabled) {
                const token = await messaging().getToken();
                console.log('🔔 [FCM] Token acquired:', token);
                await require('../services/firebaseConfig').firestore().collection('users').doc(userState.uid).update({
                  fcmToken: token
                });
              }
            } catch (err) {
              console.log('❌ [FCM] Error setting up notifications:', err);
            }
            
            if (globalUser.primaryChurchId) {
              // 1. Verify the church actually still exists
              const churchDetails = await require('../services/ChurchService').default.getChurchDetails(globalUser.primaryChurchId);
              
              if (!churchDetails) {
                console.warn('⚠️ [Auth] User primary church was deleted. Clearing from profile.');
                await require('../services/firebaseConfig').firestore().collection('users').doc(userState.uid).update({
                  primaryChurchId: require('../services/firebaseConfig').FieldValue.delete()
                });
                setMember(null);
              } else {
                // Fetch NESTED member profile
                const memberProfile = await FirestoreService.getMemberProfile(globalUser.primaryChurchId, userState.uid);
                
                if (memberProfile) {
                  console.log('👤 [Auth] Nested Member Profile Loaded:', memberProfile.name);
                  // Merge them into the active member state
                  const combinedMember: AppMember = { ...globalUser, ...memberProfile, id: userState.uid, churchId: globalUser.primaryChurchId };
                  setMember(combinedMember);
                  AsyncStorage.setItem('@cached_member', JSON.stringify(combinedMember));
                } else {
                  console.warn('⚠️ [Auth] No nested member profile found for church:', globalUser.primaryChurchId);
                  // Set fallback member with just global info so they aren't completely blocked
                  setMember({ id: userState.uid, name: globalUser.name || 'User', churchId: globalUser.primaryChurchId } as AppMember);
                }
              }
            } else {
              console.warn('⚠️ [Auth] Global user has no primaryChurchId.');
              setMember(null);
            }
          } else {
            console.warn('⚠️ [Auth] No global user found.');
            setMember(null);
          }
        } catch (err) {
          console.error('❌ [Auth] Profile Fetch Failed:', err);
        }
      } else {
        setMember(null);
        AsyncStorage.removeItem('@cached_member');
      }
      
      // Always clear loading — never block the user
      setLoading(false);
    });
    return subscriber; 
  }, []);

  const signInAnonymously = async () => {
    try {
      await auth().signInAnonymously();
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('@cached_member');
      await auth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, member, loading, signInAnonymously, signOut, setMember: updateMember, viewMode, setViewMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

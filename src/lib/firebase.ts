import { initializeApp, getApps, getApp } from 'firebase/app';

import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform } from 'react-native';

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ==========================================
// INITIALIZE FIREBASE APP
// ==========================================

const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

// ==========================================
// INITIALIZE FIREBASE AUTH
// ==========================================

function createFirebaseAuth() {
  // Untuk Web, gunakan persistence bawaan browser.
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  // Untuk Android dan iOS, gunakan AsyncStorage.
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;

    // Jika Auth sudah diinisialisasi sebelumnya,
    // gunakan instance yang sudah tersedia.
    if (errorCode === 'auth/already-initialized') {
      return getAuth(app);
    }

    throw error;
  }
}

export const auth = createFirebaseAuth();

// ==========================================
// FIRESTORE DATABASE
// ==========================================

export const db = getFirestore(app);
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface BusinessProfileData {
  contractorName: string;
  firmName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  address: string;
  gstin: string;
  pan: string;
  logo?: string;
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export const PROFILE_STORAGE_KEY = 'thekabook_contractor_profile_v3';

/**
 * Retrieves the latest business and firm profile stored on device.
 * Used dynamically across PDF statements, reports, vouchers, and bills.
 */
export async function getBusinessProfile(): Promise<BusinessProfileData | null> {
  try {
    let storedStr: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        storedStr =
          localStorage.getItem(PROFILE_STORAGE_KEY) ||
          localStorage.getItem('thekabook_contractor_profile_v2');
      }
    } else {
      storedStr = await SecureStore.getItemAsync(PROFILE_STORAGE_KEY);
    }

    if (storedStr) {
      return JSON.parse(storedStr) as BusinessProfileData;
    }
  } catch { }
  return null;
}

/**
 * Persists the business and firm profile securely to device storage.
 */
export async function saveBusinessProfileData(data: BusinessProfileData): Promise<void> {
  const jsonStr = JSON.stringify(data);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PROFILE_STORAGE_KEY, jsonStr);
    }
  } else {
    await SecureStore.setItemAsync(PROFILE_STORAGE_KEY, jsonStr);
  }
}

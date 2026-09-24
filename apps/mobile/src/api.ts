import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
const API = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/,'');
const TOKEN_KEY = 'thekabook_session';
export const getToken = async () => Platform.OS === 'web' ? sessionStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
export async function saveToken(token:string|null) {
  if(Platform.OS === 'web') { token ? sessionStorage.setItem(TOKEN_KEY,token) : sessionStorage.removeItem(TOKEN_KEY); return; }
  if(token) await SecureStore.setItemAsync(TOKEN_KEY,token); else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export async function request(path:string, token:string|null, body?:unknown) {
  let res:Response;
  try {
    res = await fetch(API+path,{ method: body === undefined ? 'GET' : 'POST',
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:body === undefined?undefined:JSON.stringify(body), signal:AbortSignal.timeout(20000) });
  } catch { throw new Error('API unreachable. Check your internet and EXPO_PUBLIC_API_URL. On a phone use the server LAN IP, not localhost.'); }
  const json = await res.json();
  if(!res.ok) { const error:any = new Error(json.error || 'Request failed'); error.status = res.status; throw error; }
  return json;
}
export const commandKey = () => Crypto.randomUUID();

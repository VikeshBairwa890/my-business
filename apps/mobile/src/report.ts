import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { reportText } from '../../../shared/finance';
import { Snapshot } from './types';
const escape = (v:string) => v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function shareReport(data:Snapshot,siteId?:string) {
  const message = reportText(data,siteId);
  if(Platform.OS==='web') { await navigator.clipboard.writeText(message); return 'Statement copied to clipboard'; }
  await Share.share({message,title:'ThekaBook statement'}); return 'Statement ready to share';
}
export async function pdfReport(data:Snapshot,siteId?:string) {
  const html = `<html><head><meta charset="utf-8"><style>body{font:12px Arial;padding:32px;color:#172f31}h1{color:#11685d}pre{white-space:pre-wrap;line-height:1.7;font-family:Arial}footer{color:#71817f}</style></head><body><h1>ThekaBook</h1><pre>${escape(reportText(data,siteId))}</pre></body></html>`;
  if(Platform.OS==='web') { await Print.printAsync({html}); return; }
  const file = await Print.printToFileAsync({html});
  if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',dialogTitle:'Contractor statement',UTI:'com.adobe.pdf'});
  else throw new Error('Sharing is unavailable on this device');
}

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../icons/AppIcon';
import { BillImageViewerModal } from './BillImageViewerModal';

export interface BillAttachmentPickerProps {
  photoUrl?: string;
  photoName?: string;
  onPhotoSelected: (dataUrl: string, name: string) => void;
  onPhotoRemoved: () => void;
  lang?: string;
}

export function BillAttachmentPicker({
  photoUrl,
  photoName,
  onPhotoSelected,
  onPhotoRemoved,
}: BillAttachmentPickerProps) {
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const resizeAndProcessImage = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) {
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
            onPhotoSelected(optimizedDataUrl, file.name || 'bill_photo.jpg');
          } else {
            onPhotoSelected(src, file.name || 'bill_photo.jpg');
          }
          setLoading(false);
        };
        img.onerror = () => {
          onPhotoSelected(src, file.name || 'bill_photo.jpg');
          setLoading(false);
        };
        img.src = src;
      } else {
        onPhotoSelected(src, file.name || 'bill_photo.jpg');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePickFile = async (captureCamera = false) => {
    try {
      setLoading(true);
      if (captureCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.granted) {
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            base64: true,
          });
          if (!res.canceled && res.assets && res.assets[0]) {
            const asset = res.assets[0];
            const mime = asset.mimeType || 'image/jpeg';
            const dataUrl = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
            onPhotoSelected(dataUrl, asset.fileName || 'camera_bill.jpg');
            setLoading(false);
            return;
          }
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.granted) {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
          });
          if (!res.canceled && res.assets && res.assets[0]) {
            const asset = res.assets[0];
            const mime = asset.mimeType || 'image/jpeg';
            const dataUrl = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
            onPhotoSelected(dataUrl, asset.fileName || 'gallery_bill.jpg');
            setLoading(false);
            return;
          }
        }
      }
    } catch (e) {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (captureCamera) {
          input.capture = 'environment';
        }
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            resizeAndProcessImage(file);
          } else {
            setLoading(false);
          }
        };
        input.click();
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Title Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <AppIcon name="receipt-outline" size={13} color="#2563EB" />
          <Text style={styles.titleText}>BILL & RECEIPT PHOTO</Text>
        </View>
        <Text style={styles.optionalBadge}>OPTIONAL</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Processing photo...</Text>
        </View>
      ) : photoUrl ? (
        /* Sleek Attached File Card */
        <View style={styles.attachedCard}>
          {/* Left Thumbnail (Clickable to open viewer) */}
          <Pressable
            onPress={() => setViewerOpen(true)}
            style={({ pressed }) => [
              styles.thumbnailWrapper,
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityLabel="Tap thumbnail photo to view full image"
          >
            <Image source={{ uri: photoUrl }} style={styles.thumbnailImg} />
            <View style={styles.zoomPill}>
              <AppIcon name="expand-outline" size={9} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Center Info */}
          <View style={styles.infoCol}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {photoName || 'bill_receipt.jpg'}
            </Text>
            <View style={styles.attachedStatusRow}>
              <View style={styles.greenDot} />
              <Text style={styles.attachedStatusText}>Tap to view</Text>
            </View>
          </View>

          {/* Right Action: Delete Button */}
          <Pressable
            onPress={onPhotoRemoved}
            style={({ pressed }) => [
              styles.iconActionBtn,
              styles.removeBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            accessibilityLabel="Remove photo"
          >
            <AppIcon name="trash-outline" size={14} color="#DC2626" />
          </Pressable>
        </View>
      ) : (
        /* Empty Upload Dropzone */
        <View style={styles.emptyDropzone}>
          <View style={styles.btnRow}>
            <Pressable
              onPress={() => handlePickFile(true)}
              style={({ pressed }) => [
                styles.uploadBtn,
                pressed && { opacity: 0.75, backgroundColor: '#DBEAFE' },
              ]}
            >
              <AppIcon name="camera-outline" size={15} color="#2563EB" />
              <Text style={styles.uploadBtnText}>Camera</Text>
            </Pressable>

            <Pressable
              onPress={() => handlePickFile(false)}
              style={({ pressed }) => [
                styles.uploadBtn,
                pressed && { opacity: 0.75, backgroundColor: '#DBEAFE' },
              ]}
            >
              <AppIcon name="images-outline" size={15} color="#2563EB" />
              <Text style={styles.uploadBtnText}>Gallery</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Full Size Image Viewer Modal */}
      {photoUrl ? (
        <BillImageViewerModal
          visible={viewerOpen}
          imageUrl={photoUrl}
          title={photoName || 'Bill Receipt Photo'}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  optionalBadge: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  emptyDropzone: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  attachedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 8,
    gap: 10,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 4,
    padding: 2,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fileNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  attachedStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    backgroundColor: '#FEF2F2',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
});

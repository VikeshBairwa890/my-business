import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../icons/AppIcon';
import { triggerBrowserDownload } from '../../storage/docStorage';

export interface BillImageViewerModalProps {
  visible: boolean;
  imageUrl: string;
  title?: string;
  date?: string;
  amount?: number | string;
  party?: string;
  onClose: () => void;
}

export function BillImageViewerModal({
  visible,
  imageUrl,
  title = 'Bill / Parchi Photo',
  date,
  amount,
  party,
  onClose,
}: BillImageViewerModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  if (!visible || !imageUrl) return null;

  const isPdf =
    title.toLowerCase().endsWith('.pdf') ||
    imageUrl.toLowerCase().includes('.pdf') ||
    imageUrl.startsWith('data:application/pdf') ||
    imageUrl.includes('application/pdf');

  const handleDownload = () => {
    if (Platform.OS === 'web') {
      const ext = isPdf ? 'pdf' : 'jpg';
      const cleanName = title.toLowerCase().endsWith(`.${ext}`) ? title : `${title}.${ext}`;
      triggerBrowserDownload(imageUrl, cleanName);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.container, isDesktop && styles.containerDesktop]}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, isPdf && { backgroundColor: '#DC2626' }]}>
                <AppIcon name={isPdf ? 'document-text' : 'receipt'} size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                {(date || party || amount) ? (
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {[
                      date ? `📅 ${date}` : null,
                      party ? `👤 ${party}` : null,
                      amount ? `💰 ₹${Number(amount).toLocaleString('en-IN')}` : null,
                    ]
                      .filter(Boolean)
                      .join('  •  ')}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.headerActions}>
              {Platform.OS === 'web' ? (
                <Pressable
                  onPress={handleDownload}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel={isPdf ? 'Download PDF' : 'Download Photo'}
                  hitSlop={6}
                >
                  <AppIcon name="download-outline" size={15} color="#FFFFFF" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Close viewer"
                hitSlop={6}
              >
                <AppIcon name="close" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Document / Image Container */}
          <View style={styles.imageWrapper}>
            {Platform.OS === 'web' && isPdf ? (
              React.createElement('iframe', {
                src: imageUrl,
                title,
                style: {
                  width: '100%',
                  height: '100%',
                  minHeight: 380,
                  border: 'none',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                },
              })
            ) : Platform.OS === 'web' ? (
              React.createElement('img', {
                src: imageUrl,
                alt: title,
                style: {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: 6,
                },
              })
            ) : (
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Footer Note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ThekaBook Digital Bill & Expense Verification Record
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  containerDesktop: {
    width: '92%',
    maxWidth: 900,
    height: '90%',
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 320,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  footerText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
  },
});

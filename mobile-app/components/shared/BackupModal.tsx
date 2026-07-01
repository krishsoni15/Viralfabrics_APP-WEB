import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { HardDrive, Image as ImageIcon, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';

interface BackupModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (includeImages: boolean) => void;
}

export default function BackupModal({
  visible,
  onClose,
  onConfirm,
}: BackupModalProps) {
  const { theme, isDarkMode } = useTheme();
  const [includeImages, setIncludeImages] = useState(false);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop}>
        <View style={styles.centeredView}>
          <View 
            style={[
              styles.modalView, 
              { 
                backgroundColor: theme.card,
                borderColor: theme.border,
              }
            ]}
          >
            {/* Close Button */}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <HardDrive size={24} color={Colors.primary[600]} />
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                System Backup
              </Text>
            </View>

            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Choose how you want to download your system data.
            </Text>

            {/* Option 1: Fast Data */}
            <TouchableOpacity
              onPress={() => setIncludeImages(false)}
              style={[
                styles.option,
                {
                  borderColor: !includeImages ? Colors.primary[600] : theme.border,
                  backgroundColor: !includeImages 
                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.05)')
                    : 'transparent'
                }
              ]}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.radioButton, { borderColor: !includeImages ? Colors.primary[600] : theme.textSecondary }]}>
                  {!includeImages && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.optionTitle, { color: theme.text }]}>
                  Fast Data Backup
                </Text>
                <View style={[styles.badge, { backgroundColor: isDarkMode ? '#334155' : Colors.neutral[100] }]}>
                  <Text style={[styles.badgeText, { color: theme.textSecondary }]}>Default</Text>
                </View>
              </View>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Downloads JSON, CSV, and Excel records without heavy media files. Very fast.
              </Text>
            </TouchableOpacity>

            {/* Option 2: Full Backup */}
            <TouchableOpacity
              onPress={() => setIncludeImages(true)}
              style={[
                styles.option,
                {
                  borderColor: includeImages ? Colors.primary[600] : theme.border,
                  backgroundColor: includeImages 
                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.05)')
                    : 'transparent'
                }
              ]}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.radioButton, { borderColor: includeImages ? Colors.primary[600] : theme.textSecondary }]}>
                  {includeImages && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.optionTitle, { color: theme.text }]}>
                  Full Backup with Media
                </Text>
                <ImageIcon size={14} color="#10b981" style={{ marginLeft: 6 }} />
              </View>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Includes all photos and attachments. Safely downloaded in chunks. May take a few minutes.
              </Text>
            </TouchableOpacity>

            {/* Footer Buttons */}
            <View style={styles.footer}>
              <TouchableOpacity 
                style={[styles.footerBtn, { backgroundColor: isDarkMode ? '#334155' : Colors.neutral[100] }]} 
                onPress={onClose}
              >
                <Text style={[styles.footerBtnText, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.footerBtn, { backgroundColor: Colors.primary[600] }]} 
                onPress={() => onConfirm(includeImages)}
              >
                <Text style={[styles.footerBtnText, { color: '#ffffff', fontWeight: '600' }]}>
                  Start Download
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredView: {
    width: '90%',
    maxWidth: 380,
  },
  modalView: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingRight: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  option: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary[600],
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 28,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';

interface DeleteConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  isDeleting?: boolean;
}

export default function DeleteConfirmModal({
  visible,
  onClose,
  onConfirm,
  title = 'Delete Item',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete',
  isDeleting = false,
}: DeleteConfirmModalProps) {
  const { theme, isDarkMode } = useTheme();
  const [localDeleting, setLocalDeleting] = React.useState(false);

  // Reset local loading state when the modal becomes hidden
  React.useEffect(() => {
    if (!visible) {
      setLocalDeleting(false);
    }
  }, [visible]);

  // Sync local deleting state with parent isDeleting prop
  React.useEffect(() => {
    if (!isDeleting) {
      setLocalDeleting(false);
    }
  }, [isDeleting]);

  const isLoading = isDeleting || localDeleting;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={isLoading ? undefined : onClose}
    >
      <Pressable style={styles.backdrop} onPress={isLoading ? undefined : onClose}>
        <View style={styles.centeredView}>
          <Pressable
            style={[
              styles.modalView,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            {!isLoading && (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Header / Icon */}
            <View style={styles.header}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                  }
                ]}
              >
                <Trash2 size={24} color={Colors.error[500]} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {title}
              </Text>
            </View>

            {/* Message */}
            <Text style={[styles.messageText, { color: theme.textSecondary }]}>
              {message}
            </Text>

            {/* Actions */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.footerBtn,
                  {
                    backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                    opacity: isLoading ? 0.5 : 1,
                  }
                ]}
                onPress={onClose}
                disabled={isLoading}
              >
                <Text style={[styles.footerBtnText, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.footerBtn,
                  {
                    backgroundColor: Colors.error[600],
                    opacity: isLoading ? 0.7 : 1,
                  }
                ]}
                onPress={() => {
                  setLocalDeleting(true);
                  onConfirm();
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={[styles.footerBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      Deleting...
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.footerBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                    {confirmText}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
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
    maxWidth: 340,
  },
  modalView: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
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
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

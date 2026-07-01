import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import { Colors } from '../../constants/colors';

interface PdfViewerProps {
  url: string;
  style?: any;
}

export default function PdfViewer({ url, style }: PdfViewerProps) {
  return (
    <View style={[styles.container, style]}>
      <FileText size={48} color={Colors.primary[500]} style={styles.icon} />
      <Text style={styles.title}>PDF PO Sheet Ready</Text>
      <Text style={styles.subtitle}>
        High-fidelity Purchase Order sheet is compiled. Tap "Download" below to view, print, or save the actual PDF document.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'transparent',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
const themeStyles = (isDarkMode: boolean) => StyleSheet.create({
  title: {
    color: isDarkMode ? '#ffffff' : '#0f172a',
  },
  subtitle: {
    color: isDarkMode ? '#94a3b8' : '#64748b',
  }
});

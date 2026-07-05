import React, { useEffect, useState, useRef } from 'react';
import { Platform, TouchableOpacity, Modal, View, Text, StyleSheet, Pressable, PanResponder, Dimensions, Image, ScrollView } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { Home, ShoppingBag, Package, Users, User, Menu, X, ChevronRight, Shield, FileText, Boxes, TestTubes, MoreHorizontal, ClipboardList } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS } from 'react-native-reanimated';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getProfilePhotoUrl } from '../../utils/helpers';


// Satisfying micro-interactions for tab icons
function AnimatedTabBarIcon({ Icon, color, focused, type }: { Icon: any; color: any; focused: boolean; type: 'home' | 'orders' | 'menu' }) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      if (type === 'home') {
        scale.value = withSequence(
          withTiming(1.25, { duration: 100 }),
          withSpring(1.0, { damping: 10, stiffness: 220 })
        );
      } else if (type === 'orders') {
        scale.value = withSequence(
          withTiming(1.25, { duration: 100 }),
          withSpring(1.0, { damping: 10, stiffness: 220 })
        );
        rotate.value = withSequence(
          withTiming(-12, { duration: 80 }),
          withTiming(12, { duration: 80 }),
          withSpring(0, { damping: 8 })
        );
      } else if (type === 'menu') {
        rotate.value = withSequence(
          withTiming(90, { duration: 160 }),
          withTiming(0, { duration: 0 })
        );
      }
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotate.value}deg` }
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Icon size={24} color={color} />
    </Animated.View>
  );
}

function ProfileTabBarIcon({ focused, color }: { focused: boolean; color: any }) {
  const { user } = useAuth();
  const scale = useSharedValue(1);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.25, { duration: 100 }),
        withSpring(1.0, { damping: 10, stiffness: 220 })
      );
    }
  }, [focused]);

  // Reset photo error when user photo changes
  useEffect(() => {
    setPhotoError(false);
  }, [user?.profilePhoto]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const photoUrl = user?.profilePhoto ? getProfilePhotoUrl(user.profilePhoto) : null;
  const showImage = photoUrl && !photoError;

  return (
    <Animated.View style={[
      animatedStyle, 
      { 
        width: 26, 
        height: 26, 
        borderRadius: 13, 
        backgroundColor: focused ? color : 'rgba(100, 116, 139, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: focused ? 1.5 : 1,
        borderColor: focused ? color : 'rgba(100, 116, 139, 0.4)',
      }
    ]}>
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          resizeMode="cover"
          onError={() => setPhotoError(true)}
        />
      ) : (
        <Text style={{ 
          fontSize: 10, 
          fontWeight: '900', 
          color: focused ? '#ffffff' : color 
        }}>
          {getInitials(user?.name || user?.username || 'U')}
        </Text>
      )}
    </Animated.View>
  );
}


// Custom spring-animated tab button with active capsule background and smooth vertical translation
function TabBarButton({ children, accessibilityState, onPress, onLongPress, style, hideDot }: any) {
  const focused = accessibilityState?.selected;
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    scale.value = withTiming(focused ? 1.05 : 1.0, { duration: 120 });
    translateY.value = withTiming(focused ? -2 : 0, { duration: 120 });
  }, [focused]);

  // Snappy crisp transitions for the tab selections
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateY: translateY.value }
      ],
      backgroundColor: withTiming(
        focused 
          ? (isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.08)') 
          : 'transparent',
        { duration: 120 }
      ),
      borderColor: withTiming(
        focused
          ? (isDarkMode ? 'rgba(96, 165, 250, 0.25)' : 'rgba(37, 99, 235, 0.15)')
          : 'transparent',
        { duration: 120 }
      ),
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={[style, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}
    >
      <Animated.View style={[
        { 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '92%', 
          height: Platform.OS === 'ios' ? 56 : 48,
          borderRadius: 14,
          borderWidth: 1.2,
          paddingVertical: 2,
        },
        animatedStyle
      ]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}



function MenuTabBarIcon({ 
  color, 
  focused, 
  Icon, 
  isMenuOpen, 
  SubIcon 
}: { 
  color?: any; 
  focused: boolean; 
  Icon: any; 
  isMenuOpen: boolean; 
  SubIcon: any 
}) {
  const { isDarkMode } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(focused ? 1.08 : 1.0, { duration: 120 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={{ width: 30, height: 30 }}>
      <Animated.View style={[
        {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: focused 
            ? (isDarkMode ? '#60a5fa' : '#2563eb') 
            : (isDarkMode ? '#1e293b' : '#f1f5f9'),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: focused 
            ? (isDarkMode ? '#93c5fd' : '#1d4ed8') 
            : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
        },
        animatedStyle
      ]}>
        <Icon size={16} color={focused ? '#ffffff' : (isDarkMode ? 'rgba(255,255,255,0.6)' : '#475569')} />
      </Animated.View>

      {!isMenuOpen && SubIcon && (
        <View style={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: focused 
            ? (isDarkMode ? '#1e293b' : '#ffffff') 
            : (isDarkMode ? '#60a5fa' : '#2563eb'),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: focused 
            ? (isDarkMode ? '#93c5fd' : '#1d4ed8') 
            : (isDarkMode ? '#1e293b' : '#ffffff'),
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 1,
          elevation: 2,
        }}>
          <SubIcon 
            size={8} 
            color={focused 
              ? (isDarkMode ? '#60a5fa' : '#2563eb') 
              : '#ffffff'
            } 
          />
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSuperAdmin, user } = useAuth();
  const bottomInset = insets.bottom;
  const paddingBottom = bottomInset > 0 ? bottomInset : (Platform.OS === 'ios' ? 24 : 10);
  const paddingTop = 8;
  const buttonHeight = Platform.OS === 'ios' ? 56 : 48;
  const tabHeight = buttonHeight + paddingBottom + paddingTop;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuRendered, setIsMenuRendered] = useState(false);
  const pathname = usePathname();
  
  const isFabricsActive = pathname.includes('/fabrics');
  const isWeaversActive = pathname.includes('/weaver');
  const isGreyActive = pathname.includes('/grey-materials');
  const isSamplingActive = pathname.includes('/sampling');
  const isFinishActive = pathname.includes('/finish-lot-stock');
  const isUsersActive = pathname.includes('/users');
  const isLogsActive = pathname.includes('/logs');
  const isPurchaseOrdersActive = pathname.includes('/purchase-orders');

  const getActiveMenuInfo = () => {
    return { Icon: MoreHorizontal, title: 'More' };
  };

  const getActiveSubpageIcon = () => {
    if (isFabricsActive) return Package;
    if (isWeaversActive) return Users;
    if (isGreyActive) return Boxes;
    if (isSamplingActive) return TestTubes;
    if (isFinishActive) return Package;
    if (isUsersActive) return Users;
    if (isLogsActive) return FileText;
    if (isPurchaseOrdersActive) return ClipboardList;
    return null;
  };

  const activeSubpageIcon = getActiveSubpageIcon();
  const { Icon: activeMenuIcon, title: activeMenuTitle } = getActiveMenuInfo();

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const offScreenY = SCREEN_HEIGHT + 80;
  const sheetTranslateY = useSharedValue(offScreenY);

  const openMenu = () => {
    sheetTranslateY.value = offScreenY;
    setIsMenuRendered(true);
    setIsMenuOpen(true);
    sheetTranslateY.value = withSpring(0, { damping: 26, stiffness: 280, mass: 0.8 });
  };

  const closeMenu = (velocity = 0) => {
    const handleFinished = () => {
      setIsMenuOpen(false);
      setIsMenuRendered(false);
    };

    if (velocity > 0) {
      sheetTranslateY.value = withSpring(
        offScreenY,
        { damping: 30, stiffness: 280, mass: 0.8, velocity: velocity },
        () => {
          runOnJS(handleFinished)();
        }
      );
    } else {
      sheetTranslateY.value = withSpring(
        offScreenY,
        { damping: 32, stiffness: 350, mass: 0.8 },
        () => {
          runOnJS(handleFinished)();
        }
      );
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          sheetTranslateY.value = g.dy;
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 15 || g.vy > 0.05) {
          const velocity = g.vy * 1000;
          closeMenu(velocity);
        } else {
          sheetTranslateY.value = withSpring(0, { damping: 25, stiffness: 280, mass: 0.8 });
        }
      },
    })
  ).current;

  const handleNavigate = (path: any) => {
    closeMenu();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Route after the close animation starts and has moved mostly off screen
    setTimeout(() => {
      router.push(path);
    }, 180);
  };

  const animatedBackdropStyle = useAnimatedStyle(() => {
    const opacity = Math.max(0, Math.min(1, 1 - sheetTranslateY.value / offScreenY));
    return {
      opacity: opacity,
    };
  });

  const animatedSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: sheetTranslateY.value }
      ],
    };
  });

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: isDarkMode ? '#60a5fa' : '#2563eb',
          tabBarInactiveTintColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
          tabBarStyle: {
            backgroundColor: isDarkMode ? 'rgba(15, 17, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderTopWidth: 0,
            height: tabHeight,
            paddingBottom: paddingBottom,
            paddingTop: paddingTop,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: isDarkMode ? 0.15 : 0.04,
            shadowRadius: 10,
            elevation: 12,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '800',
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingTop: 0,
          },
        }}
        screenListeners={{
          tabPress: () => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabBarIcon Icon={Home} color={color} focused={focused} type="home" />
            ),
            tabBarButton: (props) => <TabBarButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabBarIcon Icon={ShoppingBag} color={color} focused={focused} type="orders" />
            ),
            tabBarButton: (props) => <TabBarButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: activeMenuTitle,
            tabBarIcon: ({ color, focused }) => (
              <MenuTabBarIcon 
                Icon={activeMenuIcon} 
                focused={focused} 
                isMenuOpen={isMenuOpen}
                SubIcon={activeSubpageIcon}
              />
            ),
            href: (user?.role !== 'superadmin' && user?.role !== 'master') ? null : undefined,
            tabBarButton: (user?.role !== 'superadmin' && user?.role !== 'master') 
              ? undefined 
              : (props) => (
                  <TabBarButton
                    {...props}
                    hideDot={false}
                    accessibilityState={{
                      ...props.accessibilityState,
                      selected: isMenuOpen || isFabricsActive || isWeaversActive || isGreyActive || isSamplingActive || isFinishActive || isUsersActive || isLogsActive || isPurchaseOrdersActive
                    }}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (isMenuOpen) {
                        closeMenu();
                      } else {
                        openMenu();
                      }
                    }}
                  />
                ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <ProfileTabBarIcon color={color} focused={focused} />
            ),
            tabBarButton: (props) => <TabBarButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="fabrics"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="weaver"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="grey-materials"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="sampling"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="finish-lot-stock"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="logs"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="purchase-orders"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {isMenuRendered && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          <Animated.View 
            style={[
              StyleSheet.absoluteFill, 
              { backgroundColor: theme.overlay },
              animatedBackdropStyle
            ]}
          >
            <Pressable 
              style={{ flex: 1 }} 
              onPress={() => closeMenu()} 
            />
          </Animated.View>
          
          <Animated.View 
            {...panResponder.panHandlers}
            style={[
              styles.modalContent, 
              { 
                backgroundColor: isDarkMode ? '#1e293b' : theme.background,
                borderColor: theme.border,
                paddingBottom: insets.bottom + 24,
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
              },
              animatedSheetStyle
            ]}
          >
            {/* Drag Handle Indicator */}
            <View 
              style={[
                styles.dragHandle, 
                { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }
              ]} 
            />

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: theme.text }]}>Explore Menu</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Quick access to other areas</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  closeMenu();
                }}
                style={[styles.closeButton, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}
              >
                <X size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Menu Options */}
            <ScrollView 
              style={{ maxHeight: SCREEN_HEIGHT * 0.6 }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {/* Option 1: Fabrics */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/fabrics')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isFabricsActive 
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isFabricsActive 
                      ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff' }]}>
                  <Package size={18} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isFabricsActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Fabrics</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Browse fabrics & details</Text>
                </View>
                <ChevronRight size={14} color={isFabricsActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 2: Weavers */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/weaver')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isWeaversActive 
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isWeaversActive 
                      ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff' }]}>
                  <Users size={18} color={isDarkMode ? '#818cf8' : '#4f46e5'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isWeaversActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Weavers</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Manage weavers & sampling</Text>
                </View>
                <ChevronRight size={14} color={isWeaversActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 3: Grey Material Stock */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/grey-materials')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isGreyActive 
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isGreyActive 
                      ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(14, 165, 233, 0.15)' : '#f0f9ff' }]}>
                  <Boxes size={18} color={isDarkMode ? '#38bdf8' : '#0284c7'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isGreyActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Grey Material Stock</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Manage grey material inventory</Text>
                </View>
                <ChevronRight size={14} color={isGreyActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 4: Sampling */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/sampling')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isSamplingActive
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)')
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isSamplingActive
                      ? (isDarkMode ? '#60a5fa' : '#2563eb')
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff' }]}>
                  <TestTubes size={18} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isSamplingActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Sampling</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Browse sampling items & records</Text>
                </View>
                <ChevronRight size={14} color={isSamplingActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 5: Finish Lot Stock */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/finish-lot-stock')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isFinishActive
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)')
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isFinishActive
                      ? (isDarkMode ? '#60a5fa' : '#2563eb')
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4' }]}>
                  <Package size={18} color={isDarkMode ? '#4ade80' : '#16a34a'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isFinishActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Finish Lot Stock</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Track finished lot inventory</Text>
                </View>
                <ChevronRight size={14} color={isFinishActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 6: Users */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/users')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isUsersActive 
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isUsersActive 
                      ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }]}>
                  <Users size={18} color={isDarkMode ? '#34d399' : '#059669'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isUsersActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Users</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Manage user roles and permissions</Text>
                </View>
                <ChevronRight size={14} color={isUsersActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 7: Purchase Orders */}
              <TouchableOpacity
                onPress={() => handleNavigate('/(tabs)/purchase-orders')}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isPurchaseOrdersActive 
                      ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                      : (isDarkMode ? '#0f172a' : '#f8fafc'),
                    borderColor: isPurchaseOrdersActive 
                      ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                      : theme.borderLight,
                    marginBottom: 0,
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(236, 72, 153, 0.15)' : '#fdf2f8' }]}>
                  <ClipboardList size={18} color={isDarkMode ? '#f472b6' : '#db2777'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuItemTitle, { color: isPurchaseOrdersActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Purchase Orders</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Manage fabric purchase orders</Text>
                </View>
                <ChevronRight size={14} color={isPurchaseOrdersActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
              </TouchableOpacity>

              {/* Option 8: Logs */}
              {isSuperAdmin ? (
                <TouchableOpacity
                  onPress={() => handleNavigate('/(tabs)/logs')}
                  activeOpacity={0.7}
                  style={[
                    styles.menuItem,
                    {
                      backgroundColor: isLogsActive
                        ? (isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)')
                        : (isDarkMode ? '#0f172a' : '#f8fafc'),
                      borderColor: isLogsActive
                        ? (isDarkMode ? '#60a5fa' : '#2563eb')
                        : theme.borderLight,
                      marginBottom: 0,
                    }
                  ]}
                >
                  <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }]}>
                    <FileText size={18} color={isDarkMode ? '#fbbf24' : '#d97706'} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={[styles.menuItemTitle, { color: isLogsActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }]}>Logs</Text>
                    <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>Audit system activity and logs</Text>
                  </View>
                  <ChevronRight size={14} color={isLogsActive ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 24,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    marginBottom: 0,
    borderWidth: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuItemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});

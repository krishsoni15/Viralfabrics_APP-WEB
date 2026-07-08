import { useWindowDimensions, DimensionValue } from 'react-native';

export const useResponsiveLayout = () => {
  const { width, height } = useWindowDimensions();

  // Define breakpoints
  const isSmartWatch = width < 250;
  const isSlimPhone = width >= 250 && width < 360;
  const isPhone = width >= 360 && width < 480;
  const isFoldable = width >= 480 && width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  // Derived properties
  const isSmallScreen = isSmartWatch || isSlimPhone || isPhone;
  const isLargeScreen = isTablet || isDesktop;

  // Grid columns based on screen width
  let numColumns = 1;
  if (width >= 600) numColumns = 2; // Tablets and standard desktops
  if (width >= 1280) numColumns = 3; // Very large screens / ultra-wide

  // Maximum width for modal content to ensure it doesn't stretch too much on large screens
  const modalMaxWidth: DimensionValue = isSmallScreen ? '100%' : 700;

  // Main container max width for web/desktop to keep content centered and readable
  const containerMaxWidth: DimensionValue = 1200;

  return {
    width,
    height,
    isSmartWatch,
    isSlimPhone,
    isPhone,
    isFoldable,
    isTablet,
    isDesktop,
    isSmallScreen,
    isLargeScreen,
    numColumns,
    modalMaxWidth,
    containerMaxWidth,
  };
};

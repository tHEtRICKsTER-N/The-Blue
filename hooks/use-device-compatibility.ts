import { useState, useEffect } from 'react';

export interface DeviceCompatibility {
  isIncompatible: boolean;
  isMobile: boolean;
  isPortrait: boolean;
  isSmallScreen: boolean;
  reason: 'mobile' | 'portrait' | 'screen_too_small' | null;
  title: string;
  message: string;
  details: {
    deviceType: string;
    orientation: 'portrait' | 'landscape';
    dimensions: string;
  };
  checked: boolean;
}

export function checkDeviceCompatibility(): DeviceCompatibility {
  if (typeof window === 'undefined') {
    return {
      isIncompatible: false,
      isMobile: false,
      isPortrait: false,
      isSmallScreen: false,
      reason: null,
      title: '',
      message: '',
      details: {
        deviceType: 'Desktop PC',
        orientation: 'landscape',
        dimensions: 'Unknown',
      },
      checked: false,
    };
  }

  const ua = navigator.userAgent || navigator.vendor || '';
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 1. Mobile & handheld device checks
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk|Kindle/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  interface NavigatorWithUserAgentData extends Navigator {
    userAgentData?: {
      mobile?: boolean;
    };
  }
  const isClientHintsMobile = Boolean((navigator as NavigatorWithUserAgentData).userAgentData?.mobile);
  const hasCoarseOnly = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Classify as mobile/handheld device
  const isMobile = isMobileUA || isIPad || isClientHintsMobile || (isTouchDevice && hasCoarseOnly && width < 1024);

  // 2. Portrait orientation check
  const isPortrait = (Boolean(window.matchMedia && window.matchMedia('(orientation: portrait)').matches)) || width < height;

  // 3. Compact display check (ABYSS requires a minimum desktop landscape view: 1024x550)
  const isSmallScreen = width < 1024 || height < 550;

  // Overall incompatibility flag
  const isIncompatible = isMobile || isPortrait || isSmallScreen;

  let reason: 'mobile' | 'portrait' | 'screen_too_small' | null = null;
  let title = '';
  let message = '';

  if (isMobile) {
    reason = 'mobile';
    title = 'Desktop PC Required';
    message = 'ABYSS is a high-fidelity 3D underwater simulation built exclusively for desktop and laptop computers with keyboard and mouse controls. Mobile phones and handheld touch devices are not supported. Please open this experience on your PC to launch the expedition.';
  } else if (isPortrait) {
    reason = 'portrait';
    title = 'Portrait Mode Unsupported';
    message = 'ABYSS requires a widescreen landscape display to navigate the ocean depths and view expedition instruments. Please rotate your display or open on a PC in landscape mode.';
  } else if (isSmallScreen) {
    reason = 'screen_too_small';
    title = 'Display Window Too Small';
    message = 'ABYSS requires a minimum display resolution of 1024 × 550. Please expand your browser window or switch to a desktop PC to explore the living ocean.';
  }

  const deviceType = isMobile
    ? (isIPad ? 'Tablet Device' : 'Mobile Phone')
    : hasCoarseOnly
    ? 'Touch Device'
    : 'Desktop / Laptop PC';

  return {
    isIncompatible,
    isMobile,
    isPortrait,
    isSmallScreen,
    reason,
    title,
    message,
    details: {
      deviceType,
      orientation: isPortrait ? 'portrait' : 'landscape',
      dimensions: `${width} × ${height} px`,
    },
    checked: true,
  };
}

export function useDeviceCompatibility(): DeviceCompatibility {
  const [status, setStatus] = useState<DeviceCompatibility>(() => checkDeviceCompatibility());

  useEffect(() => {
    const handleUpdate = () => {
      setStatus(checkDeviceCompatibility());
    };

    handleUpdate();

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('orientationchange', handleUpdate);

    let mqlPortrait: MediaQueryList | null = null;
    try {
      mqlPortrait = window.matchMedia('(orientation: portrait)');
      mqlPortrait.addEventListener('change', handleUpdate);
    } catch {
      // Ignore if matchMedia change listener is unsupported
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
      if (mqlPortrait) {
        mqlPortrait.removeEventListener('change', handleUpdate);
      }
    };
  }, []);

  return status;
}

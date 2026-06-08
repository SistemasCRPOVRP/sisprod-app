import { useState, useEffect } from 'react';

function detectDevice() {
  const w = window.innerWidth;
  const ua = navigator.userAgent;

  const isTablet =
    /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua) ||
    (w >= 768 && w <= 1366 && 'ontouchstart' in window);
  const isMobile =
    !isTablet && ('ontouchstart' in window || /Mobi|Android|iPhone|iPod/i.test(ua));
  const isPC = !isMobile && !isTablet;

  return {
    isMobile,
    isTablet,
    isPC,
    type: isMobile ? 'mobile' : isTablet ? 'tablet' : 'pc',
    width: w,
  };
}

export function useDevice() {
  const [device, setDevice] = useState(detectDevice);

  useEffect(() => {
    const onResize = () => setDevice(detectDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return device;
}
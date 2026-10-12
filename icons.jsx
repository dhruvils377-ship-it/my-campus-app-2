import React from 'react';
import {
  IconMapPin, IconDoorExit, IconArrowUp, IconBooks, IconToolsKitchen2,
  IconMasksTheater, IconShare2, IconCheck, IconSun, IconMoon, IconCircleDot,
  IconStar, IconBarbell, IconPizza, IconOm, IconSchool, IconTrees,
  IconCreditCard, IconShieldExclamation, IconBuildingHospital, IconLink,
  IconMessageCircle, IconDeviceMobile, IconSunrise, IconCurrentLocation,
  IconMap2, IconSatellite, IconWorld, IconMicrophone, IconX, IconChartBar,
  IconNavigation, IconAmbulance, IconArrowLeft, IconArrowRight,
  IconRoute, IconBolt, IconWheelchair, IconSettings, IconTextSize,
  IconContrast, IconVolume, IconVolumeOff,
} from '@tabler/icons-react';

// Every icon in the app renders through AIcon so it always gets the same
// gentle "appear" animation plus a little tap-bounce on click, without
// repeating that CSS wiring at every call site. `spin` and `pulse` add a
// continuous animation for icons tied to live app state (mic listening,
// GPS re-centering, panic mode active). All animation is disabled
// automatically for people with prefers-reduced-motion set (see CSS).
export function AIcon({ icon: Icon, size = 20, spin = false, pulse = false, className = '', ...rest }) {
  const cls = `aicon${spin ? ' aicon-spin' : ''}${pulse ? ' aicon-pulse' : ''}${className ? ' ' + className : ''}`;
  return <Icon size={size} className={cls} aria-hidden="true" {...rest} />;
}

// Lookup for icons stored as short string keys in data (EXPLORE_SPOTS,
// SAFE_ZONES, share-option lists) rather than imported directly by name.
export const ICON_MAP = {
  books: IconBooks, kitchen: IconToolsKitchen2, barbell: IconBarbell,
  pizza: IconPizza, om: IconOm, school: IconSchool, doorExit: IconDoorExit,
  trees: IconTrees, creditCard: IconCreditCard, masksTheater: IconMasksTheater,
  hospital: IconBuildingHospital, shield: IconShieldExclamation,
  link: IconLink, message: IconMessageCircle, mobile: IconDeviceMobile,
};
export function DataIcon({ iconKey, size = 18, className = '' }) {
  const Icon = ICON_MAP[iconKey];
  if (!Icon) return null;
  return <AIcon icon={Icon} size={size} className={className} />;
}

// Re-exported so components that need a specific icon (route step arrows,
// theme toggle icons, etc.) can import everything from this one module
// instead of reaching back into @tabler/icons-react directly.
export {
  IconMapPin, IconDoorExit, IconArrowUp, IconShare2, IconCheck, IconSun, IconMoon,
  IconCircleDot, IconStar, IconSunrise, IconCurrentLocation, IconMap2, IconSatellite,
  IconWorld, IconMicrophone, IconX, IconChartBar,
  IconNavigation, IconAmbulance, IconArrowLeft, IconArrowRight,
  IconRoute, IconBolt, IconWheelchair, IconSettings, IconTextSize,
  IconContrast, IconVolume, IconVolumeOff,
};
/**
 * Icon — the app's single icon primitive (Lucide).
 *
 * Semantic, theme-aware wrapper around lucide-react-native so iconography is
 * consistent (one stroke set, one default weight/size). Use `name` from the
 * curated map below; add new mappings here rather than importing Lucide icons
 * ad-hoc across the app. Ionicons usage is migrated to this incrementally.
 */

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bug,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cloud,
  CloudRain,
  Droplet,
  Droplets,
  Flame,
  Flower2,
  Footprints,
  Globe,
  Heart,
  HeartPulse,
  Home,
  Image as ImageIcon,
  Info,
  Leaf,
  Lightbulb,
  Link as LinkIcon,
  LogOut,
  MapPin,
  Map as MapIcon,
  MessageCircle,
  Moon,
  Navigation,
  Pill,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Thermometer,
  TrendingUp,
  User,
  Wind,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

const ICONS = {
  home: Home,
  map: MapIcon,
  'map-pin': MapPin,
  navigation: Navigation,
  heart: Heart,
  'heart-pulse': HeartPulse,
  activity: Activity,
  user: User,
  bell: Bell,
  settings: Settings,
  search: Search,
  info: Info,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  check: Check,
  'check-circle': CheckCircle2,
  shield: Shield,
  'shield-check': ShieldCheck,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  close: X,
  plus: Plus,
  camera: Camera,
  image: ImageIcon,
  logout: LogOut,
  calendar: Calendar,
  clock: Clock,
  cloud: Cloud,
  rain: CloudRain,
  wind: Wind,
  droplet: Droplet,
  droplets: Droplets,
  leaf: Leaf,
  sun: Sun,
  moon: Moon,
  flame: Flame,
  footprints: Footprints,
  thermometer: Thermometer,
  bug: Bug,
  flower: Flower2,
  pill: Pill,
  stethoscope: Stethoscope,
  sparkles: Sparkles,
  trending: TrendingUp,
  message: MessageCircle,
  globe: Globe,
  link: LinkIcon,
  lightbulb: Lightbulb,
  'wifi-off': WifiOff,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Not used by Lucide directly; kept for call-site convenience. */
  style?: StyleProp<ViewStyle>;
}

const Icon: React.FC<IconProps> = ({ name, size = 20, color, strokeWidth = 1.75 }) => {
  const { colors } = useTheme();
  const LucideCmp = ICONS[name];
  return <LucideCmp size={size} color={color ?? colors.text} strokeWidth={strokeWidth} />;
};

export default Icon;

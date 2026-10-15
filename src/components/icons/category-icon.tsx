import {
  Car,
  Clapperboard,
  Compass,
  Cpu,
  Gamepad2,
  GraduationCap,
  Laugh,
  Music,
  Newspaper,
  PawPrint,
  Plane,
  Sparkles,
  Trophy,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps the `icon` key on our curated categories to a Lucide component. Keeping the
 * lookup explicit (rather than dynamic imports) means the icon set is tree-shaken
 * to exactly what we use.
 */
const ICONS: Record<string, LucideIcon> = {
  music: Music,
  gamepad: Gamepad2,
  cpu: Cpu,
  trophy: Trophy,
  graduation: GraduationCap,
  laugh: Laugh,
  newspaper: Newspaper,
  sparkles: Sparkles,
  clapperboard: Clapperboard,
  wrench: Wrench,
  users: Users,
  plane: Plane,
  car: Car,
  paw: PawPrint,
};

export function categoryIcon(key: string | undefined): LucideIcon {
  return (key && ICONS[key]) || Compass;
}

export function CategoryIcon({ icon, className }: { icon: string | undefined; className?: string }) {
  const Icon = categoryIcon(icon);
  return <Icon className={className} aria-hidden />;
}

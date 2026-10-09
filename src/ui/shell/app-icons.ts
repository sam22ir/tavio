import {
  Calculator,
  Contact,
  CreditCard,
  FileText,
  FolderKanban,
  Globe,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Package,
  Plug,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  Truck,
  Users,
  Warehouse,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { AppPillar } from '@/core/modules/define';

// Icon names come from module manifests (`app.icon`); unknown names fall back to the grid icon.
const ICONS: Record<string, LucideIcon> = {
  Calculator,
  Contact,
  CreditCard,
  FileText,
  FolderKanban,
  Globe,
  Landmark,
  LifeBuoy,
  Megaphone,
  Package,
  Plug,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  Truck,
  Users,
  Warehouse,
  Workflow,
};

export function appIcon(name: string): LucideIcon {
  return ICONS[name] ?? LayoutGrid;
}

/** Brand-adjacent accent per pillar, used for launcher icon chips. */
export const PILLAR_COLOR: Record<AppPillar, string> = {
  acquisition: '#08409D',
  sales: '#0F7B5F',
  operations: '#B45309',
  data: '#7C3AED',
  technology: '#475569',
};

import { Banknote, Landmark, MessageCircle, Percent, Receipt, type LucideIcon } from 'lucide-react';

export type BadgeKind = 'dzd' | 'ccp' | 'whatsapp' | 'invoice' | 'tva';

/** Tile gradient, soft coloured glow and icon per badge kind. */
const KINDS: Record<BadgeKind, { icon: LucideIcon; from: string; to: string; glow: string }> = {
  dzd: { icon: Banknote, from: '#3a9a86', to: '#08409D', glow: 'rgba(8, 64, 157, 0.55)' },
  ccp: { icon: Landmark, from: '#f08a4b', to: '#c2410c', glow: 'rgba(194, 65, 12, 0.5)' },
  whatsapp: { icon: MessageCircle, from: '#4ae08a', to: '#1ea952', glow: 'rgba(37, 211, 102, 0.55)' },
  invoice: { icon: Receipt, from: '#3b4d48', to: '#0f1a17', glow: 'rgba(15, 26, 23, 0.45)' },
  tva: { icon: Percent, from: '#8fb8a9', to: '#5f8c7f', glow: 'rgba(95, 127, 191, 0.5)' },
};
const POS = ['start-[-3%] top-[14%]', 'start-[4%] bottom-[10%]', 'end-[-2%] top-[10%]', 'end-[6%] bottom-[18%]', 'start-[40%] -top-[4%]'];

/** Decorative 3D tiles around the hero visual. Hidden below md. Float respects reduced motion (see site.css). */
export function FloatingBadges({ items }: { items: { kind: BadgeKind; label: string }[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      {items.map((item, i) => {
        const { icon: Icon, from, to, glow } = KINDS[item.kind];
        return (
          <div key={item.kind} className={`s-badge s-float absolute ${POS[i % POS.length]}`} style={{ animationDelay: `${i * -1.3}s` }}>
            <span
              className="s-badge-tile"
              style={{
                background: `linear-gradient(150deg, ${from}, ${to})`,
                boxShadow: `inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.18), 0 12px 20px -8px ${glow}`,
              }}
            >
              <Icon size={16} strokeWidth={2} />
            </span>
            {item.label}
          </div>
        );
      })}
    </div>
  );
}

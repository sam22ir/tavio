import { RevealItem, RevealList } from './motion/Reveal';

/** Title + subline rows with hairline dividers, shown beside a DeviceFrame. Rows stagger in on scroll. */
export function FeatureList({ items, tone = 'light' }: { items: { title: string; body: string }[]; tone?: 'light' | 'dark' }) {
  return (
    <RevealList className={`s-feature-list ${tone === 'dark' ? 's-dark' : ''}`}>
      {items.map((item) => (
        <RevealItem key={item.title}>
          <h3 className="text-[17px]">{item.title}</h3>
          <p className={`text-[15px] leading-relaxed ${tone === 'dark' ? 's-muted' : 'text-[color:var(--s-muted)]'}`}>{item.body}</p>
        </RevealItem>
      ))}
    </RevealList>
  );
}

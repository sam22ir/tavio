import { personalize } from '../service/message';

/** Shows a campaign message with sample values filled in. Arabic text is set to dir="auto". */
export function MessagePreview({ label, template, name, shop }: { label: string; template: string; name: string; shop: string }) {
  return (
    <figure className="flex flex-col gap-1 rounded-2xl bg-surface-secondary p-4">
      <figcaption className="text-xs text-muted">{label}</figcaption>
      <p dir="auto" className="whitespace-pre-line text-sm">
        {personalize(template, { name, shop })}
      </p>
    </figure>
  );
}

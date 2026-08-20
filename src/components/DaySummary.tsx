export function DaySummary({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="serif italic text-lg md:text-xl leading-relaxed text-ink/90 mt-6 mb-2">{text}</p>
  );
}

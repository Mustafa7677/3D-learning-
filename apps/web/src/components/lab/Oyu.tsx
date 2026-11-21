/**
 * Ою-өрнек: the ram's horn (қошқар мүйіз), drawn as clean line work so it
 * reads both as Kazakh ornament and as an engineering mark. Decorative only.
 */

/** One horn curling out of a corner; mirrored by CSS for the other corners. */
export function OyuCorner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden focusable="false">
      <path d="M3 61 V30 C3 15 15 3 30 3 H61" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 61 V32 C10 20 20 10 32 10 H44 C52 10 56 16 54 22 C52 28 44 28 42 23 C40 18 46 16 48 19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 44 C16 44 20 48 19 53 C18 57 13 57 12 54 C11 51 14 50 15 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M26 26 l6 -6 l6 6 l-6 6 z" fill="currentColor" />
    </svg>
  );
}

/** A rule with a pair of horns facing a diamond: the divider of the lesson sheet. */
export function OyuRule({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 24" preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
      <path d="M0 12 H92" stroke="currentColor" strokeWidth="1.2" />
      <path d="M148 12 H240" stroke="currentColor" strokeWidth="1.2" />
      <path d="M92 12 C100 12 104 4 111 5 C117 6 117 13 112 14 C108 15 107 10 110 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M148 12 C140 12 136 4 129 5 C123 6 123 13 128 14 C132 15 133 10 130 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M120 4 l8 8 l-8 8 l-8 -8 z" fill="currentColor" />
    </svg>
  );
}

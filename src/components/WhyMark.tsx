/**
 * Il sigillo-anima di WhyChat: un nucleo che respira dentro un anello.
 * Non un logo qualunque — la presenza viva di WhyEd nella macchina.
 */
export default function WhyMark({ size = 40, active = false }: { size?: number; active?: boolean }) {
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18.5" stroke="rgba(242,239,233,0.16)" strokeWidth="1" />
        <circle
          cx="20"
          cy="20"
          r="18.5"
          stroke="url(#wm-ring)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="34 90"
          style={{ transformOrigin: "center", animation: active ? "spin 3.2s linear infinite" : "spin 9s linear infinite" }}
        />
        <defs>
          <linearGradient id="wm-ring" x1="0" y1="0" x2="40" y2="40">
            <stop stopColor="#c94b25" />
            <stop offset="1" stopColor="#f0a36a" />
          </linearGradient>
          <radialGradient id="wm-core" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#f0a36a" />
            <stop offset="1" stopColor="#c94b25" />
          </radialGradient>
        </defs>
      </svg>
      <span
        className="breathe absolute rounded-full"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          background: "radial-gradient(circle, #f0a36a, #c94b25)",
          boxShadow: "0 0 18px 4px rgba(201,75,37,0.55)",
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

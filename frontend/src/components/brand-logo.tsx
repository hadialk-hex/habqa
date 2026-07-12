// Unified Hubqa brand mark — the SAME artwork is used for the browser tab
// icon (src/app/icon.svg), the sidebar logo, and anywhere the brand appears.
// Edit both files together to keep the identity consistent.

export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Hubqa"
    >
      <defs>
        <linearGradient id="hubqa-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="hubqa-bolt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Rounded app tile */}
      <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#hubqa-bg)" />
      {/* Chat bubble */}
      <path
        d="M32 12.5c-11.3 0-20.5 7.9-20.5 17.6 0 5.6 3.1 10.6 7.9 13.8-.3 2.6-1.4 4.9-3.2 6.7-.6.6-.1 1.6.7 1.5 4.3-.5 8-2 10.7-4 1.4.3 2.9.4 4.4.4 11.3 0 20.5-7.9 20.5-17.6S43.3 12.5 32 12.5z"
        fill="#ffffff"
      />
      {/* Automation bolt */}
      <path
        d="M35.2 19.8l-9.4 11.6c-.6.7 0 1.7.9 1.7h5.2l-1.9 8.9c-.2 1 1.1 1.6 1.8.8l9.4-11.6c.6-.7 0-1.7-.9-1.7h-5.2l1.9-8.9c.2-1-1.1-1.6-1.8-.8z"
        fill="url(#hubqa-bolt)"
      />
    </svg>
  )
}

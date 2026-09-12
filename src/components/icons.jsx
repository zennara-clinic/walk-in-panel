/* Lucide line icons (1.5px stroke) used across the pre-consult UI. No emoji. */
const I = ({ children, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);
export const Check = (p) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>;
export const CheckCircle = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></I>;
export const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></I>;
export const Info = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></I>;
export const AlertCircle = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></I>;
export const XCircle = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></I>;
export const Activity = (p) => <I {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></I>;
export const MessageCircle = (p) => <I {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></I>;
export const ArrowLeft = (p) => <I {...p}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></I>;
export const ArrowRight = (p) => <I {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></I>;
export const Printer = (p) => <I {...p}><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="8" rx="1" /></I>;
export const PenLine = (p) => <I {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></I>;
export const Lock = (p) => <I {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></I>;
export const Search = (p) => <I {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></I>;

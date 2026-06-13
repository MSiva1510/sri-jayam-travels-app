// ─── ModalOverlay ─────────────────────────────────────────────
// Reusable modal overlay wrapper.
// Uses -inset-2 (= -8px on all sides) instead of inset-0 to
// compensate for the AppShell layout offset and ensure the
// backdrop covers the full visible viewport with no gap.
//
// Usage:
//   <ModalOverlay onClose={onClose} center>
//     <div className="relative w-full sm:w-[520px] ...">
//       {/* modal panel */}
//     </div>
//   </ModalOverlay>
//
// Props:
//   onClose  — called when backdrop is clicked
//   center   — if true: items-center (desktop-only dialogs)
//              if false (default): items-end sm:items-center (sheet-style on mobile)
//   children — the modal panel

export default function ModalOverlay({ onClose, center = false, children }) {
  const align = center
    ? 'items-center justify-center'
    : 'items-end sm:items-center justify-center'

  return (
    <div className={`fixed -inset-2 z-50 flex ${align}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal panel(s) */}
      {children}
    </div>
  )
}

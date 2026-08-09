// Helper format tanggal/waktu — sumber tunggal agar konsisten se-app.

// Format lengkap untuk sel "LAST UPDATE": "07 Agu 2026 · 14:05"
export function fmtUpdate(pkg) {
  const dt = pkg.updated_at || pkg.created_at;
  if (!dt) return '—';
  return fmtDateTime(dt);
}

// Format ringkas (tanpa tahun), dipakai di kartu kanban: "07 Agu · 14:05"
export function fmtTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

function fmtDateTime(dt) {
  const d = new Date(dt);
  return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

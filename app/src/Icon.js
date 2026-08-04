import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

// Set ikon garis kecil (24x24) menggantikan emoji di tempat yang butuh
// nuansa WMS profesional. Semua pakai stroke, warna via prop `color`.
const ICONS = {
  box: (p) => (
    <Path
      d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Zm0 0v9L12 21l9-4.5v-9M12 12v9"
      {...p}
    />
  ),
  scooter: (p) => (
    <>
      <Circle cx="6" cy="18" r="2.5" {...p} fill="none" />
      <Circle cx="17" cy="18" r="2.5" {...p} fill="none" />
      <Path d="M6 18h5l1.5-6H15l3 4.5M8.5 12h4.5l1-4h3" {...p} fill="none" />
    </>
  ),
  list: (p) => (
    <>
      <Line x1="8" y1="6" x2="21" y2="6" {...p} />
      <Line x1="8" y1="12" x2="21" y2="12" {...p} />
      <Line x1="8" y1="18" x2="21" y2="18" {...p} />
      <Line x1="3" y1="6" x2="3.01" y2="6" {...p} />
      <Line x1="3" y1="12" x2="3.01" y2="12" {...p} />
      <Line x1="3" y1="18" x2="3.01" y2="18" {...p} />
    </>
  ),
  chart: (p) => (
    <>
      <Line x1="4" y1="20" x2="20" y2="20" {...p} />
      <Rect x="6" y="12" width="3" height="8" {...p} fill="none" />
      <Rect x="11" y="7" width="3" height="13" {...p} fill="none" />
      <Rect x="16" y="4" width="3" height="16" {...p} fill="none" />
    </>
  ),
  user: (p) => (
    <>
      <Circle cx="12" cy="8" r="3.5" {...p} fill="none" />
      <Path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" {...p} fill="none" />
    </>
  ),
  camera: (p) => (
    <>
      <Rect x="3" y="7" width="18" height="13" rx="2" {...p} fill="none" />
      <Path d="M8 7 9.5 4h5L16 7" {...p} fill="none" />
      <Circle cx="12" cy="13.5" r="3.5" {...p} fill="none" />
    </>
  ),
  plus: (p) => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" {...p} />
      <Line x1="5" y1="12" x2="19" y2="12" {...p} />
    </>
  ),
  search: (p) => (
    <>
      <Circle cx="10.5" cy="10.5" r="6.5" {...p} fill="none" />
      <Line x1="21" y1="21" x2="15.5" y2="15.5" {...p} />
    </>
  ),
  rotate: (p) => (
    <>
      <Path d="M3 12a9 9 0 0 1 15-6.7L21 8" {...p} fill="none" />
      <Path d="M21 3v5h-5" {...p} fill="none" />
      <Path d="M21 12a9 9 0 0 1-15 6.7L3 16" {...p} fill="none" />
      <Path d="M3 21v-5h5" {...p} fill="none" />
    </>
  ),
  logout: (p) => (
    <>
      <Path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" {...p} fill="none" />
      <Line x1="21" y1="12" x2="10" y2="12" {...p} />
      <Path d="m16 7 5 5-5 5" {...p} fill="none" />
    </>
  ),
  edit: (p) => (
    <Path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" {...p} fill="none" />
  ),
  download: (p) => (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...p} fill="none" />
      <Path d="m7 10 5 5 5-5" {...p} fill="none" />
      <Line x1="12" y1="15" x2="12" y2="3" {...p} />
    </>
  ),
  calendar: (p) => (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="2" {...p} fill="none" />
      <Line x1="16" y1="2" x2="16" y2="6" {...p} />
      <Line x1="8" y1="2" x2="8" y2="6" {...p} />
      <Line x1="3" y1="10" x2="21" y2="10" {...p} />
    </>
  ),
};

export default function Icon({ name, size = 20, color = '#0F172A', strokeWidth = 1.8 }) {
  const draw = ICONS[name];
  if (!draw) return null;
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {draw(p)}
    </Svg>
  );
}

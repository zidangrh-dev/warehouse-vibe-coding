import {
  Package, Bike, List, BarChart3, User, Camera, Plus, Search,
  RotateCcw, LogOut, Pencil, Download, Calendar, Columns3,
  CheckCircle2, XCircle, Truck, ArrowDownToLine, Lock,
  FileText, Sparkles, SkipForward, Users, KeyRound, Archive,
  CalendarDays, ScanLine, Save, Copy, UserCheck, Zap, Monitor,
  TrendingUp, TrendingDown, AlertTriangle, Store, X,
  Circle,
} from 'lucide-react-native';

const ICON_MAP = {
  box: Package,
  scooter: Bike,
  list: List,
  chart: BarChart3,
  user: User,
  camera: Camera,
  plus: Plus,
  search: Search,
  rotate: RotateCcw,
  logout: LogOut,
  edit: Pencil,
  download: Download,
  calendar: Calendar,
  columns: Columns3,
  check: CheckCircle2,
  x_circle: XCircle,
  truck: Truck,
  arrow_down: ArrowDownToLine,
  lock: Lock,
  file_text: FileText,
  sparkles: Sparkles,
  skip: SkipForward,
  users: Users,
  key: KeyRound,
  archive: Archive,
  calendar_days: CalendarDays,
  scan: ScanLine,
  save: Save,
  copy: Copy,
  user_check: UserCheck,
  zap: Zap,
  monitor: Monitor,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  alert: AlertTriangle,
  store: Store,
  x: X,
  circle: Circle,
};

export default function Icon({ name, size = 20, color = '#0F172A', strokeWidth = 1.8 }) {
  const LucideIcon = ICON_MAP[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} />;
}

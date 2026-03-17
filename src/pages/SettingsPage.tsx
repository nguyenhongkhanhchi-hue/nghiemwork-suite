import { useRef, useState, useEffect } from 'react';
import { useTaskStore, useAuthStore, useSettingsStore, useGamificationStore, useTemplateStore } from '@/stores';
import { supabase } from '@/lib/supabase';
import { requestNotificationPermission, canSendNotification } from '@/lib/notifications';
import { exportData, importData } from '@/lib/dataUtils';
import { DEFAULT_VOICE_SETTINGS } from '@/types';
import type { FinanceCategory, CostItem } from '@/types';
import {
  Type, Volume2, Mic, Trash2, Minus, Plus, ChevronDown,
  LogOut, User, Globe, Bell, Download, Upload, Smartphone, Sun, Moon, Shield,
  Wallet, DollarSign, Save, FolderOpen, Clock, Languages, VolumeX,
  Pencil, Copy, Settings, X,
} from 'lucide-react';
import { manualBackup, restoreFromBackupFile, getLastBackupTime } from '@/lib/autoBackup';
import { playSound, getAudioSettings, setMasterVolume, setAudioEnabled, loadAudioSettings } from '@/lib/audioController';
import AdminPage from '@/pages/AdminPage';

const TIMEZONES = [
  { label: 'Việt Nam (GMT+7)', value: 'Asia/Ho_Chi_Minh' },
  { label: 'Nhật Bản (GMT+9)', value: 'Asia/Tokyo' },
  { label: 'Singapore (GMT+8)', value: 'Asia/Singapore' },
  { label: 'Thái Lan (GMT+7)', value: 'Asia/Bangkok' },
  { label: 'Úc (GMT+10)', value: 'Australia/Sydney' },
  { label: 'Mỹ PST (GMT-8)', value: 'America/Los_Angeles' },
  { label: 'Anh (GMT+0)', value: 'Europe/London' },
];

const PRESET_COLORS = ['#34D399', '#60A5FA', '#F87171', '#FBBF24', '#A78BFA', '#FB923C', '#F472B6', '#22D3EE'];

function getOS(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-surface)]'}`}>
      <div className={`size-4 rounded-full bg-white absolute top-1 transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border mb-2 overflow-hidden transition-colors ${open ? 'bg-[var(--bg-surface)] border-[var(--accent-primary)]/40' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'}`}>
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-4 py-3 text-left ${open ? 'bg-[var(--accent-dim)]/25' : ''}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-sm font-medium ${open ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>{title}</span>
        </div>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180 text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ✅ #8: Finance Categories Settings
function FinanceCategoriesSection() {
  const financeCategories = useSettingsStore(s => s.financeCategories);
  const setFinanceCategories = useSettingsStore(s => s.setFinanceCategories);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('income');
  const [newColor, setNewColor] = useState('#34D399');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const cat: FinanceCategory = {
      id: Date.now().toString(36),
      name: newName.trim(),
      type: newType,
      color: newColor,
    };
    setFinanceCategories([...financeCategories, cat]);
    setNewName('');
  };

  const handleRemove = (id: string) => {
    setFinanceCategories(financeCategories.filter(c => c.id !== id));
  };

  const incomes = financeCategories.filter(c => c.type === 'income');
  const expenses = financeCategories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-[var(--accent-primary)] font-semibold mb-1">Hạng mục Thu</p>
        <div className="space-y-1">
          {incomes.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg px-3 py-1.5">
              <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-xs text-[var(--text-primary)] flex-1">{c.name}</span>
              <button onClick={() => handleRemove(c.id)} className="text-[var(--text-muted)] p-0.5"><Minus size={10} /></button>
            </div>
          ))}
          {incomes.length === 0 && <p className="text-[10px] text-[var(--text-muted)] pl-1">Chưa có hạng mục</p>}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-[var(--error)] font-semibold mb-1">Hạng mục Chi</p>
        <div className="space-y-1">
          {expenses.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg px-3 py-1.5">
              <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-xs text-[var(--text-primary)] flex-1">{c.name}</span>
              <button onClick={() => handleRemove(c.id)} className="text-[var(--text-muted)] p-0.5"><Minus size={10} /></button>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-[10px] text-[var(--text-muted)] pl-1">Chưa có hạng mục</p>}
        </div>
      </div>
      {/* Add new */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Thêm hạng mục mới</p>
        <div className="flex gap-1.5 mb-1.5">
          <button onClick={() => setNewType('income')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium min-h-[28px] ${newType === 'income' ? 'bg-[rgba(52,211,153,0.2)] text-[var(--success)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
            Thu
          </button>
          <button onClick={() => setNewType('expense')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium min-h-[28px] ${newType === 'expense' ? 'bg-[rgba(248,113,113,0.15)] text-[var(--error)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
            Chi
          </button>
        </div>
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setNewColor(c)}
              className={`size-5 rounded-full flex-shrink-0 ${newColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-elevated)]' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Tên hạng mục..."
            className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[32px]" />
          <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-primary)] text-xs">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ #9: Cost Items Settings
function CostItemsSection() {
  const costItems = useSettingsStore(s => s.costItems);
  const setCostItems = useSettingsStore(s => s.setCostItems);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'fixed' | 'variable'>('fixed');

  const totalPerMonth = costItems.reduce((s, i) => s + i.amount, 0);
  const costPerHour = totalPerMonth / (30 * 24);
  const costPerMinute = costPerHour / 60;
  const costPerSecond = costPerMinute / 60;

  const handleAdd = () => {
    const amount = parseInt(newAmount.replace(/[^\d]/g, ''));
    if (!newName.trim() || !amount) return;
    const item: CostItem = { id: Date.now().toString(36), name: newName.trim(), amount, type: newType };
    setCostItems([...costItems, item]);
    setNewName(''); setNewAmount('');
  };

  const handleRemove = (id: string) => setCostItems(costItems.filter(i => i.id !== id));

  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-muted)]">
        Liệt kê tất cả chi phí hàng tháng để tính chi phí thời gian chính xác trong trang Dòng tiền.
      </p>
      {/* Summary */}
      {costItems.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl p-3 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">Tổng chi phí/tháng: <span className="font-bold text-[var(--error)]">{fmt(totalPerMonth)}</span></p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs font-bold text-[var(--warning)] font-mono">{fmt(Math.round(costPerHour))}</p><p className="text-[8px] text-[var(--text-muted)]">/giờ</p></div>
            <div><p className="text-xs font-bold text-[var(--warning)] font-mono">{fmt(Math.round(costPerMinute))}</p><p className="text-[8px] text-[var(--text-muted)]">/phút</p></div>
            <div><p className="text-xs font-bold text-[var(--warning)] font-mono">{fmt(Math.round(costPerSecond * 100) / 100)}</p><p className="text-[8px] text-[var(--text-muted)]">/giây</p></div>
          </div>
        </div>
      )}
      {/* List */}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {costItems.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-[var(--text-muted)] w-10 flex-shrink-0">{item.type === 'fixed' ? 'Cố định' : 'Biến động'}</span>
            <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{item.name}</span>
            <span className="text-xs font-bold text-[var(--error)] font-mono">{item.amount.toLocaleString('vi-VN')}đ</span>
            <button onClick={() => handleRemove(item.id)} className="text-[var(--text-muted)]"><Minus size={10} /></button>
          </div>
        ))}
        {costItems.length === 0 && <p className="text-[10px] text-[var(--text-muted)] pl-1">Chưa có chi phí nào</p>}
      </div>
      {/* Add */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex gap-1.5 mb-1.5">
          {(['fixed', 'variable'] as const).map(t => (
            <button key={t} onClick={() => setNewType(t)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] min-h-[28px] ${newType === t ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
              {t === 'fixed' ? 'Cố định' : 'Biến động'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-1.5">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên chi phí (VD: Thuê nhà)"
            className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[32px]" />
        </div>
        <div className="flex gap-1.5">
          <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Số tiền/tháng (VND)" inputMode="numeric"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[32px]" />
          <button onClick={handleAdd} className="px-3 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-primary)] text-xs">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Backup Section ────────────────────────────────────────────────────────────
function BackupSection() {
  const user = useAuthStore(s => s.user);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const lastBackup = getLastBackupTime();

  const handleManualBackup = () => {
    if (!user) return;
    manualBackup(user.id);
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    setRestoreMsg('');
    const result = await restoreFromBackupFile(file);
    setRestoreMsg(result.message);
    setIsRestoring(false);
    if (result.success && window.confirm(`${result.message}\n\nTải lại ứng dụng ngay?`)) {
      window.location.reload();
    }
    if (restoreRef.current) restoreRef.current.value = '';
  };

  return (
    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
        <Clock size={10} />
        Backup tự động: {lastBackup ? lastBackup.toLocaleString('vi-VN') : 'Chưa có'}
      </p>
      <div className="flex gap-2">
        <button onClick={handleManualBackup}
          className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-green-500/15 text-green-400 min-h-[40px] flex items-center justify-center gap-1.5">
          <Save size={13} /> Backup thủ công
        </button>
        <button onClick={() => restoreRef.current?.click()}
          disabled={isRestoring}
          className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] min-h-[40px] flex items-center justify-center gap-1.5 disabled:opacity-50">
          <FolderOpen size={13} /> Khôi phục
        </button>
      </div>
      {restoreMsg && (
        <p className="text-[10px] text-center text-[var(--success)] bg-green-500/10 rounded-lg px-3 py-2">{restoreMsg}</p>
      )}
      <input ref={restoreRef} type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
      <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
        Backup thủ công tải file JSON về thiết bị. Backup tự động lưu vào bộ nhớ cục bộ mỗi 3 giờ.
        Dùng nút Khôi phục để upload file JSON backup khi cần.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const clearAllData = useTaskStore(s => s.clearAllData);
  const tasks = useTaskStore(s => s.tasks);
  const templates = useTemplateStore(s => s.templates);
  const gamState = useGamificationStore(s => s.state);
  const fontScale = useSettingsStore(s => s.fontScale);
  const hourHeight = useSettingsStore(s => s.hourHeight);
  const setHourHeight = useSettingsStore(s => s.setHourHeight);
  const tickSoundEnabled = useSettingsStore(s => s.tickSoundEnabled);
  const voiceEnabled = useSettingsStore(s => s.voiceEnabled);
  const timezone = useSettingsStore(s => s.timezone);
  
  // Audio settings state
  const [audioEnabled, setAudioEnabledState] = useState(() => getAudioSettings().enabled);
  const [masterVolume, setMasterVolumeState] = useState(() => getAudioSettings().masterVolume * 100);
  const notificationSettings = useSettingsStore(s => s.notificationSettings);
  const voiceSettings = useSettingsStore(s => s.voiceSettings);
  const theme = useSettingsStore(s => s.theme);
  const language = useSettingsStore(s => s.language);
  const setFontScale = useSettingsStore(s => s.setFontScale);
  const setLanguage = useSettingsStore(s => s.setLanguage);
  const setTickSound = useSettingsStore(s => s.setTickSound);
  const setVoiceEnabled = useSettingsStore(s => s.setVoiceEnabled);
  const setTimezone = useSettingsStore(s => s.setTimezone);
  const setNotificationSettings = useSettingsStore(s => s.setNotificationSettings);
  const setVoiceSettings = useSettingsStore(s => s.setVoiceSettings);
  const setTheme = useSettingsStore(s => s.setTheme);
  const dailyScheduleSlots = useSettingsStore(s => s.dailyScheduleSlots);
  const setDailyScheduleSlots = useSettingsStore(s => s.setDailyScheduleSlots);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const os = getOS();
  const installed = isStandalone();
  const notifGranted = canSendNotification();

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [newEncouragement, setNewEncouragement] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState({ 
    name: '', 
    startTime: '09:00', 
    endTime: '10:00', 
    color: '#3B82F6',
    days: [0, 1, 2, 3, 4, 5, 6] as number[], // Every day by default
    description: '',
    icon: 'clock',
    active: true
  });
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const testVoiceText = 'Xin chào! Đây là giọng nói thử nghiệm của Lucy.';

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices.filter(v => v.lang.startsWith('vi') || v.lang.startsWith('en')));
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const fontSizes = [
    { label: 'Nhỏ', value: 0.85 },
    { label: 'Vừa', value: 1 },
    { label: 'Lớn', value: 1.15 },
    { label: 'Rất lớn', value: 1.3 },
  ];

  const handleClear = () => {
    if (window.confirm('Xóa toàn bộ dữ liệu?')) { clearAllData(); window.location.reload(); }
  };

  // ✅ #12: Logout clears session, forces OTP re-login
  const handleLogout = async () => {
    if (user?.id !== 'admin') {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('nw_admin_session');
    }
    logout();
  };

  const handleExport = () => {
    exportData(tasks, templates, gamState, { fontScale, tickSoundEnabled, voiceEnabled, timezone, notificationSettings });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importData(file);
    if (result.error) { alert(result.error); return; }
    if (window.confirm(`Nhập ${result.tasks?.length || 0} việc, ${result.templates?.length || 0} mẫu?`)) {
      const userId = user?.id && user.id !== 'admin' ? user.id : 'admin';
      
      if (result.tasks) {
        localStorage.setItem(`nw_tasks_${userId}`, JSON.stringify(result.tasks));
      }
      if (result.templates) {
        localStorage.setItem(`nw_templates_${userId}`, JSON.stringify(result.templates));
      }
      if (result.gamification) {
        localStorage.setItem(`nw_gamification_${userId}`, JSON.stringify(result.gamification));
      }
      if (result.settings) {
        // Import all settings
        Object.entries(result.settings).forEach(([key, value]) => {
          localStorage.setItem(`nw_${key}`, JSON.stringify(value));
        });
      }
      window.location.reload();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddEncouragement = () => {
    if (!newEncouragement.trim()) return;
    const updated = [...(voiceSettings.encouragements || []), newEncouragement.trim()];
    setVoiceSettings({ encouragements: updated });
    setNewEncouragement('');
  };

  const handleRemoveEncouragement = (idx: number) => {
    const updated = (voiceSettings.encouragements || []).filter((_, i) => i !== idx);
    setVoiceSettings({ encouragements: updated });
  };

  const handleAddTimeSlot = () => {
    if (!newTimeSlot.name.trim()) return;
    
    // Check for time overlap with existing slots (strict - even 1 minute overlap is not allowed)
    let newStart = newTimeSlot.startTime;
    let newEnd = newTimeSlot.endTime;
    
    const [newStartH, newStartM] = newStart.split(':').map(Number);
    const [newEndH, newEndM] = newEnd.split(':').map(Number);
    let newStartMin = newStartH * 60 + newStartM;
    let newEndMin = newEndH * 60 + newEndM;
    
    // Validate time
    if (newEndMin <= newStartMin) {
      alert('Thời gian kết thúc phải lớn hơn thời gian bắt đầu!');
      return;
    }
    
    // Auto-adjust time if overlap detected - shift to after conflicting slot
    let adjusted = false;
    const conflictingSlots = dailyScheduleSlots.filter(slot => {
      if (!slot.startTime || !slot.endTime) return false;
      const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
      const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);
      const slotStartMin = slotStartH * 60 + slotStartM;
      const slotEndMin = slotEndH * 60 + slotEndM;
      
      // Strict overlap check - even 1 minute overlap counts as conflict
      return newStartMin < slotEndMin && newEndMin > slotStartMin;
    });
    
    if (conflictingSlots.length > 0) {
      // Find the slot that ends latest among conflicting slots
      const latestEndMin = Math.max(...conflictingSlots.map(slot => {
        const [h, m] = slot.endTime!.split(':').map(Number);
        return h * 60 + m;
      }));
      
      // Auto-adjust: start right after the latest ending slot
      newStartMin = latestEndMin + 1; // 1 minute gap
      newEndMin = newStartMin + (newEndMin - newStartMin);
      
      // If goes past midnight, cap at 23:59
      if (newEndMin > 24 * 60) {
        newEndMin = 24 * 60;
        newStartMin = Math.max(0, newEndMin - 60);
      }
      
      newStart = `${Math.floor(newStartMin / 60).toString().padStart(2, '0')}:${(newStartMin % 60).toString().padStart(2, '0')}`;
      newEnd = `${Math.floor(newEndMin / 60).toString().padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;
      adjusted = true;
    }
    
    const slot = { 
      ...newTimeSlot, 
      startTime: newStart,
      endTime: newEnd,
      id: `slot_${Date.now()}`, 
      color: newTimeSlot.color + '26',
      active: true
    };
    setDailyScheduleSlots([...dailyScheduleSlots, slot]);
    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '10:00', color: '#3B82F6', days: [0, 1, 2, 3, 4, 5, 6], description: '', icon: 'clock', active: true });
    
    if (adjusted) {
      alert(`Đã tự động điều chỉnh thời gian để tránh trùng lặp!
Thời gian mới: ${newStart} - ${newEnd}`);
    }
  };

  const handleRemoveTimeSlot = (id: string) => {
    setDailyScheduleSlots(dailyScheduleSlots.filter(s => s.id !== id));
  };

  const handleToggleTimeSlot = (id: string) => {
    setDailyScheduleSlots(dailyScheduleSlots.map(s => 
      s.id === id ? { ...s, active: !s.active } : s
    ));
  };

  const handleDuplicateTimeSlot = (slot: typeof dailyScheduleSlots[0]) => {
    // Check for time overlap with existing slots
    if (!slot.startTime || !slot.endTime) return;
    
    let newStart = slot.startTime;
    let newEnd = slot.endTime;
    
    const [newStartH, newStartM] = newStart.split(':').map(Number);
    const [newEndH, newEndM] = newEnd.split(':').map(Number);
    let newStartMin = newStartH * 60 + newStartM;
    let newEndMin = newEndH * 60 + newEndM;
    
    // Auto-adjust time if overlap detected - shift to after conflicting slot
    let adjusted = false;
    const duration = newEndMin - newStartMin;
    
    const conflictingSlots = dailyScheduleSlots.filter(s => {
      if (s.id === slot.id || !s.startTime || !s.endTime) return false;
      const [slotStartH, slotStartM] = s.startTime.split(':').map(Number);
      const [slotEndH, slotEndM] = s.endTime.split(':').map(Number);
      const slotStartMin = slotStartH * 60 + slotStartM;
      const slotEndMin = slotEndH * 60 + slotEndM;
      
      // Strict overlap check - even 1 minute overlap counts as conflict
      return newStartMin < slotEndMin && newEndMin > slotStartMin;
    });
    
    if (conflictingSlots.length > 0) {
      // Find the slot that ends latest among conflicting slots
      const latestEndMin = Math.max(...conflictingSlots.map(slot => {
        const [h, m] = slot.endTime!.split(':').map(Number);
        return h * 60 + m;
      }));
      
      // Auto-adjust: start right after the latest ending slot
      newStartMin = latestEndMin + 1; // 1 minute gap
      newEndMin = newStartMin + duration;
      
      // If goes past midnight, cap at 23:59
      if (newEndMin > 24 * 60) {
        newEndMin = 24 * 60;
        newStartMin = Math.max(0, newEndMin - duration);
      }
      
      newStart = `${Math.floor(newStartMin / 60).toString().padStart(2, '0')}:${(newStartMin % 60).toString().padStart(2, '0')}`;
      newEnd = `${Math.floor(newEndMin / 60).toString().padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;
      adjusted = true;
    }
    
    const newSlot = { 
      ...slot, 
      id: `slot_${Date.now()}`,
      startTime: newStart,
      endTime: newEnd,
      name: `${slot.name} (copy)`
    };
    setDailyScheduleSlots([...dailyScheduleSlots, newSlot]);
    
    if (adjusted) {
      alert(`Đã tự động điều chỉnh thời gian để tránh trùng lặp!
Thời gian mới: ${newStart} - ${newEnd}`);
    }
  };

  const handleEditTimeSlot = (slot: typeof dailyScheduleSlots[0]) => {
    setEditingSlot(slot.id);
    setNewTimeSlot({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      color: slot.color.replace('26', '').replace('40', ''),
      days: slot.days || [0, 1, 2, 3, 4, 5, 6],
      description: slot.description || '',
      icon: slot.icon || 'clock',
      active: slot.active !== false
    });
  };

  const handleUpdateTimeSlot = () => {
    if (!newTimeSlot.name.trim() || !editingSlot) return;
    setDailyScheduleSlots(dailyScheduleSlots.map(s => 
      s.id === editingSlot ? { 
        ...s, 
        ...newTimeSlot, 
        color: newTimeSlot.color + '26' 
      } : s
    ));
    setEditingSlot(null);
    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '10:00', color: '#3B82F6', days: [1, 2, 3, 4, 5], description: '', icon: 'clock', active: true });
  };

  const handleCancelEdit = () => {
    setEditingSlot(null);
    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '10:00', color: '#3B82F6', days: [1, 2, 3, 4, 5], description: '', icon: 'clock', active: true });
  };

  const quickPresets = [
    { name: 'Giờ làm việc', startTime: '09:00', endTime: '12:00', icon: 'briefcase', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Nghỉ trưa', startTime: '12:00', endTime: '13:00', icon: 'coffee', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Chiều làm việc', startTime: '13:00', endTime: '18:00', icon: 'briefcase', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Tập thể dục', startTime: '18:00', endTime: '19:00', icon: 'dumbbell', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Ngủ', startTime: '22:00', endTime: '06:00', icon: 'moon', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Học tập', startTime: '19:00', endTime: '21:00', icon: 'book', days: [0, 1, 2, 3, 4, 5, 6] },
  ];

  const handleApplyPreset = (preset: typeof quickPresets[0]) => {
    const slot = {
      id: `slot_${Date.now()}`,
      name: preset.name,
      startTime: preset.startTime,
      endTime: preset.endTime,
      color: '#3B82F6' + '26',
      days: preset.days,
      description: '',
      icon: preset.icon,
      active: true
    };
    setDailyScheduleSlots([...dailyScheduleSlots, slot]);
  };

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const iconOptions = [
    { value: 'clock', label: '🕐' },
    { value: 'briefcase', label: '💼' },
    { value: 'coffee', label: '☕' },
    { value: 'moon', label: '🌙' },
    { value: 'dumbbell', label: '🏋️' },
    { value: 'book', label: '📚' },
    { value: 'food', label: '🍽️' },
    { value: 'heart', label: '❤️' },
    { value: 'star', label: '⭐' },
  ];

  return (
    <div className="flex flex-col h-full px-4 pb-24 overflow-y-auto no-scrollbar" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-500/20 active:scale-95 transition-all">
            <Settings size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Cài đặt</h1>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">System Preferences</p>
          </div>
        </div>
        <button onClick={handleLogout} className="size-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 active:scale-90 transition-all">
          <LogOut size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Profile Section */}
        <div className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-[var(--accent-dim)] border-4 border-[var(--bg-surface)] shadow-md flex items-center justify-center text-2xl font-black text-[var(--accent-primary)]">
              {user?.username?.[0] || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-[var(--text-primary)]">{user?.username || 'Người dùng'}</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium mb-2">{user?.email}</p>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent-primary)] text-[10px] font-bold uppercase tracking-wider">
                  {user?.id === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                  Level {gamState.level}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Display & Interface */}
        <Section title="Giao diện & Hiển thị" icon={<Sun size={18} className="text-amber-500" />} defaultOpen>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--text-primary)]">Chế độ tối</span>
                <span className="text-[10px] text-[var(--text-muted)]">Chuyển đổi giữa sáng và tối</span>
              </div>
              <Toggle value={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase ml-1">Kích cỡ chữ</span>
              <div className="grid grid-cols-4 gap-2">
                {fontSizes.map(s => (
                  <button key={s.value} onClick={() => setFontScale(s.value)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${fontScale === s.value ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Chiều cao Lịch biểu</span>
                <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{hourHeight}px</span>
              </div>
              <input type="range" min="30" max="300" value={hourHeight} onChange={e => setHourHeight(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full appearance-none accent-[var(--accent-primary)] border border-[var(--border-subtle)]" />
            </div>
          </div>
        </Section>

        {/* Notifications & Sound */}
        <Section title="Thông báo & Âm thanh" icon={<Bell size={18} className="text-blue-500" />}>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--text-primary)]">Thông báo đẩy</span>
                <span className="text-[10px] text-[var(--text-muted)]">{notifGranted ? 'Đã cấp quyền' : 'Chưa cấp quyền'}</span>
              </div>
              <Toggle value={notificationSettings.enabled} onChange={(v) => setNotificationSettings({ enabled: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--text-primary)]">Âm thanh Lucy</span>
                <span className="text-[10px] text-[var(--text-muted)]">Âm thanh khi Lucy phản hồi</span>
              </div>
              <Toggle value={audioEnabled} onChange={(v) => { setAudioEnabled(v); setAudioEnabledState(v); }} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Âm lượng hệ thống</span>
                <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{masterVolume}%</span>
              </div>
              <input type="range" min="0" max="100" value={masterVolume} 
                onChange={e => {
                  const v = parseInt(e.target.value);
                  setMasterVolume(v / 100);
                  setMasterVolumeState(v);
                }}
                className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full appearance-none accent-[var(--accent-primary)] border border-[var(--border-subtle)]" />
            </div>

            {/* Voice Settings */}
            <div className="border-t border-[var(--border-subtle)]/50 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--text-primary)]">Giọng nói Lucy</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Giọng nói thông báo & khích lệ</span>
                </div>
                <Toggle value={voiceEnabled} onChange={setVoiceEnabled} />
              </div>

              {voiceEnabled && (
                <>
                  {/* Voice Type Selection */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase ml-1">Loại giọng nói</span>
                    <select 
                      value={voiceSettings.voiceName || ''}
                      onChange={(e) => setVoiceSettings({ voiceName: e.target.value })}
                      className="w-full py-2 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    >
                      <option value="">Mặc định (Việt Nam)</option>
                      {availableVoices.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speed Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Tốc độ</span>
                      <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{voiceSettings.rate.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.1" 
                      value={voiceSettings.rate}
                      onChange={(e) => setVoiceSettings({ rate: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full appearance-none accent-[var(--accent-primary)] border border-[var(--border-subtle)]" 
                    />
                  </div>

                  {/* Pitch Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Cao độ</span>
                      <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{voiceSettings.pitch.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.1" 
                      value={voiceSettings.pitch}
                      onChange={(e) => setVoiceSettings({ pitch: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full appearance-none accent-[var(--accent-primary)] border border-[var(--border-subtle)]" 
                    />
                  </div>

                  {/* Test Voice Button */}
                  <button 
                    onClick={() => {
                      // Test voice with current settings
                      if (!('speechSynthesis' in window)) return;
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance(testVoiceText);
                      utterance.rate = voiceSettings.rate;
                      utterance.pitch = voiceSettings.pitch;
                      
                      const voices = window.speechSynthesis.getVoices();
                      let voice = null;
                      
                      // Try user-selected voice first
                      if (voiceSettings.voiceName) {
                        voice = voices.find(v => v.name === voiceSettings.voiceName);
                      }
                      
                      // Fallback: Vietnamese voices
                      if (!voice) {
                        voice = voices.find(v => v.lang.startsWith('vi') && v.name.toLowerCase().includes('female'))
                          || voices.find(v => v.lang.startsWith('vi'))
                          || voices.find(v => v.lang.startsWith('vi-VN'));
                      }
                      
                      if (!voice) {
                        voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
                        utterance.lang = voice?.lang || 'en-US';
                      } else {
                        utterance.lang = 'vi-VN';
                      }
                      
                      if (voice) utterance.voice = voice;
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Volume2 size={16} /> Nghe thử giọng nói
                  </button>

                  {/* Encouragements */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase ml-1">Câu khích lệ</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newEncouragement}
                        onChange={(e) => setNewEncouragement(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddEncouragement()}
                        placeholder="Thêm câu khích lệ..."
                        className="flex-1 py-2 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button 
                        onClick={handleAddEncouragement}
                        className="px-3 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold active:scale-95 transition-all"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(voiceSettings.encouragements || []).map((enc, idx) => (
                        <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]">
                          <span>{enc}</span>
                          <button onClick={() => handleRemoveEncouragement(idx)} className="text-red-400 hover:text-red-600">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Section>

        {/* Financial Settings */}
        <Section title="Cấu hình Dòng tiền" icon={<Wallet size={18} className="text-emerald-500" />}>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl mb-2">
              <p className="text-[10px] text-blue-500 font-medium leading-relaxed">
                Thiết lập hạng mục thu chi và chi phí hàng tháng để hệ thống tự động tính toán hiệu quả tài chính dựa trên thời gian thực tế bạn làm việc.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 ml-1">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-black text-[var(--text-primary)]">Hạng mục thu chi</span>
              </div>
              <FinanceCategoriesSection />
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]/50">
              <div className="flex items-center gap-2 ml-1">
                <div className="size-1.5 rounded-full bg-red-500" />
                <span className="text-xs font-black text-[var(--text-primary)]">Chi phí cố định (Tháng)</span>
              </div>
              <CostItemsSection />
            </div>
          </div>
        </Section>

        {/* Data Management */}
        <Section title="Dữ liệu & Bảo mật" icon={<Shield size={18} className="text-indigo-500" />}>
          <div className="space-y-4 pt-2">
            <BackupSection />
            
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExport} className="py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Download size={14} /> Xuất JSON
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Upload size={14} /> Nhập JSON
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

            <button onClick={handleClear} className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Trash2 size={14} /> Xóa toàn bộ dữ liệu
            </button>
          </div>
        </Section>

        {/* Admin Section */}
        {user?.id === 'admin' && (
          <Section title="Quản trị" icon={<Shield size={18} className="text-red-500" />}>
            <div className="pt-2">
              <button onClick={() => setShowAdmin(!showAdmin)}
                className="w-full py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-2 active:scale-95 transition-all">
                {showAdmin ? 'Đóng bảng điều khiển' : 'Mở bảng điều khiển Admin'}
              </button>
              {showAdmin && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AdminPage />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* App Info */}
        <div className="pt-6 pb-2 flex flex-col items-center gap-2">
          <div className="size-12 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center">
            <span className="text-xl font-black text-[var(--accent-primary)]">N</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-[var(--text-primary)] tracking-tight">Nghiệp Việc Pro</p>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">Version 2.5.0 • Build 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}

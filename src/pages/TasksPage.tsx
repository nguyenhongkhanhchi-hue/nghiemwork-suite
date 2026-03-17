import { useTaskStore, useSettingsStore, useAuthStore } from '@/stores';
import { TaskList } from '@/components/features/TaskList';
import { DailySchedule24h } from '@/components/features/DailySchedule24h';
import { Slider } from '@/components/ui/slider';
import { Calendar, Download, FileJson, FileText, File, LayoutGrid, Clock, Layers, CheckSquare } from 'lucide-react';
import { getNowInTimezone } from '@/lib/notifications';
import { downloadICS, downloadJSON, downloadCSV, exportToPDF } from '@/lib/calendarExport';
import { useState, useEffect } from 'react';
import { updateUserLastActive } from '@/lib/userTracking';

export default function TasksPage() {
  const timer = useTaskStore(s => s.timer);
  const tasks = useTaskStore(s => s.tasks);
  const timezone = useSettingsStore(s => s.timezone);
  const user = useAuthStore(s => s.user);
  const setCurrentPage = useSettingsStore(s => s.setCurrentPage);
  const taskViewMode = useSettingsStore(s => s.taskViewMode);
  const setTaskViewMode = useSettingsStore(s => s.setTaskViewMode);
  const hourHeight = useSettingsStore(s => s.hourHeight);
  const setHourHeight = useSettingsStore(s => s.setHourHeight);
  
  const [now, setNow] = useState(getNowInTimezone(timezone));
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [scheduleScrollTrigger, setScheduleScrollTrigger] = useState(0);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());

  const handleExportCalendar = () => {
    const tasksWithDeadline = tasks.filter(t => t.deadline);
    if (tasksWithDeadline.length === 0) {
      alert('Không có việc nào có hạn chót để xuất');
      return;
    }
    downloadICS(tasksWithDeadline);
  };

  const handleExportJSON = () => {
    if (tasks.length === 0) {
      alert('Không có việc nào để xuất');
      return;
    }
    downloadJSON(tasks);
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) {
      alert('Không có việc nào để xuất');
      return;
    }
    downloadCSV(tasks);
  };

  const handleExportPDF = () => {
    if (tasks.length === 0) {
      alert('Không có việc nào để xuất');
      return;
    }
    exportToPDF(tasks);
  };

  useEffect(() => {
    const i = setInterval(() => setNow(getNowInTimezone(timezone)), 1000);
    return () => clearInterval(i);
  }, [timezone]);

  // Update last active
  useEffect(() => {
    if (user) updateUserLastActive(user.id);
  }, [user]);

  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dayName = dayNames[now.getDay()];
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const hasTimer = timer.isRunning || timer.isPaused;
  
  return (
    <div className="flex flex-col h-full px-4" style={{ paddingTop: hasTimer ? 'calc(64px + env(safe-area-inset-top, 16px))' : 'max(16px, env(safe-area-inset-top, 16px))' }}>
      {/* Premium Header */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-lg shadow-[var(--accent-primary)]/20 active:scale-95 transition-all">
              <CheckSquare size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Việc cần làm</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent-primary)]">{dayName}</span>
                <span className="text-[10px] font-mono font-medium text-[var(--text-muted)]">{dateStr} • {timeStr}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage('templates')} 
              className="size-10 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] active:scale-90 transition-all"
              title="Mẫu công việc"
            >
              <FileText size={18} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                className={`size-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${showExportMenu ? 'bg-[var(--accent-primary)] text-white shadow-lg' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'}`}
                title="Xuất báo cáo"
              >
                <Download size={18} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-2 grid grid-cols-1 gap-1">
                    <button onClick={() => { handleExportCalendar(); setShowExportMenu(false); }} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--bg-surface)] transition-colors">
                      <Calendar size={14} className="text-blue-400" /> Xuất Calendar (ICS)
                    </button>
                    <button onClick={() => { handleExportJSON(); setShowExportMenu(false); }} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--bg-surface)] transition-colors">
                      <FileJson size={14} className="text-amber-400" /> Dữ liệu JSON
                    </button>
                    <button onClick={() => { handleExportCSV(); setShowExportMenu(false); }} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--bg-surface)] transition-colors">
                      <FileText size={14} className="text-green-400" /> Bảng tính CSV
                    </button>
                    <button onClick={() => { handleExportPDF(); setShowExportMenu(false); }} className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--bg-surface)] transition-colors">
                      <File size={14} className="text-red-400" /> Tài liệu PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle - Full width 50/50 */}
        <div className="flex items-center p-1 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)] shadow-inner">
          <button
            onClick={() => setTaskViewMode('matrix')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              taskViewMode === 'matrix' 
                ? 'bg-[var(--accent-primary)] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <LayoutGrid size={14} strokeWidth={2.5} />
            <span>Ma trận</span>
          </button>
          <button
            onClick={() => { setTaskViewMode('schedule'); setScheduleScrollTrigger(t => t + 1); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              taskViewMode === 'schedule' 
                ? 'bg-[var(--accent-primary)] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clock size={14} strokeWidth={2.5} />
            <span>Lịch biểu</span>
          </button>
        </div>
      </div>

      {/* Hour Height Adjustment Slider (only in schedule mode) */}
      {taskViewMode === 'schedule' && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="size-8 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent-primary)]">
            <Layers size={16} />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tỷ lệ hiển thị</span>
              <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{hourHeight}px</span>
            </div>
            <Slider
              value={[hourHeight]}
              onValueChange={([value]) => setHourHeight(value)}
              min={30}
              max={1200}
              step={5}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* View Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {taskViewMode === 'matrix' ? (
          <TaskList />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-inner">
            <DailySchedule24h 
              scrollToNowTrigger={scheduleScrollTrigger} 
              selectedDate={scheduleDate} 
              onDateChange={setScheduleDate} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

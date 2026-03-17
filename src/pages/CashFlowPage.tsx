import { useMemo, useState } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { getNowInTimezone } from '@/lib/notifications';
import { Wallet, TrendingUp, TrendingDown, Clock, ChevronLeft, ChevronRight, AlertCircle, BarChart3, Calendar, PieChart, LineChart, Zap } from 'lucide-react';
import type { FinanceCategory, CostItem } from '@/types';

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

// Type for date range
type DateRangeType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export default function CashFlowPage() {
  const tasks = useTaskStore(s => s.tasks);
  const timezone = useSettingsStore(s => s.timezone);
  const financeCategories = useSettingsStore(s => s.financeCategories);
  const costItems = useSettingsStore(s => s.costItems);
  const now = getNowInTimezone(timezone);
  
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('day');
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [customDateStart, setCustomDateStart] = useState<string>('');
  const [customDateEnd, setCustomDateEnd] = useState<string>('');

  // ✅ Get first data date (first task creation date)
  const firstDataDate = useMemo(() => {
    if (tasks.length > 0) {
      const earliest = Math.min(...tasks.map(t => t.createdAt));
      return earliest;
    }
    return Date.now() - 30 * 24 * 60 * 60 * 1000; // Default to 30 days ago
  }, [tasks]);

  const firstDataDateStr = useMemo(() => {
    const d = new Date(firstDataDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [firstDataDate]);

  // Calculate time range based on type
  const { rangeStart, rangeEnd, rangeLabel, displayDate } = useMemo(() => {
    const n = getNowInTimezone(timezone);
    
    // Handle custom date range
    if (dateRangeType === 'custom' && customDateStart && customDateEnd) {
      const start = new Date(customDateStart).getTime();
      const end = new Date(customDateEnd).getTime() + 86400000; // Include the end date
      return { 
        rangeStart: start, 
        rangeEnd: end, 
        rangeLabel: `${customDateStart} - ${customDateEnd}`,
        displayDate: new Date(customDateStart)
      };
    }
    
    // Handle specific day selection
    if (selectedDate) {
      const d = new Date(selectedDate);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86400000;
      return { 
        rangeStart: start, 
        rangeEnd: end, 
        rangeLabel: d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }),
        displayDate: d
      };
    }
    
    if (dateRangeType === 'day') {
      const start = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
      return { rangeStart: start, rangeEnd: start + 86400000, rangeLabel: 'Hôm nay', displayDate: n };
    }
    
    if (dateRangeType === 'week') {
      const weekStart = new Date(n);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      return { rangeStart: weekStart.getTime(), rangeEnd: weekStart.getTime() + 7 * 86400000, rangeLabel: 'Tuần này', displayDate: weekStart };
    }
    
    if (dateRangeType === 'month') {
      const d = new Date(n.getFullYear(), n.getMonth() + monthOffset, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const label = d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
      return { rangeStart: start, rangeEnd: end, rangeLabel: label, displayDate: d };
    }
    
    if (dateRangeType === 'quarter') {
      const quarter = Math.floor(n.getMonth() / 3);
      const d = new Date(n.getFullYear(), quarter * 3, 1);
      const start = d.getTime();
      const end = new Date(n.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59).getTime();
      const label = `Q${quarter + 1} ${n.getFullYear()}`;
      return { rangeStart: start, rangeEnd: end, rangeLabel: label, displayDate: d };
    }
    
    // year
    const d = new Date(n.getFullYear(), 0, 1);
    const start = d.getTime();
    const end = new Date(n.getFullYear(), 11, 31, 23, 59, 59).getTime();
    return { rangeStart: start, rangeEnd: end, rangeLabel: `Năm ${n.getFullYear()}`, displayDate: d };
  }, [dateRangeType, monthOffset, selectedDate, customDateStart, customDateEnd, timezone]);

  // ✅ #9: Calculate cost per second from costItems
  const costPerSecond = useMemo(() => {
    const totalPerMonth = costItems.reduce((s, i) => s + i.amount, 0);
    return totalPerMonth / (30 * 24 * 3600);
  }, [costItems]);

  const costPerHour = costPerSecond * 3600;
  const costPerMinute = costPerSecond * 60;

  // ✅ #10: Aggregate completed tasks in range
  const completedInRange = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= rangeStart && t.completedAt <= rangeEnd),
    [tasks, rangeStart, rangeEnd]
  );

  // Income by categories
  const incomeCategories = financeCategories.filter(c => c.type === 'income');
  const expenseCategories = financeCategories.filter(c => c.type === 'expense');

  const totalIncome = useMemo(() =>
    completedInRange.reduce((s, t) => {
      if (t.finance?.type === 'income') return s + (t.finance.amount || 0);
      return s;
    }, 0), [completedInRange]);

  const totalExpense = useMemo(() =>
    completedInRange.reduce((s, t) => {
      if (t.finance?.type === 'expense') return s + (t.finance.amount || 0);
      return s;
    }, 0), [completedInRange]);

  // ✅ #10: Time cost = tracked seconds × cost/second
  const totalTrackedSeconds = useMemo(() =>
    completedInRange.reduce((s, t) => s + (t.duration || 0), 0),
    [completedInRange]
  );

  // ✅ Tính tổng thời gian không theo dõi của các việc đã hoàn thành
  const totalUntrackedSeconds = useMemo(() => {
    return completedInRange.reduce((s, t) => {
      const totalTaskTime = t.completedAt ? Math.floor((t.completedAt - t.createdAt) / 1000) : 0;
      const untracked = Math.max(0, totalTaskTime - (t.duration || 0));
      return s + untracked;
    }, 0);
  }, [completedInRange]);

  const trackedTimeCost = Math.round(totalTrackedSeconds * costPerSecond);
  const untrackedTimeCost = Math.round(totalUntrackedSeconds * costPerSecond);
  const timeCost = trackedTimeCost + untrackedTimeCost;

  // ✅ Chi phí cơ bản mỗi ngày = 24h × costPerSecond
  const DAY_SECONDS = 24 * 3600;
  
  // Calculate number of days in range
  const daysInRange = Math.ceil((rangeEnd - rangeStart) / 86400000);
  const dailyBaseCost = Math.round(DAY_SECONDS * costPerSecond);
  const rangeBaseCost = dailyBaseCost * daysInRange;
  
  // ✅ Tổng chi phí = chi phí cơ bản + chi phí từ các việc
  const totalDailyCost = rangeBaseCost + totalExpense;
  
  // ✅ Lời/Lỗ = thu nhập - chi phí - chi phí cơ bản
  const dailyNet = totalIncome - totalExpense - rangeBaseCost;
  
  // ✅ #10: Daily time efficiency (for the selected range)
  const totalRangeSeconds = daysInRange * DAY_SECONDS;
  const trackingEfficiency = totalRangeSeconds > 0 ? Math.round((totalTrackedSeconds / totalRangeSeconds) * 100) : 0;
  const unTrackedSeconds = Math.max(0, totalRangeSeconds - totalTrackedSeconds);

  // Net = thu - chi - chi phí cơ bản
  const netProfit = totalIncome - totalExpense - rangeBaseCost;

  // Task breakdown
  const taskRows = completedInRange.filter(t => t.finance || t.duration);

  // 📊 Generate chart data for the range (daily breakdown)
  const chartData = useMemo(() => {
    const days: { date: string; income: number; expense: number; net: number; label: string }[] = [];
    
    // Determine granularity based on range
    let current = new Date(rangeStart);
    const end = new Date(rangeEnd);
    
    while (current.getTime() < end.getTime()) {
      const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      
      const dayTasks = tasks.filter(t => 
        t.status === 'done' && t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd
      );
      
      const dayIncome = dayTasks.reduce((s, t) => s + (t.finance?.type === 'income' ? t.finance.amount : 0), 0);
      const dayExpense = dayTasks.reduce((s, t) => s + (t.finance?.type === 'expense' ? t.finance.amount : 0), 0);
      const dayBaseCost = dailyBaseCost;
      const dayNet = dayIncome - dayExpense - dayBaseCost;
      
      const label = current.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
      
      days.push({
        date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        income: dayIncome,
        expense: dayExpense + dayBaseCost,
        net: dayNet,
        label
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [rangeStart, rangeEnd, tasks, dailyBaseCost]);

  // Find max value for chart scaling
  const maxChartValue = useMemo(() => {
    const max = Math.max(...chartData.map(d => Math.max(d.income, Math.abs(d.net))));
    return max > 0 ? max : 1000000;
  }, [chartData]);

  // 📈 Statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
    const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
    const avgDaily = (totalIncome + totalExpense) / chartData.length;
    const positiveDays = chartData.filter(d => d.net > 0).length;
    const negativeDays = chartData.filter(d => d.net < 0).length;
    const bestDay = chartData.reduce((best, d) => d.net > best.net ? d : best, chartData[0]);
    const worstDay = chartData.reduce((worst, d) => d.net < worst.net ? d : worst, chartData[0]);
    
    return { totalIncome, totalExpense, avgDaily, positiveDays, negativeDays, bestDay, worstDay };
  }, [chartData]);

  return (
    <div className="flex flex-col h-full px-4 pb-24 overflow-y-auto no-scrollbar" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
            <Wallet size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Dòng tiền</h1>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tài chính cá nhân</p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-2">
          <Calendar size={14} className="text-[var(--accent-primary)]" />
          <span className="text-[10px] font-bold text-[var(--text-primary)]">{rangeLabel}</span>
        </div>
      </div>

      {/* Date range selector - Scrollable Chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
        {(['day', 'week', 'month', 'quarter', 'year', 'custom'] as const).map(r => (
          <button key={r} onClick={() => { setDateRangeType(r); setSelectedDate(null); }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${dateRangeType === r && !selectedDate ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`}>
            {r === 'day' ? 'Hôm nay' : r === 'week' ? 'Tuần này' : r === 'month' ? 'Tháng này' : r === 'quarter' ? 'Quý này' : r === 'year' ? 'Năm nay' : 'Tùy chọn'}
          </button>
        ))}
      </div>

      {/* Navigation & Custom Inputs */}
      <div className="flex flex-col gap-3 mb-6">
        {(dateRangeType === 'month' || dateRangeType === 'quarter') && (
          <div className="flex items-center gap-2">
            <button onClick={() => setMonthOffset(p => p - 1)} className="size-11 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] active:scale-90 transition-all">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 h-11 flex items-center justify-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <span className="text-sm font-black text-[var(--text-primary)]">{rangeLabel}</span>
            </div>
            <button onClick={() => setMonthOffset(p => Math.min(p + 1, 0))} disabled={monthOffset >= 0} className="size-11 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30 active:scale-90 transition-all">
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {dateRangeType === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] ml-2 uppercase">Từ ngày</span>
              <input type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)}
                min={firstDataDateStr} max={customDateEnd || new Date().toISOString().split('T')[0]}
                className="w-full h-11 px-4 rounded-2xl bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] ml-2 uppercase">Đến ngày</span>
              <input type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)}
                min={customDateStart || firstDataDateStr} max={new Date().toISOString().split('T')[0]}
                className="w-full h-11 px-4 rounded-2xl bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] outline-none" />
            </div>
          </div>
        )}

        {dateRangeType === 'day' && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] ml-2 uppercase">Chọn ngày cụ thể</span>
            <div className="flex gap-2">
              <input type="date" value={selectedDate || ''} onChange={(e) => setSelectedDate(e.target.value || null)}
                min={firstDataDateStr} max={new Date().toISOString().split('T')[0]}
                className="flex-1 h-11 px-4 rounded-2xl bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] outline-none" />
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="h-11 px-4 rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-primary)] text-xs font-bold">Hôm nay</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="col-span-2 bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-surface)] rounded-3xl p-5 border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BarChart3 size={16} className="text-blue-500" />
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)]">Tổng quan tài chính</span>
            </div>
            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {netProfit >= 0 ? 'Có lãi' : 'Thâm hụt'}
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Lợi nhuận ròng</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono tabular-nums ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {netProfit >= 0 ? '+' : ''}{formatVND(netProfit)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]/50">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Tổng thu</span>
              <span className="text-lg font-black text-emerald-500 font-mono">+{formatVND(totalIncome)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Tổng chi</span>
              <span className="text-lg font-black text-red-500 font-mono">-{formatVND(totalExpense + rangeBaseCost)}</span>
            </div>
          </div>
        </div>

        {/* Small Cards */}
        <div className="bg-[var(--bg-elevated)] rounded-3xl p-4 border border-[var(--border-subtle)] flex flex-col gap-2">
          <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock size={16} className="text-amber-500" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Chi phí 24h</span>
          <span className="text-base font-black text-[var(--text-primary)] font-mono">-{formatVND(rangeBaseCost)}</span>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-3xl p-4 border border-[var(--border-subtle)] flex flex-col gap-2">
          <div className="size-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Hiệu suất TG</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-[var(--accent-primary)] font-mono">{trackingEfficiency}%</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-[var(--border-subtle)] mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LineChart size={18} className="text-[var(--accent-primary)]" />
              <span className="text-sm font-bold text-[var(--text-primary)]">Biến động số dư</span>
            </div>
          </div>
          
          <div className="h-40 flex items-end gap-1.5 px-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 group relative flex flex-col items-center">
                <div className="w-full flex flex-col items-center justify-end gap-0.5" style={{ height: '120px' }}>
                  <div 
                    className={`w-full max-w-[12px] rounded-full transition-all duration-500 group-hover:w-full ${d.net >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                    style={{ height: `${Math.max(4, (Math.abs(d.net) / maxChartValue) * 100)}px` }}
                  />
                </div>
                {/* Tooltip on hover simulation */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--bg-primary)] text-[8px] font-bold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {formatVND(d.net)}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between mt-4 px-2">
            <span className="text-[8px] font-bold text-[var(--text-muted)]">{chartData[0].label}</span>
            <span className="text-[8px] font-bold text-[var(--text-muted)]">{chartData[chartData.length-1].label}</span>
          </div>
        </div>
      )}

      {/* Efficiency & Insights */}
      <div className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-[var(--border-subtle)] mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-yellow-500" />
          <span className="text-sm font-bold text-[var(--text-primary)]">Hiệu suất & Phân tích</span>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Thời gian theo dõi</span>
              <span className="text-xs font-black text-[var(--text-primary)] font-mono">{trackingEfficiency}%</span>
            </div>
            <div className="w-full bg-[var(--bg-surface)] h-3 rounded-full overflow-hidden border border-[var(--border-subtle)]/30">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${trackingEfficiency}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[var(--bg-surface)] rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[18px] mb-1">⏱️</span>
              <span className="text-xs font-black text-[var(--text-primary)] font-mono">{formatTime(totalTrackedSeconds)}</span>
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-1">Đã dùng</span>
            </div>
            <div className="bg-[var(--bg-surface)] rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-[18px] mb-1">🌫️</span>
              <span className="text-xs font-black text-[var(--text-muted)] font-mono">{formatTime(unTrackedSeconds)}</span>
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-1">Bỏ phí</span>
            </div>
            <div className="bg-[var(--bg-surface)] rounded-2xl p-3 flex flex-col items-center text-center">
              <span className={`text-[18px] mb-1 ${trackingEfficiency > 70 ? 'animate-bounce' : ''}`}>
                {trackingEfficiency > 80 ? '🚀' : trackingEfficiency > 50 ? '📈' : '🐢'}
              </span>
              <span className="text-xs font-black text-emerald-500 font-mono">OK</span>
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-1">Trạng thái</span>
            </div>
          </div>
        </div>
      </div>

      {/* Task breakdown table if any */}
      {taskRows.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50">
            <span className="text-sm font-bold text-[var(--text-primary)]">Chi tiết công việc</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]/50">
            {taskRows.map(t => (
              <div key={t.id} className="p-4 flex items-center justify-between active:bg-[var(--bg-surface)] transition-colors">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">{t.title}</span>
                  <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-tighter">
                    {formatTime(t.duration || 0)} • {t.finance?.category || 'Chung'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-xs font-black font-mono ${t.finance?.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.finance?.type === 'income' ? '+' : '-'}{formatVND(t.finance?.amount || 0)}
                  </span>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono italic">
                    ~ {formatVND(Math.round((t.duration || 0) * costPerSecond))} (TG)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completedInRange.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wallet size={48} className="text-[var(--text-muted)] mb-3 opacity-40" />
          <p className="text-base text-[var(--text-muted)]">Chưa có việc hoàn thành trong khoảng thời gian này</p>
        </div>
      )}
    </div>
  );
}
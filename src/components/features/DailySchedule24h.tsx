import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { Play, Pause, Check, Clock, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task } from '@/types';
import { TaskViewModal } from './TaskViewModal';
import { TaskEditModal } from './TaskEditModal';
import { useScheduleNotifications } from '@/hooks/useScheduleNotifications';

// Default hour height, will be overridden by settings store
const DEFAULT_hourHeight = 60;

// Modern SOLID color palette - no transparency
const TASK_COLORS = [
  { bg: '#34D399', border: '#22C55E', text: '#ffffff' },
  { bg: '#60A5FA', border: '#3B82F6', text: '#ffffff' },
  { bg: '#FBBF24', border: '#F59E0B', text: '#1F2937' },
  { bg: '#A855F7', border: '#9333EA', text: '#ffffff' },
  { bg: '#F87171', border: '#EF4444', text: '#ffffff' },
  { bg: '#FB923C', border: '#EA580C', text: '#1F2937' },
  { bg: '#F472B6', border: '#EC4899', text: '#1F2937' },
  { bg: '#86EFAC', border: '#4ADE80', text: '#1F2937' },
];

const STATUS_COLORS = {
  pending: { bg: '#363640', border: '#5A5A6E', text: '#F0F0F5' },
  in_progress: { bg: 'rgba(0,229,204,0.3)', border: '#00E5CC', text: '#00E5CC' },
  paused: { bg: 'rgba(251,191,36,0.3)', border: '#FBBF24', text: '#FBBF24' },
  done: { bg: 'rgba(52,211,153,0.3)', border: '#34D399', text: '#34D399' },
  overdue: { bg: 'rgba(248,113,113,0.3)', border: '#F87171', text: '#F87171' },
};

const CATEGORY_COLORS: Record<string, string> = {
  work: '#60A5FA',
  personal: '#34D399',
  health: '#F87171',
  learning: '#A855F7',
  finance: '#FBBF24',
  social: '#F472B6',
  other: '#86EFAC',
};

const doTimesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  const [h1, m1] = start1.split(':').map(Number);
  const [h2, m2] = end1.split(':').map(Number);
  const [h3, m3] = start2.split(':').map(Number);
  const [h4, m4] = end2.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2) || isNaN(h3) || isNaN(m3) || isNaN(h4) || isNaN(m4)) return false;
  const start1Min = h1 * 60 + m1;
  const end1Min = h2 * 60 + m2;
  const start2Min = h3 * 60 + m3;
  const end2Min = h4 * 60 + m4;
  return start1Min < end2Min && end1Min > start2Min;
};

const getOverlappingSlotColumns = (slots: { id: string; startTime?: string; endTime?: string; active?: boolean; days?: number[] }[]): { [key: string]: number } => {
  const activeSlots = slots.filter(s => s.active !== false);
  const result: { [key: string]: number } = {};
  activeSlots.forEach((slot) => {
    if (!slot.startTime || !slot.endTime) { result[slot.id] = 0; return; }
    const overlapping = activeSlots.filter((other) => {
      if (other.id === slot.id || !other.startTime || !other.endTime) return false;
      return doTimesOverlap(slot.startTime!, slot.endTime!, other.startTime!, other.endTime!);
    });
    const allOverlapping = [slot.id, ...overlapping.map(o => o.id)].sort();
    result[slot.id] = allOverlapping.indexOf(slot.id);
  });
  return result;
};

const getMaxSlotColumns = (slots: { id: string; startTime?: string; endTime?: string; active?: boolean; days?: number[] }[]): number => {
  const slotColumns = getOverlappingSlotColumns(slots);
  return Math.max(...Object.values(slotColumns), 0) + 1;
};

export const getTaskLayout = (tasks: Task[], task: Task, index: number, hourHeight: number, timer?: { taskId: string; isRunning: boolean; isPaused: boolean; elapsed: number }) => {
  if (!task.startTime || typeof task.startTime !== 'string') return { top: 0, height: hourHeight, left: '0%', width: '100%', colIndex: 0, colorIndex: 0 };
  const [hours, minutes] = task.startTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return { top: 0, height: hourHeight, left: '0%', width: '100%', colIndex: 0, colorIndex: 0 };
  const startMinutes = hours * 60 + minutes;
  const top = (startMinutes / 60) * hourHeight;
  if (isNaN(top) || top < 0) return { top: 0, height: hourHeight, left: '0%', width: '100%', colIndex: 0, colorIndex: 0 };
  let heightMinutes = task.duration && task.duration > 0 ? task.duration / 60 : 60;
  const isTimerForThisTask = timer?.taskId === task.id && (timer.isRunning || timer.isPaused);
  if (isTimerForThisTask && timer.elapsed > 0) {
    heightMinutes = Math.max((task.duration || 60) / 60, timer.elapsed / 60);
  }
  if (isNaN(heightMinutes) || heightMinutes <= 0) heightMinutes = 60;
  const height = (heightMinutes / 60) * hourHeight;
  const endMinutes = startMinutes + heightMinutes;

  // Layout constants
  const TIME_COL = 44;   // time label column width
  const SLOT_COL = 60;   // schedule slots column width
  const GAP = 4;          // gap between slot col and task area
  const TASK_START = TIME_COL + SLOT_COL + GAP; // where tasks begin = 108px

  const allTasksWithTime = tasks.filter(t => t.startTime);
  const overlapping = allTasksWithTime.filter(t => {
    if (t.id === task.id) return false;
    const [h, m] = t.startTime!.split(':').map(Number);
    const tStart = h * 60 + m;
    const tDuration = (t.duration && t.duration > 0) ? t.duration / 60 : 60;
    const tEnd = tStart + tDuration;
    return startMinutes < tEnd && endMinutes > tStart;
  });

  if (overlapping.length > 0) {
    const group = [task, ...overlapping];
    group.sort((a, b) => {
      const [ah, am] = a.startTime!.split(':').map(Number);
      const [bh, bm] = b.startTime!.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });
    const colIndex = group.findIndex(t => t.id === task.id);
    const totalCols = Math.min(group.length, 4);
    const taskWidth = `calc((100% - ${TASK_START}px - 8px) / ${totalCols} - 2px)`;
    const leftPos = `calc(${TASK_START}px + (${colIndex} * (100% - ${TASK_START}px - 8px) / ${totalCols}))`;
    return { top, height, left: leftPos, width: taskWidth, colIndex, colorIndex: index % TASK_COLORS.length };
  }
  return { top, height, left: `${TASK_START}px`, width: `calc(100% - ${TASK_START + 8}px)`, colIndex: 0, colorIndex: index % TASK_COLORS.length };
};

// ── TaskBlock: extracted so useState is called at component top-level, not inside .map() ──
interface TaskBlockProps {
  task: Task;
  idx: number;
  todayTasks: Task[];
  hourHeight: number;
  timer: { taskId: string; isRunning: boolean; isPaused: boolean; elapsed: number };
  isTimerActive: (id: string) => boolean;
  handleStartTimer: (id: string) => void;
  handleCompleteTask: (id: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  setViewTask: (t: Task) => void;
}

function TaskBlock({ task, idx, todayTasks, hourHeight, timer, isTimerActive, handleStartTimer, handleCompleteTask, pauseTimer, resumeTimer, setViewTask }: TaskBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hourlyRate = useSettingsStore(s => s.hourlyRate);

  const layout = getTaskLayout(todayTasks, task, idx, hourHeight, timer);
  const { top, height, left, width, colorIndex } = layout;
  const isActive = isTimerActive(task.id);
  const isDone = task.status === 'done';
  const isPaused = task.status === 'paused';
  const isOverdue = task.status === 'overdue';

  const statusColor = isActive ? STATUS_COLORS.in_progress :
    isPaused ? STATUS_COLORS.paused :
    isDone ? STATUS_COLORS.done :
    isOverdue ? STATUS_COLORS.overdue : STATUS_COLORS.pending;

  const categoryColor = CATEGORY_COLORS[task.category || 'other'];
  const taskColor = TASK_COLORS[colorIndex];
  const activeClass = isActive ? 'animate-pulse' : '';

  const formatMoney = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  const timeCost = useMemo(() => {
    const durationSec = task.duration || 0;
    const currentTimerElapsed = isActive ? timer.elapsed : 0;
    const totalSec = durationSec + currentTimerElapsed;
    return Math.round((totalSec / 3600) * hourlyRate);
  }, [task.duration, isActive, timer.elapsed, hourlyRate]);

  return (
    <div
      className={`absolute rounded-lg border transition-all duration-200 overflow-hidden cursor-pointer ${isActive ? 'shadow-lg ring-2 ring-[var(--accent-primary)] z-20' : 'hover:shadow-md hover:-translate-y-0.5'} ${activeClass}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        minHeight: '50px',
        left,
        width,
        backgroundColor: isActive || isPaused || isDone || isOverdue ? statusColor.bg : taskColor.bg,
        borderColor: isActive || isPaused || isDone || isOverdue ? statusColor.border : taskColor.border,
        transform: isHovered && !isActive ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={() => setViewTask(task)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg"
        style={{ backgroundColor: isDone ? 'var(--success)' : isActive ? 'var(--accent-primary)' : categoryColor }}
      />
      <div className="p-2 pl-4 h-full flex flex-col justify-between overflow-visible">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-semibold flex-1 leading-tight ${isDone ? 'line-through opacity-60' : ''}`} style={{ color: statusColor.text }} title={task.title}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isDone && <span className="text-[10px]" style={{ color: statusColor.text }}>✓</span>}
            {isPaused && <span className="text-[10px]" style={{ color: statusColor.text }}>⏸</span>}
            {isActive && <span className="text-[10px] animate-pulse" style={{ color: statusColor.text }}>▶</span>}
            {isOverdue && <span className="text-[10px]" style={{ color: statusColor.text }}>⚠</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-sans tabular-nums opacity-70" style={{ color: statusColor.text }}>
            {task.startTime}
            {(task.duration || isActive) && ` • ${Math.floor(((task.duration || 0) + (isActive ? timer.elapsed : 0)) / 60)}:${String(((task.duration || 0) + (isActive ? timer.elapsed : 0)) % 60).padStart(2, '0')}`}
          </span>
          {timeCost > 0 && (
            <span className="text-[9px] font-bold" style={{ color: statusColor.text }}>
              • {formatMoney(timeCost)}đ
            </span>
          )}
          {task.reliabilityScore !== undefined && isDone && (
            <span className="text-[9px] flex items-center gap-0.5" style={{ color: statusColor.text }}>
              {task.reliabilityScore >= 80 ? <TrendingUp size={8} /> : <AlertTriangle size={8} />}
              {task.reliabilityScore}%
            </span>
          )}
        </div>
      </div>
      {isHovered && !isDone && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1" onClick={e => e.stopPropagation()}>
          {isActive && timer.isPaused ? (
            <button onClick={() => resumeTimer()} className="size-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors" style={{ color: statusColor.text }}>
              <Play size={10} fill="currentColor" />
            </button>
          ) : isActive && timer.isRunning ? (
            <button onClick={() => pauseTimer()} className="size-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors" style={{ color: statusColor.text }}>
              <Pause size={10} />
            </button>
          ) : (
            <button onClick={() => handleStartTimer(task.id)} className="size-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors" style={{ color: statusColor.text }}>
              <Play size={10} />
            </button>
          )}
          <button onClick={() => handleCompleteTask(task.id)} className="size-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors" style={{ color: statusColor.text }}>
            <Check size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

interface DailySchedule24hProps {
  scrollToNowTrigger?: number;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

export function DailySchedule24h({ scrollToNowTrigger, selectedDate, onDateChange }: DailySchedule24hProps = {}) {
  const tasks = useTaskStore(s => s.tasks) || [];
  const dailyScheduleSlots = useSettingsStore(s => s.dailyScheduleSlots) || [];
  const hourHeight = useSettingsStore(s => s.hourHeight) || DEFAULT_hourHeight;
  const timer = useTaskStore(s => s.timer);
  const startTimer = useTaskStore(s => s.startTimer);
  const pauseTimer = useTaskStore(s => s.pauseTimer);
  const resumeTimer = useTaskStore(s => s.resumeTimer);
  const completeTask = useTaskStore(s => s.completeTask);

  const { recordActualStart, updateTaskReliability } = useScheduleNotifications();

  const handleStartTimer = (taskId: string) => {
    recordActualStart(taskId);
    startTimer(taskId);
  };

  const handleCompleteTask = (taskId: string) => {
    updateTaskReliability(taskId);
    completeTask(taskId);
  };

  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToNow = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const n = new Date();
    const hours = n.getHours();
    const minutes = n.getMinutes();
    const top = ((hours * 60 + minutes) / 60) * hourHeight;
    const scrollTo = Math.max(0, top - 150);
    scrollContainerRef.current.scrollTo({ top: scrollTo, behavior: 'smooth' });
  }, [hourHeight]);

  const now = new Date();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const timeIndicatorTop = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    return ((hours * 60 + minutes) / 60) * hourHeight;
  }, [currentTime, hourHeight]);

  const todayTasks = useMemo(() => {
    const targetDate = selectedDate || new Date();
    const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isToday = targetDateStr === todayStr;

    return tasks.filter(t => {
      if (!t.startTime) return false;
      if (t.startDate) return t.startDate === targetDateStr;
      return isToday;
    });
  }, [tasks, selectedDate]);

  // Scroll to now on mount (today only) and when trigger fires
  useEffect(() => {
    const targetDate = selectedDate || new Date();
    const today = new Date();
    const isToday = targetDate.toDateString() === today.toDateString();
    if (isToday) {
      setTimeout(() => scrollToNow(), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollToNowTrigger !== undefined && scrollToNowTrigger > 0) {
      setTimeout(() => scrollToNow(), 100);
    }
  }, [scrollToNowTrigger, scrollToNow]);

  const isTimerActive = (taskId: string) => {
    return timer.taskId === taskId && (timer.isRunning || timer.isPaused);
  };

  // Compute display date label
  const displayDate = selectedDate || new Date();
  const today = new Date();
  const isToday = displayDate.toDateString() === today.toDateString();
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayLabel = isToday
    ? `Hôm nay • ${String(displayDate.getDate()).padStart(2, '0')}/${String(displayDate.getMonth() + 1).padStart(2, '0')}`
    : `${dayNames[displayDate.getDay()]} ${String(displayDate.getDate()).padStart(2, '0')}/${String(displayDate.getMonth() + 1).padStart(2, '0')}/${displayDate.getFullYear()}`;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Date navigation header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(selectedDate || new Date());
              d.setDate(d.getDate() - 1);
              onDateChange?.(d);
            }}
            className="size-7 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] active:scale-90 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => onDateChange?.(new Date())}
            className="px-2 py-1 rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            {dayLabel}
          </button>
          <button
            onClick={() => {
              const d = new Date(selectedDate || new Date());
              d.setDate(d.getDate() + 1);
              onDateChange?.(d);
            }}
            className="size-7 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] active:scale-90 transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          onClick={scrollToNow}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-bold hover:bg-red-500/20 active:scale-90 transition-all border border-red-500/20"
          title="Nhảy đến thời điểm hiện tại"
        >
          <div className="size-1.5 rounded-full bg-red-500 animate-pulse" />
          Hiện tại
        </button>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-24">
      <div className="relative" style={{ height: `${hourHeight * 24}px` }}>

        {/* Hour grid */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-b z-10"
            style={{
              top: `${h * hourHeight}px`,
              height: `${hourHeight}px`,
              borderColor: 'rgba(255, 255, 255, 0.04)',
              pointerEvents: 'none'
            }}
          >
            {/* Time label - 44px column */}
            <div className="absolute left-0 w-[44px] -top-1.5 pr-1 text-right z-20 bg-[var(--bg-primary)]/95 backdrop-blur-sm">
              <span className="text-[10px] text-[var(--text-secondary)] font-semibold font-sans tabular-nums">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
            {hourHeight >= 60 && [10, 20, 30, 40, 50].map(min => (
              <div
                key={`${h}-${min}`}
                className="absolute left-0 w-[44px] pr-1 text-right z-20"
                style={{ top: `${(min / 60) * hourHeight}px`, pointerEvents: 'none' }}
              >
                <span className="text-[6px] text-[var(--text-muted)]/60 font-sans tabular-nums">
                  {String(h).padStart(2, '0')}:{String(min).padStart(2, '0')}
                </span>
              </div>
            ))}
            {/* Divider line between slot column and task area */}
            <div className="absolute top-0 bottom-0 w-px bg-[var(--border-subtle)]/30" style={{ left: '104px' }} />
            {hourHeight >= 40 && [10, 20, 30, 40, 50].map(min => (
              <div
                key={`${h}-${min}`}
                className="absolute right-0 border-b"
                style={{ left: '108px', top: `${(min / 60) * hourHeight}px`, borderColor: 'rgba(255, 255, 255, 0.02)', pointerEvents: 'none' }}
              />
            ))}
          </div>
        ))}

        {/* 🔴 Current Time Indicator Line */}
        <div
          className="absolute left-0 right-0 z-[45] flex items-center pointer-events-none transition-all duration-1000"
          style={{ top: `${timeIndicatorTop}px` }}
        >
          <div className="absolute left-0 w-[44px] -translate-y-1/2 flex justify-end pr-1.5">
            <span className="text-[10px] font-black text-red-500 bg-[var(--bg-base)] px-1 rounded-sm shadow-[0_0_10px_rgba(239,68,68,0.3)] tabular-nums ring-1 ring-red-500/20">
              {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
            </span>
          </div>
          <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
          <div className="size-3 rounded-full bg-red-500 absolute left-[102px] -translate-y-1/2 shadow-[0_0_15px_rgba(239,68,68,0.8)] border-2 border-white ring-2 ring-red-500/30" />
        </div>

        {/* Daily Schedule Time Slots */}
        {dailyScheduleSlots.map((slot) => {
          if (slot.active === false) return null;
          const currentDay = now.getDay();
          if (slot.days && slot.days.length > 0 && !slot.days.includes(currentDay)) return null;
          if (!slot?.startTime || !slot?.endTime) return null;
          try {
            const [startH, startM] = String(slot.startTime).split(':').map(Number);
            const [endH, endM] = String(slot.endTime).split(':').map(Number);
            if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;
            const top = ((startH * 60 + startM) / 60) * hourHeight;
            const height = (((endH * 60 + endM) - (startH * 60 + startM)) / 60) * hourHeight;
            if (height <= 0) return null;
            const slotColumns = getOverlappingSlotColumns(dailyScheduleSlots);
            const maxCols = getMaxSlotColumns(dailyScheduleSlots);
            const colIdx = slotColumns[slot.id] || 0;
            const timeColWidth = 44;
            const slotColWidth = 60;
            const gap = 4;
            const taskAreaStart = timeColWidth + slotColWidth + gap;
            const slotLeftPos = colIdx === 0
              ? `${timeColWidth + gap}px`
              : `calc(${timeColWidth + gap}px + ${colIdx * (slotColWidth / maxCols)}px)`;
            const slotWidth = maxCols === 1
              ? `${slotColWidth}px`
              : `calc(${slotColWidth / maxCols}px - 4px)`;
            return (
              <div
                key={slot.id}
                className="absolute rounded-lg border-l-4 overflow-hidden backdrop-blur-sm z-5"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left: slotLeftPos,
                  width: slotWidth,
                  backgroundColor: slot.color,
                  borderColor: slot.color?.replace('0.15', '0.6').replace('26', '60'),
                }}
              >
                <span className="text-[9px] text-[var(--text-secondary)] px-2 py-1 font-medium break-words block">
                  {slot.icon && <span className="mr-1">{slot.icon}</span>}
                  {slot.name}
                </span>
              </div>
            );
          } catch (e) {
            return null;
          }
        })}

        {/* Tasks - each rendered as a proper component so useState is not called inside .map() */}
        {todayTasks.map((task, idx) => (
          <TaskBlock
            key={task.id}
            task={task}
            idx={idx}
            todayTasks={todayTasks}
            hourHeight={hourHeight}
            timer={timer}
            isTimerActive={isTimerActive}
            handleStartTimer={handleStartTimer}
            handleCompleteTask={handleCompleteTask}
            pauseTimer={pauseTimer}
            resumeTimer={resumeTimer}
            setViewTask={setViewTask}
          />
        ))}
      </div>

      {/* Empty state */}
      {todayTasks.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <div className="size-20 rounded-full bg-[var(--bg-surface)] flex items-center justify-center mb-4">
            <Clock size={32} className="text-[var(--text-muted)] opacity-40" />
          </div>
          <p className="text-sm text-[var(--text-muted)] font-medium">Chưa có việc nào được lên lịch</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Thêm việc từ MẪU với thời điểm bắt đầu</p>
        </div>
      )}

        {viewTask && <TaskViewModal task={viewTask} onClose={() => setViewTask(null)} onEdit={() => { setEditTask(viewTask); setViewTask(null); }} />}
        {editTask && <TaskEditModal task={editTask} onClose={() => setEditTask(null)} />}
      </div>
    </div>
  );
}
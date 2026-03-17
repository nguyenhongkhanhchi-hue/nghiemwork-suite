import { useState, useEffect, useRef } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { useTickSound } from '@/hooks/useTickSound';
import { useVietnameseVoice } from '@/hooks/useVietnameseVoice';
import { playChime, getEncouragement } from '@/lib/soundEffects';
import { Pause, Play, Square, Clock, Check, X, Volume2, VolumeX } from 'lucide-react';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakeLock';

export function TaskTimer() {
  const timer = useTaskStore(s => s.timer);
  const tasks = useTaskStore(s => s.tasks);
  const tickTimer = useTaskStore(s => s.tickTimer);
  const stopTimer = useTaskStore(s => s.stopTimer);
  const pauseTimer = useTaskStore(s => s.pauseTimer);
  const resumeTimer = useTaskStore(s => s.resumeTimer);
  const completeTaskFn = useTaskStore(s => s.completeTask);
  const tickSoundEnabled = useSettingsStore(s => s.tickSoundEnabled);
  const voiceEnabled = useSettingsStore(s => s.voiceEnabled);
  const voiceSettings = useSettingsStore(s => s.voiceSettings);
  const { playTick } = useTickSound();
  const { speak, announceTime } = useVietnameseVoice();
  const lastAnnounced = useRef(0);
  const lastEncourage = useRef(0);

  const [timerSoundOn, setTimerSoundOn] = useState(true);
  // After stop: show confirm "Đã hoàn thành chưa?" 
  const [pendingCompleteTaskId, setPendingCompleteTaskId] = useState<string | null>(null);
  const [pendingTaskTitle, setPendingTaskTitle] = useState<string>('');

  const currentTask = tasks.find(t => t.id === timer.taskId);
  const chimeInterval = voiceSettings.chimeInterval || 30;
  const timerSoundEnabled = timerSoundOn && tickSoundEnabled;
  const timerVoiceEnabled = timerSoundOn && voiceEnabled;
  const timerChimeEnabled = timerSoundOn;

  useEffect(() => {
    if (timer.isRunning) { requestWakeLock(); } else { releaseWakeLock(); }
    return () => { releaseWakeLock(); };
  }, [timer.isRunning]);

  useEffect(() => {
    if (!timer.isRunning || timer.isPaused) return;
    const i = setInterval(() => tickTimer(), 1000);
    return () => clearInterval(i);
  }, [timer.isRunning, timer.isPaused]);

  useEffect(() => {
    if (!timer.isRunning || timer.isPaused || !timerSoundEnabled) return;
    const i = setInterval(() => playTick(), 1000);
    return () => clearInterval(i);
  }, [timer.isRunning, timer.isPaused, timerSoundEnabled]);

  useEffect(() => {
    if (!timer.isRunning || timer.isPaused || timer.elapsed === 0) return;
    if (timer.elapsed % chimeInterval === 0 && timer.elapsed !== lastAnnounced.current) {
      const timeSinceEncourage = timer.elapsed - lastEncourage.current;
      if (timeSinceEncourage > 5) {
        lastAnnounced.current = timer.elapsed;
        if (timerChimeEnabled) playChime();
        if (timerVoiceEnabled) setTimeout(() => announceTime(timer.elapsed), 600);
      }
    }
    const nextEncouragementInterval = 120 + Math.floor(Math.random() * 60);
    if (timer.elapsed - lastEncourage.current >= nextEncouragementInterval) {
      const timeSinceAnnounce = timer.elapsed - lastAnnounced.current;
      if (timeSinceAnnounce > 3 && timerVoiceEnabled && currentTask) {
        lastEncourage.current = timer.elapsed;
        const encouragements = voiceSettings.encouragements?.length > 0 ? voiceSettings.encouragements : [getEncouragement()];
        const msg = encouragements[Math.floor(Math.random() * encouragements.length)];
        const taskInfo = currentTask.deadline ? `Hạn chót ${new Date(currentTask.deadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.` : '';
        const notesInfo = currentTask.notes ? `Lưu ý: ${currentTask.notes.slice(0, 50)}.` : '';
        setTimeout(() => speak(`Đang làm "${currentTask.title}". ${taskInfo} ${notesInfo} ${msg}`), 800);
      }
    }
  }, [timer.elapsed, timer.isRunning, timer.isPaused, voiceEnabled, currentTask, chimeInterval]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStop = () => {
    const taskId = timer.taskId;
    const task = tasks.find(t => t.id === taskId);
    if (taskId && task) {
      setPendingCompleteTaskId(taskId);
      setPendingTaskTitle(task.title);
    }
    stopTimer(); // saves elapsed time, sets task to 'paused'
  };

  const handleConfirmComplete = () => {
    if (pendingCompleteTaskId) {
      completeTaskFn(pendingCompleteTaskId);
    }
    setPendingCompleteTaskId(null);
    setPendingTaskTitle('');
  };

  const handleConfirmNotDone = () => {
    setPendingCompleteTaskId(null);
    setPendingTaskTitle('');
  };

  // Show confirmation UI after stop
  if (pendingCompleteTaskId) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[80] glass-strong border-b border-[var(--border-subtle)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 px-4 py-2 w-full">
          <div className="size-7 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
            <Clock size={13} className="text-[var(--text-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{pendingTaskTitle}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Đã hoàn thành việc này chưa?</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleConfirmNotDone}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[rgba(248,113,113,0.15)] text-[var(--error)] text-xs font-bold hover:bg-[rgba(248,113,113,0.25)] active:scale-95 transition-all"
            >
              <X size={12} />
              Chưa
            </button>
            <button
              onClick={handleConfirmComplete}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[rgba(52,211,153,0.15)] text-[var(--success)] text-xs font-bold hover:bg-[rgba(52,211,153,0.25)] active:scale-95 transition-all"
            >
              <Check size={12} strokeWidth={3} />
              Hoàn thành
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((!timer.isRunning && !timer.isPaused) || !currentTask) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[80] glass-strong border-b ${timer.isPaused ? 'border-[var(--warning)]' : 'border-[var(--border-accent)]'}`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-3 px-4 py-2 w-full">
        <Clock size={14} className={timer.isPaused ? 'text-[var(--warning)]' : 'text-[var(--accent-primary)]'} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{currentTask.title}</p>
          {currentTask.duration && currentTask.duration > 0 && (
            <p className="text-[9px] text-[var(--text-muted)] font-mono">Tổng: {formatTime(currentTask.duration + timer.elapsed)}</p>
          )}
        </div>
        <div className={`font-mono text-lg font-bold tabular-nums ${timer.isPaused ? 'text-[var(--warning)]' : 'text-[var(--accent-primary)] animate-timer-pulse'}`}>
          {formatTime(timer.elapsed)}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTimerSoundOn(!timerSoundOn)}
            className={`size-9 rounded-xl flex items-center justify-center ${timerSoundOn ? 'bg-[rgba(168,85,247,0.15)] text-[var(--accent-primary)]' : 'bg-[rgba(100,100,100,0.2)] text-[var(--text-muted)]'}`}
            title={timerSoundOn ? 'Tắt âm thanh timer' : 'Bật âm thanh timer'}
          >
            {timerSoundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => timer.isPaused ? resumeTimer() : pauseTimer()}
            className={`size-9 rounded-xl flex items-center justify-center ${timer.isPaused ? 'bg-[rgba(0,229,204,0.2)] text-[var(--accent-primary)]' : 'bg-[rgba(251,191,36,0.2)] text-[var(--warning)]'}`}
          >
            {timer.isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            onClick={handleStop}
            className="size-9 rounded-xl bg-[rgba(248,113,113,0.15)] flex items-center justify-center text-[var(--error)]"
            title="Kết thúc"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}

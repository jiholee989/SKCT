import { useState, useEffect, useRef } from "react";
import { AREAS, LG_AREAS } from "../areas";

const FIFTEEN_MINUTES = 15 * 60;
const MOCK_SECTION_SECONDS = 15 * 60;
const MOCK_BREAK_SECONDS = 60;

// exam segment, break segment, exam segment, break segment, ... (no trailing break)
const makeExamSegments = (areas) => areas.flatMap((area, i) => {
  const segs = [{ type: "exam", label: area.name, duration: MOCK_SECTION_SECONDS, range: { start: area.start, end: area.end } }];
  if (i < areas.length - 1) segs.push({ type: "break", label: "쉬는 시간", duration: MOCK_BREAK_SECONDS, range: null });
  return segs;
});
const MOCK_SEGMENTS = makeExamSegments(AREAS);
const LG_SEGMENTS = makeExamSegments(LG_AREAS);

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}분 ${String(s).padStart(2, "0")}초`;
}

export default function Timer({ onActiveRangeChange, onModeChange, onPracticeAreaChange }) {
  const [mode, setMode] = useState("mockExam");
  const [practiceAreaIndex, setPracticeAreaIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef(null);
  const elapsedBeforeStart = useRef(0);
  const examMode = mode === "mockExam" || mode === "lgExam";
  const examSegments = mode === "lgExam" ? LG_SEGMENTS : MOCK_SEGMENTS;
  const [exam, setExam] = useState({ index: 0, remaining: MOCK_SEGMENTS[0].duration, finished: false });

  useEffect(() => {
    if (!running) return;
    if (mode === "stopwatch") {
      const id = setInterval(() => {
        setElapsed(Math.floor((elapsedBeforeStart.current + performance.now() - startedAt.current) / 1000));
      }, 200);
      return () => clearInterval(id);
    }
    const id = setInterval(() => {
      if (examMode) {
        setExam((prev) => {
          if (prev.finished) return prev;
          if (prev.remaining > 1) return { ...prev, remaining: prev.remaining - 1 };
          const nextIndex = prev.index + 1;
          return nextIndex < examSegments.length
            ? { index: nextIndex, remaining: examSegments[nextIndex].duration, finished: false }
            : { ...prev, remaining: 0, finished: true };
        });
      } else {
        setElapsed((e) => e + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode, examMode, examSegments]);

  useEffect(() => {
    if (exam.finished) setRunning(false);
  }, [exam.finished]);

  // Stop the 15-minute countdown when time runs out.
  useEffect(() => {
    if (mode === "fifteen" && elapsed >= FIFTEEN_MINUTES && running) setRunning(false);
  }, [elapsed, mode, running]);

  useEffect(() => {
    if (mode === "fifteen" || mode === "stopwatch") {
      const area = AREAS[practiceAreaIndex];
      onActiveRangeChange?.({ start: area.start, end: area.end });
    } else if (exam.finished) {
      onActiveRangeChange?.({ start: 1, end: 0 }); // lock all after exam ends
    } else {
      const seg = examSegments[exam.index];
      onActiveRangeChange?.(seg.range ?? { start: 1, end: 0 }); // 쉬는 시간: 전부 잠금
    }
  }, [mode, exam.index, exam.finished, examSegments, practiceAreaIndex, onActiveRangeChange]);

  const timeFinished = mode === "fifteen" && elapsed >= FIFTEEN_MINUTES;

  const toggleRun = () => {
    if (examMode && exam.finished) return;
    if (timeFinished) return;
    if (mode === "stopwatch") {
      if (running) {
        elapsedBeforeStart.current += performance.now() - startedAt.current;
        startedAt.current = null;
        setElapsed(Math.floor(elapsedBeforeStart.current / 1000));
      } else {
        startedAt.current = performance.now();
      }
    }
    setRunning((r) => !r);
  };

  const reset = () => {
    setRunning(false);
    startedAt.current = null;
    elapsedBeforeStart.current = 0;
    if (examMode) setExam({ index: 0, remaining: examSegments[0].duration, finished: false });
    else setElapsed(0);
  };

  const selectMode = (value) => {
    setRunning(false);
    startedAt.current = null;
    elapsedBeforeStart.current = 0;
    setElapsed(0);
    const isExam = value === "mockExam" || value === "lgExam";
    setMode(value);
    onModeChange?.(value);
    if (isExam) {
      setExam({ index: 0, remaining: (value === "lgExam" ? LG_SEGMENTS : MOCK_SEGMENTS)[0].duration, finished: false });
    }
  };

  const currentSegment = examSegments[exam.index];

  const selectPracticeArea = (value) => {
    const index = Number(value);
    setRunning(false);
    startedAt.current = null;
    elapsedBeforeStart.current = 0;
    setElapsed(0);
    setPracticeAreaIndex(index);
    onPracticeAreaChange?.(index);
  };

  return (
    <div className="timer" onKeyDown={(e) => e.stopPropagation()}>
      <div className="timer-controls">
        <div className="timer-mode-row">
          <select className="time-select" value={mode} onChange={(e) => selectMode(e.target.value)}>
            <option value="fifteen">15분</option>
            <option value="stopwatch">스톱워치</option>
            <option value="mockExam">모의고사 모드</option>
            <option value="lgExam">LG 모의고사 모드</option>
          </select>
          {!examMode && (
            <select className="time-select" aria-label="영역 선택" value={practiceAreaIndex} onChange={(e) => selectPracticeArea(e.target.value)}>
              {AREAS.map((area, index) => <option key={area.name} value={index}>{area.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {examMode ? (
        <div className="timer-display exam-flash" key={exam.index}>
          {exam.finished ? (
            <span className="current-time">모의고사 종료</span>
          ) : (
            <>
              <span className="current-time">{formatTime(exam.remaining)}</span>
              <span className={`total-time section-label ${currentSegment.type}`}>{currentSegment.label}</span>
            </>
          )}
        </div>
      ) : mode === "stopwatch" ? (
        <div className="timer-display">
          <span className="current-time">{formatTime(elapsed)}</span>
        </div>
      ) : (
        <div className="timer-display">
          {timeFinished ? (
            <span className="current-time">시간 종료</span>
          ) : (
            <>
              <span className="current-time">{formatTime(FIFTEEN_MINUTES - elapsed)}</span>
              <span className="total-time">/ {formatTime(FIFTEEN_MINUTES)}</span>
            </>
          )}
        </div>
      )}

      <div className="timer-buttons">
        <button
          className={`timer-btn ${running ? "stop-btn" : "start-btn"}`}
          onClick={toggleRun}
          disabled={timeFinished || (examMode && exam.finished)}
        >
          {running ? "정지" : "시작"}
        </button>
        <button className="timer-btn reset-btn" onClick={reset}>리셋</button>
      </div>
    </div>
  );
}

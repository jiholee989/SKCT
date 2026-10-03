import { useState, useRef, useEffect } from "react";
import Tutorial from "./components/Tutorial";
import PDFViewer from "./components/PDFViewer";
import OMRSheet from "./components/OMRSheet";
import Timer from "./components/Timer";
import NotePad from "./components/NotePad";
import Calculator from "./components/Calculator";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { AREAS } from "./areas";
import "./App.css";

export default function App() {
  const tutorialRef = useRef();
  const [gradingMode, setGradingMode] = useState(false);
  const [activeRange, setActiveRange] = useState(null);
  const [timerMode, setTimerMode] = useState("mockExam");
  const [fifteenAreaIndex, setFifteenAreaIndex] = useState(0);
  const [records, setRecords] = useLocalStorage("skct-exam-records", []);
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 768px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Re-grading the same attempt (e.g. after fixing a typo in the key) replaces
  // its row instead of adding a new one, keeping any label the user edited.
  const saveRecord = (record) =>
    setRecords((prev) =>
      prev.some((r) => r.id === record.id)
        ? prev.map((r) => (r.id === record.id ? { ...record, label: r.label } : r))
        : [record, ...prev]
    );

  return (
    <>
      <Tutorial ref={tutorialRef} records={records} setRecords={setRecords} />
      <div className={`app ${narrow ? "narrow-screen" : ""}`}>
        <button className="help-btn" onClick={() => tutorialRef.current?.open()} title="학습 기록 / 사용 설명서">❗</button>

        <div className="middle-panel">
          <PDFViewer />
        </div>

        <div className="omr-container">
          <div className={`omr-panel ${gradingMode ? "grading-mode" : ""}`}>
            <OMRSheet onGradingToggle={setGradingMode} activeRange={activeRange} gradingArea={timerMode === "fifteen" ? AREAS[fifteenAreaIndex] : null} examMode={timerMode === "mockExam"} onRecord={saveRecord} />
          </div>
        </div>

        <div className={`right-panel ${narrow ? "expanded" : ""}`}>
          <div className="timer-section">
            <Timer onActiveRangeChange={setActiveRange} onModeChange={setTimerMode} onFifteenAreaChange={setFifteenAreaIndex} />
          </div>
          <div className="notepad-section">
            <NotePad />
          </div>
          <div className="calculator-section">
            <Calculator />
          </div>
        </div>
      </div>
    </>
  );
}

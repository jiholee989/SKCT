import { useState, useEffect, useRef } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AREAS } from "../areas";

const QUESTION_COUNT = 100;
const CHOICES = [1, 2, 3, 4, 5];
const QUESTION_NUMBERS = Array.from({ length: QUESTION_COUNT }, (_, i) => i + 1);
const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "correct", label: "정답" },
  { key: "wrong", label: "오답" },
  { key: "unanswered", label: "미답" },
];

// Buckets items (each with a `.num`) into one array per AREA, in AREA order.
function groupByArea(items, getNum = (item) => item.num) {
  return AREAS.map((area) => ({
    area,
    items: items.filter((item) => {
      const num = getNum(item);
      return num >= area.start && num <= area.end;
    }),
  }));
}

export default function OMRSheet({ onGradingToggle, activeRange, gradingArea, examMode, onRecord }) {
  const recordIdRef = useRef(null); // current attempt's row in the 학습 기록 table
  const lastCapturedRef = useRef(null); // memo+canvas last copied into a question
  const [answers, setAnswers] = useLocalStorage("skct-omr-answers", {});
  const [gradingInput, setGradingInput] = useState("");
  const [gradingResult, setGradingResult] = useState(null);
  const [gradingMode, setGradingMode] = useState(false);
  const [questionStatuses, setQuestionStatuses] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [summaryAreaIndex, setSummaryAreaIndex] = useState(0);
  const [snapshots, setSnapshots] = useLocalStorage("skct-question-snapshots", {});
  const [viewingSnapshot, setViewingSnapshot] = useState(null);

  useEffect(() => {
    onGradingToggle?.(gradingMode);
  }, [gradingMode, onGradingToggle]);

  useEffect(() => {
    setGradingInput("");
    setGradingResult(null);
    setQuestionStatuses([]);
    if (gradingArea) setSummaryAreaIndex(AREAS.indexOf(gradingArea));
  }, [gradingArea]);

  // NotePad already keeps its live content in localStorage - copy whatever's
  // there right now into this question's slot instead of lifting shared state.
  const captureSnapshot = (questionNum) => {
    let memo = "";
    try {
      const raw = localStorage.getItem("skct-notepad-memo");
      memo = raw ? JSON.parse(raw) : "";
    } catch {
      // ignore malformed storage
    }
    const canvas = localStorage.getItem("skct-notepad-canvas");
    if (!memo && !canvas) return;
    // Only copy again once the memo/drawing has changed - otherwise the same
    // notes would get attached to every question marked afterwards.
    const signature = `${memo}\u0000${canvas ?? ""}`;
    if (signature === lastCapturedRef.current) return;
    lastCapturedRef.current = signature;
    setSnapshots((prev) => ({ ...prev, [questionNum]: { memo, canvas } }));
  };

  const selectAnswer = (questionNum, choice) => {
    setAnswers((prev) => {
      if (prev[questionNum] === choice) {
        const next = { ...prev };
        delete next[questionNum];
        return next;
      }
      return { ...prev, [questionNum]: choice };
    });
    setGradingResult(null);
    captureSnapshot(questionNum);
  };

  const submitGrading = () => {
    if (!gradingInput.trim()) {
      alert("정답을 입력해주세요!");
      return;
    }
    const key = gradingInput
      .split(/[,\s]+/)
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v) && v >= 1 && v <= 5);
    if (key.length === 0) {
      alert("올바른 정답 형식이 아닙니다. 예: 1,2,3,4,5 또는 1 2 3 4 5");
      return;
    }
    if (gradingArea && key.length !== 20) {
      alert(`${gradingArea.name} 영역의 정답 20개를 입력해주세요.`);
      return;
    }
    let correct = 0;
    const statuses = key.map((correctAnswer, idx) => {
      const num = (gradingArea?.start ?? 1) + idx;
      const userAnswer = answers[num];
      let status;
      if (userAnswer === undefined) status = "unanswered";
      else if (userAnswer === correctAnswer) {
        status = "correct";
        correct++;
      } else status = "wrong";
      return { num, status, userAnswer: userAnswer ?? null, correctAnswer };
    });
    setQuestionStatuses(statuses);
    setStatusFilter("all");
    setGradingResult({ correct, wrong: statuses.filter((q) => q.status === "wrong").length, total: key.length });
    if (examMode) {
      recordIdRef.current ??= Date.now();
      onRecord?.({
        id: recordIdRef.current,
        label: new Date().toLocaleString("ko-KR"),
        scores: groupByArea(statuses).map(({ items }) => ({
          correct: items.filter((q) => q.status === "correct").length,
          total: items.length,
        })),
        correct,
        total: key.length,
      });
    }
  };

  const clearAll = () => {
    if (window.confirm("모든 답안을 지우시겠습니까?")) {
      setAnswers({});
      recordIdRef.current = null; // next grading starts a new record
      setGradingResult(null);
      setQuestionStatuses([]);
    }
  };

  const clearGradingInput = () => {
    setGradingInput("");
    setGradingResult(null);
    setQuestionStatuses([]);
  };

  const filterGradingKeydown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      return;
    }
    if (!/^[0-9]$/.test(e.key) && e.key !== "," && e.key !== " " && e.key !== "Backspace" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
      e.preventDefault();
    }
    e.stopPropagation();
  };

  // Every area displays its own questions as 1~20; the underlying number
  // (answers/snapshots/grading key) stays global.
  const toLocalNum = (globalNum, area) => globalNum - area.start + 1;

  const summaryArea = AREAS[summaryAreaIndex];
  const summaryQuestions = questionStatuses.filter((q) => q.num >= summaryArea.start && q.num <= summaryArea.end);
  const resultNumbers = (status) => summaryQuestions
    .filter((q) => q.status === status)
    .map((q) => toLocalNum(q.num, summaryArea))
    .join(", ") || "없음";

  const renderResultItem = (q, label = q.num) => (
    <div className={`question-result-item ${q.status}`} key={q.num} onClick={() => setViewingSnapshot(q.num)}>
      <span className="question-number">{label}번</span>
      {q.status === "unanswered" ? (
        <span className="result-label">미답 (정답 {q.correctAnswer})</span>
      ) : (
        <span className="result-label">
          내 답 {q.userAnswer}{q.status === "wrong" ? ` → 정답 ${q.correctAnswer}` : " (정답)"}
        </span>
      )}
    </div>
  );

  const renderRow = (num, label = num) => {
    const inactive = activeRange && (num < activeRange.start || num > activeRange.end);
    return (
      <div className={`omr-row ${inactive ? "inactive" : ""}`} key={num}>
        <div className="question-number" onClick={() => setViewingSnapshot(num)}>{label}</div>
        <div className="choices">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              className={`choice-btn ${answers[num] === choice ? "selected" : ""}`}
              onClick={() => selectAnswer(num, choice)}
              disabled={inactive}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="omr-sheet">
      <div className="omr-header">
        <div className="omr-header-top">
          <h2>OMR 답안지</h2>
        </div>
        <div className="omr-actions">
          <button className="grade-btn" onClick={() => setGradingMode((m) => !m)}>
            {gradingMode ? "답안지 보기" : "채점하기"}
          </button>
          <button className="clear-all-btn" onClick={clearAll}>답안 초기화</button>
        </div>
        {activeRange && (
          <p className="active-range-notice">
            {activeRange.start > activeRange.end
              ? "쉬는 시간입니다. 마킹이 잠시 잠깁니다."
              : `현재 영역: ${AREAS.find((a) => a.start === activeRange.start && a.end === activeRange.end)?.name ?? `${activeRange.start}~${activeRange.end}번`}`}
          </p>
        )}
      </div>

      {gradingMode ? (
        <div className="grading-section">
          <div className="grading-input">
            <h3>정답 입력</h3>
            <p className="help-text">{gradingArea ? `${gradingArea.name} 1~20번 정답을 입력하세요 (쉼표 또는 공백으로 구분)` : "정답을 숫자로 입력하세요 (쉼표 또는 공백으로 구분)"}</p>
            <p className="help-text-example">예: 1,2,3,4,5 또는 1 2 3 4 5</p>
            <textarea
              value={gradingInput}
              onChange={(e) => setGradingInput(e.target.value)}
              onKeyDown={filterGradingKeydown}
              placeholder="1,2,3,4,5,1,2,3,4,5,..."
              className="answer-input"
              rows={6}
            />
            <div className="grading-buttons">
              <button className="submit-grade-btn" onClick={submitGrading}>채점하기</button>
              <button className="clear-grade-btn" onClick={clearGradingInput}>입력 지우기</button>
            </div>
          </div>

          {gradingResult && (
            <div className="score-result">
              <h3>채점 결과</h3>
              <div className="score-display">
                <div className="score-counts">
                  <span className="score-item">정답: {gradingResult.correct}개</span>
                  <span className="score-item">오답: {gradingResult.wrong}개</span>
                  <span className="score-item">총 문항: {gradingResult.total}개</span>
                </div>
              </div>
              {questionStatuses.length > 0 && (
                <div className="area-score-breakdown">
                  {groupByArea(questionStatuses).map(({ area, items }) => {
                    const correct = items.filter((q) => q.status === "correct").length;
                    const wrong = items.filter((q) => q.status === "wrong").length;
                    const unanswered = items.filter((q) => q.status === "unanswered").length;
                    return (
                      <div key={area.name} className="area-score-row">
                        <span className="area-score-name">{area.name}</span>
                        <span className="area-score-stat correct">정답 {correct}</span>
                        <span className="area-score-stat wrong">오답 {wrong}</span>
                        <span className="area-score-stat unanswered">미답 {unanswered}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="result-number-summary">
                <h4>영역별 오답·미답 번호</h4>
                <div className="summary-area-buttons" role="group" aria-label="오답·미답 번호 영역 선택">
                  {AREAS.map((area, index) => (
                    <button key={area.name} type="button" aria-pressed={summaryAreaIndex === index}
                      className={summaryAreaIndex === index ? "active" : ""}
                      onClick={() => setSummaryAreaIndex(index)}>{area.name}</button>
                  ))}
                </div>
                <div aria-live="polite">
                  {summaryQuestions.length > 0 ? (
                    <>
                      <p className="result-number-line"><strong>오답#:</strong> {resultNumbers("wrong")}</p>
                      <p className="result-number-line"><strong>미응답#:</strong> {resultNumbers("unanswered")}</p>
                    </>
                  ) : <p className="result-number-line">이 영역에는 채점한 문항이 없습니다.</p>}
                </div>
              </div>
              {questionStatuses.length > 0 && (
                <div className="question-results">
                  <div className="question-results-header">
                    <h4>전체 문항 결과</h4>
                    <div className="status-filter">
                      {STATUS_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          className={statusFilter === f.key ? "active" : ""}
                          onClick={() => setStatusFilter(f.key)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="question-results-list">
                    {(() => {
                      const filtered = questionStatuses.filter((q) => statusFilter === "all" || q.status === statusFilter);
                      return groupByArea(filtered)
                        .filter((g) => g.items.length > 0)
                        .map((g) => (
                          <div className="omr-area" key={g.area.name}>
                            <h4 className="omr-area-title">{g.area.name}</h4>
                            {g.items.map((q) => renderResultItem(q, toLocalNum(q.num, g.area)))}
                          </div>
                        ));
                    })()}
                  </div>
                  <button className="export-pdf-btn" onClick={() => window.print()} title="인쇄 대화상자에서 'PDF로 저장'을 선택하세요">
                    오답노트 PDF로 저장
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="omr-content">
          {(gradingArea ? [gradingArea] : AREAS).map((area) => (
            <div className="omr-area" key={area.name}>
              <h3 className="omr-area-title">{area.name}</h3>
              <div className="omr-grid">
                {QUESTION_NUMBERS.slice(area.start - 1, area.end).map((num) => renderRow(num, toLocalNum(num, area)))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="omr-footer">
        <div className="answer-count">표시한 답안: {gradingArea
          ? QUESTION_NUMBERS.slice(gradingArea.start - 1, gradingArea.end).filter((num) => answers[num] !== undefined).length
          : Object.keys(answers).length} / {gradingArea ? 20 : QUESTION_COUNT}</div>
      </div>

      {/* Hidden in normal view; @media print swaps this in place of the whole app (see App.css). */}
      <div className="print-only wrong-answer-note">
        <h1>오답노트</h1>
        <section>
          <h2>못 푼 문제</h2>
          {groupByArea(questionStatuses.filter((q) => q.status === "unanswered")).map((g) => (
            <p key={g.area.name}>
              <strong>{g.area.name}:</strong> {g.items.length > 0 ? g.items.map((q) => toLocalNum(q.num, g.area)).join(", ") : "없음"}
            </p>
          ))}
        </section>
        <section>
          <h2>틀린 문제</h2>
          {groupByArea(questionStatuses.filter((q) => q.status === "wrong")).map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.area.name} className="print-area-block">
                <h3 className="print-area-title">{g.area.name}</h3>
                {g.items.map((w) => {
                  const snap = snapshots[w.num];
                  return (
                    <div className="print-question-block" key={w.num}>
                      <h3>{toLocalNum(w.num, g.area)}번 - 내 답 {w.userAnswer ?? "미답"} → 정답 {w.correctAnswer}</h3>
                      <div className="print-memo">
                        <strong>메모</strong>
                        <p>{snap?.memo || "(메모 없음)"}</p>
                      </div>
                      {snap?.canvas && (
                        <div className="print-drawing">
                          <strong>그림판</strong>
                          <img src={snap.canvas} alt={`${w.num}번 그림`} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
          {questionStatuses.filter((q) => q.status === "wrong").length === 0 && <p>없음</p>}
        </section>
      </div>

      {viewingSnapshot !== null && (
        <div className="snapshot-overlay" onClick={() => setViewingSnapshot(null)}>
          <div className="snapshot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="snapshot-header">
              <h3>
                {(() => {
                  const area = AREAS.find((a) => viewingSnapshot >= a.start && viewingSnapshot <= a.end);
                  return area ? `${area.name} ${toLocalNum(viewingSnapshot, area)}번` : `${viewingSnapshot}번`;
                })()} 문제 메모
              </h3>
              <button className="close-btn" onClick={() => setViewingSnapshot(null)}>✕</button>
            </div>
            <div className="snapshot-body">
              {snapshots[viewingSnapshot] ? (
                <>
                  <div className="snapshot-memo">
                    <h4>메모</h4>
                    <p>{snapshots[viewingSnapshot].memo || "(메모 없음)"}</p>
                  </div>
                  <div className="snapshot-drawing">
                    <h4>그림판</h4>
                    {snapshots[viewingSnapshot].canvas ? (
                      <img src={snapshots[viewingSnapshot].canvas} alt={`${viewingSnapshot}번 그림`} />
                    ) : (
                      <p>(그림 없음)</p>
                    )}
                  </div>
                </>
              ) : (
                <p>이 문제를 풀 때 저장된 메모/그림이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

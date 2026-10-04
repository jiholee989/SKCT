import { forwardRef, useState, useImperativeHandle } from "react";
import { AREA_NAMES } from "../areas";

const Tutorial = forwardRef(({ records, setRecords }, ref) => {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(null); // { id, label } while a label is being edited

  useImperativeHandle(ref, () => ({ open: () => setVisible(true) }));

  const dismiss = () => {
    setVisible(false);
    setEditing(null);
  };

  const saveLabel = () => {
    if (!editing) return;
    const label = editing.label.trim();
    if (label) setRecords((prev) => prev.map((r) => (r.id === editing.id ? { ...r, label } : r)));
    setEditing(null);
  };

  const deleteRecord = (id) => {
    if (window.confirm("이 기록을 삭제할까요?")) setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  if (!visible) return null;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        <div className="tutorial-header">
          <h2>학습 기록 & 사용 설명서</h2>
          <button className="close-btn" onClick={dismiss}>✕</button>
        </div>
        <div className="tutorial-content">
          <h3 className="record-title">📊 학습 기록</h3>
          {records.length === 0 ? (
            <p className="record-empty">모의고사 모드로 채점하면 여기에 기록됩니다.</p>
          ) : (
            <div className="record-table-wrap">
              <table className="record-table">
                <thead>
                  <tr>
                    {AREA_NAMES.map((name) => <th key={name}>{name}</th>)}
                    <th>총점</th>
                    <th>응시 일시</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      {r.scores.map((s, i) => <td key={i}>{s.total ? `${s.correct}/${s.total}` : "-"}</td>)}
                      <td className="record-total">{r.correct}/{r.total}</td>
                      <td className="record-label">
                        {editing?.id === r.id ? (
                          <input
                            autoFocus
                            value={editing.label}
                            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                            onBlur={saveLabel}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") saveLabel();
                              else if (e.key === "Escape") setEditing(null);
                            }}
                          />
                        ) : (
                          <>
                            {r.label}
                            <button className="record-icon-btn" onClick={() => setEditing({ id: r.id, label: r.label })} title="이름 수정">✏️</button>
                          </>
                        )}
                      </td>
                      <td>
                        <button className="record-icon-btn" onClick={() => deleteRecord(r.id)} title="기록 삭제">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="record-title">📖 사용 설명서</h3>
          <div className="tutorial-section">
            <div className="section-icon">📄</div>
            <h3>PDF 문제 업로드</h3>
            <p>"PDF 업로드" 버튼으로 문제 PDF를 올리세요. 페이지는 세로로 이어서 스크롤되고, -/+ 버튼이나 슬라이더로 확대/축소할 수 있습니다. ‹ › 버튼 또는 키보드 방향키로 페이지를 넘길 수 있습니다.</p>
          </div>
          <div className="tutorial-section">
            <div className="section-icon">⏱️</div>
            <h3>타이머 / 모의고사 모드</h3>
            <p>기본 "모의고사 모드"는 언어이해·자료해석·창의수리·언어추리·수열추리 5개 영역을 각 15분씩 진행합니다. "LG 모의고사 모드"는 언어이해 → 언어추리 → 자료해석 → 창의수리 순서로 4개 영역을 진행하며, 채점 정답도 이 순서로 80개 입력합니다. 두 모드 모두 영역 사이에 1분 휴식이 있고, 진행 중인 영역만 OMR에 마킹할 수 있습니다. 15분 모드와 스톱워치에서는 원하는 영역의 OMR 20문항만 표시되고, 채점할 때 해당 영역의 정답 20개를 입력합니다. 영역을 바꾸면 타이머는 처음부터 다시 시작합니다. 스톱워치는 시작을 누르면 0초부터 올라갑니다.</p>
          </div>
          <div className="tutorial-section">
            <div className="section-icon">✏️</div>
            <h3>OMR 답안 작성</h3>
            <p>OMR은 타이머 모드와 관계없이 다섯 영역으로 나뉘며, 각 영역은 1~20번으로 표시됩니다. 1~5번 중 답을 클릭해 표시하고, 같은 번호를 다시 누르면 해제됩니다. 문항 번호를 클릭하면 그 문제를 풀 때 적어둔 메모/그림을 볼 수 있습니다.</p>
          </div>
          <div className="tutorial-section">
            <div className="section-icon">✅</div>
            <h3>채점하기</h3>
            <p>"채점하기"를 누르고 정답을 쉼표 또는 공백으로 구분해 입력하면 총점과 영역별 정답/오답/미답 개수, 문항별 결과가 표시됩니다. 필터 버튼으로 원하는 결과만 볼 수 있습니다. 모의고사 모드에서 채점하면 위 학습 기록 표에 자동 저장되고, 정답을 고쳐 다시 채점하면 같은 기록이 갱신됩니다("답안 초기화" 후 채점하면 새 기록).</p>
          </div>
          <div className="tutorial-section">
            <div className="section-icon">🧾</div>
            <h3>오답노트 PDF</h3>
            <p>채점 후 "오답노트 PDF로 저장"을 누르고 인쇄 대화상자에서 "PDF로 저장"을 선택하면, 못 푼 문제 목록과 틀린 문제별 메모/그림이 정리된 PDF가 만들어집니다.</p>
          </div>
          <div className="tutorial-section">
            <div className="section-icon">🧮</div>
            <h3>계산기</h3>
            <p>사칙연산, 괄호, %를 지원합니다. 키보드 숫자·연산자, Enter(=), Backspace, Esc/C(초기화)로도 입력할 수 있습니다.</p>
          </div>
          <div className="tutorial-section">
            <div className="section-icon">📝</div>
            <h3>메모장 / 그림판</h3>
            <p>탭으로 메모장과 그림판을 전환합니다. 그림판은 색상과 선 굵기를 조절할 수 있고, "전체 지우기"로 비울 수 있습니다.</p>
          </div>
          <div className="tutorial-footer-info">
            <p>🎯 학습 팁: 계산기, 메모, 그림판, OMR 답안, 학습 기록은 자동 저장되어 새로고침해도 유지됩니다.</p>
          </div>
        </div>
        <div className="tutorial-footer">
          <button className="btn-primary" onClick={dismiss}>닫기</button>
        </div>
      </div>
    </div>
  );
});

Tutorial.displayName = "Tutorial";

export default Tutorial;

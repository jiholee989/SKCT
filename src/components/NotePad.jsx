import { useState, useRef, useEffect, useCallback } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const CANVAS_STORAGE_KEY = "skct-notepad-canvas";

export default function NotePad() {
  const [mode, setMode] = useState("notepad");
  const [memoText, setMemoText] = useLocalStorage("skct-notepad-memo", "");
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const snapshotRef = useRef(null); // in-memory dataURL, kept across resizes within the session
  const sizedRef = useRef(false); // true once we've explicitly sized the canvas at least once

  // Resize the canvas to fill its container without losing existing strokes:
  // snapshot -> resize (which the browser would otherwise clear) -> redraw.
  const resizeCanvasPreservingContent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    // canvas.width/height default to 300/150 even when never drawn to, so that alone
    // can't tell us whether there's real content - track it explicitly instead.
    const snapshot = sizedRef.current
      ? canvas.toDataURL()
      : snapshotRef.current || localStorage.getItem(CANVAS_STORAGE_KEY);
    sizedRef.current = true;

    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;

    if (snapshot) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = snapshot;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "drawing") return;
    resizeCanvasPreservingContent();
    const onWindowResize = () => resizeCanvasPreservingContent();
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [mode, resizeCanvasPreservingContent]);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    snapshotRef.current = dataUrl;
    localStorage.setItem(CANVAS_STORAGE_KEY, dataUrl);
  };

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    ctxRef.current.closePath();
    setIsDrawing(false);
    saveCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    snapshotRef.current = null;
    localStorage.removeItem(CANVAS_STORAGE_KEY);
  };

  const clearMemo = () => setMemoText("");

  const stop = (e) => e.stopPropagation();

  return (
    <div className="notepad">
      <div className="notepad-header">
        <div className="mode-toggle">
          <button className={mode === "notepad" ? "active" : ""} onClick={() => setMode("notepad")}>메모장</button>
          <button className={mode === "drawing" ? "active" : ""} onClick={() => setMode("drawing")}>그림판</button>
        </div>
      </div>

      {/* Both panes stay mounted and are toggled with CSS display, not unmounted by a
          ternary - unmounting would reset canvasRef and wipe the drawing on every tab switch. */}
      <div className="notepad-content" style={{ display: mode === "notepad" ? "flex" : "none" }}>
        <textarea
          className="memo-textarea"
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          onKeyDown={stop}
          placeholder="메모를 입력하세요..."
        />
        <div className="notepad-actions">
          <button className="clear-memo-btn" onClick={clearMemo}>메모 지우기</button>
        </div>
      </div>
      <div className="drawing-content" style={{ display: mode === "drawing" ? "flex" : "none" }}>
        <div className="drawing-toolbar">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} onKeyDown={stop} />
          <input
            type="range"
            min={1}
            max={10}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            onKeyDown={stop}
          />
          <button className="clear-canvas-btn" onClick={clearCanvas}>전체 지우기</button>
        </div>
        <div className="drawing-canvas-container">
          <canvas
            ref={canvasRef}
            className="drawing-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
}

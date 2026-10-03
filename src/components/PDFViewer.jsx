import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import PDFErrorBoundary from "./PDFErrorBoundary";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// Self-hosted cmaps/standard fonts (copied from pdfjs-dist into public/pdfjs) so PDFs
// with non-embedded CJK fonts (e.g. Korean exam text) render instead of erroring out.
// Must be a stable reference - react-pdf reloads the document if `options` changes identity.
// BASE_URL (not a hardcoded "/") so these still resolve under a subpath, e.g. GitHub Pages'
// /SKCT/ base.
const PDF_OPTIONS = {
  cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  stopAtErrors: false,
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;
const PLACEHOLDER_WIDTH = 600; // approx A4 portrait at scale 1, just for a stable pre-render slot size
const PLACEHOLDER_HEIGHT = 848;

// Mounting every page of a long exam PDF (500+) at once is what was hanging the
// viewer. Each page instead sits behind an IntersectionObserver and only mounts
// (and pulls its bytes/render work) once it scrolls near the viewport, so pages
// keep appearing as the user scrolls instead of blocking on the whole document.
function LazyPage({ pageNumber, scale }) {
  const [visible, setVisible] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const slotRef = useRef(null);

  useEffect(() => {
    if (visible) return;
    const el = slotRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={slotRef} id={`pdf-page-${pageNumber}`} className="pdf-page-slot">
      {visible ? (
        renderError ? (
          <div
            className="pdf-page-placeholder pdf-page-error"
            style={{ width: PLACEHOLDER_WIDTH * scale, height: 80 * scale, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ fontSize: "0.85em", opacity: 0.5 }}>{pageNumber}페이지 렌더링 실패</span>
          </div>
        ) : (
          <Page
            pageNumber={pageNumber}
            renderTextLayer
            renderAnnotationLayer
            scale={scale}
            className="pdf-page"
            onRenderError={() => setRenderError(true)}
          />
        )
      ) : (
        <div
          className="pdf-page-placeholder"
          style={{ width: PLACEHOLDER_WIDTH * scale, height: PLACEHOLDER_HEIGHT * scale }}
        />
      )}
    </div>
  );
}

export default function PDFViewer() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) {
      alert("PDF 파일만 업로드 가능합니다.");
      return;
    }
    setFile(f);
    setNumPages(null);
    setScale(1);
    setLoading(true);
    setLoadProgress(0);
    setCurrentPage(1);
  };

  // Jumps to a page by scrolling it into view - the continuous scroll stays
  // usable as before, this is just a shortcut on top of it. The page indicator
  // is kept correct by the tracking effect below regardless, so this doesn't
  // need to land pixel-perfect.
  const goToPage = (n) => {
    const clamped = Math.min(Math.max(n, 1), numPages || 1);
    setCurrentPage(clamped);
    document.getElementById(`pdf-page-${clamped}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Keeps the page indicator in sync with manual scrolling too (and corrects
  // goToPage's guess once layout settles). A single IntersectionObserver
  // watching all page slots as the trigger - not a scroll listener doing
  // getBoundingClientRect on every pixel - so cost stays flat regardless of how
  // many hundreds of pages the document has. On every firing it re-derives
  // "current page" from the slots' live positions rather than trusting which
  // entries changed: a placeholder converting to its real rendered height
  // reflows the document, and relying only on enter/exit deltas can get stuck
  // on a stale page if the correct one never re-fires (it was already
  // intersecting and simply stays that way).
  useEffect(() => {
    if (!numPages) return;
    const container = document.querySelector(".pdf-content");
    const slots = container ? [...container.querySelectorAll(".pdf-page-slot")] : [];
    if (!container || slots.length === 0) return;

    const bandHeight = container.clientHeight * 0.3;
    const updateCurrentPage = () => {
      const containerTop = container.getBoundingClientRect().top;
      let best = null;
      for (const slot of slots) {
        const top = slot.getBoundingClientRect().top - containerTop;
        if (top <= bandHeight && (best === null || top > best.top)) best = { top, id: slot.id };
      }
      if (!best) return;
      const num = Number(best.id.slice("pdf-page-".length));
      if (num) setCurrentPage(num);
    };

    const observer = new IntersectionObserver(updateCurrentPage, {
      root: container,
      rootMargin: "0px 0px -70% 0px",
      threshold: 0,
    });
    slots.forEach((slot) => observer.observe(slot));
    return () => observer.disconnect();
  }, [numPages]);

  // Arrow-key page navigation. Other components that own keyboard input
  // (NotePad, the OMR grading textarea, all of Timer) already stopPropagation
  // on their own keydown handlers, so typing/adjusting values there never
  // bubbles up to this listener.
  useEffect(() => {
    if (!file) return;
    const onKeyDown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPage(currentPage - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [file, currentPage, numPages]);

  const onDocLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setLoading(false);
  };

  const onLoadProgress = ({ loaded, total }) => {
    if (total) setLoadProgress(Math.round((loaded / total) * 100));
  };

  const onLoadError = (err) => {
    alert("PDF 파일을 불러오는 데 실패했습니다.");
    console.error(err);
    setLoading(false);
  };

  const setZoom = (v) => {
    if (!file) return;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, v)));
  };

  return (
    <div className="pdf-viewer">
      <div className="pdf-header">
        <h2>문제</h2>
        {file && (
          <div className="pdf-controls">
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={() => setZoom(scale - SCALE_STEP)} disabled={scale <= MIN_SCALE}>-</button>
              <input
                type="range"
                className="zoom-slider"
                min={MIN_SCALE * 100}
                max={MAX_SCALE * 100}
                step={10}
                value={Math.round(scale * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)}
              />
              <span className="zoom-level">{Math.round(scale * 100)}%</span>
              <button className="zoom-btn" onClick={() => setZoom(scale + SCALE_STEP)} disabled={scale >= MAX_SCALE}>+</button>
              <button className="zoom-reset" onClick={() => setZoom(1)}>초기화</button>
            </div>
            <div className="page-nav-controls">
              <button className="page-nav-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
              <span className="page-nav-label">{currentPage} / {numPages || 1}</span>
              <button className="page-nav-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= (numPages || 1)}>›</button>
            </div>
          </div>
        )}
        <label htmlFor="pdf-upload" className="upload-btn">PDF 업로드</label>
        <input type="file" accept="application/pdf" onChange={onFileChange} id="pdf-upload" style={{ display: "none" }} />
      </div>
      <div className="pdf-content">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>PDF 파일을 불러오는 중입니다... {loadProgress}%</p>
          </div>
        )}
        {file && (
          <PDFErrorBoundary key={`${file.name}-${file.lastModified}-${file.size}`}>
            <Document
              file={file}
              options={PDF_OPTIONS}
              onLoadSuccess={onDocLoadSuccess}
              onLoadProgress={onLoadProgress}
              onLoadError={onLoadError}
              className="pdf-document"
            >
              {Array.from(new Array(numPages || 0), (_, i) => (
                <LazyPage key={`page_${i + 1}`} pageNumber={i + 1} scale={scale} />
              ))}
            </Document>
          </PDFErrorBoundary>
        )}
        {!file && !loading && (
          <div className="pdf-placeholder">
            <p>PDF 파일을 업로드해주세요</p>
          </div>
        )}
      </div>
    </div>
  );
}

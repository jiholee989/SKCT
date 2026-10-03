import { Component } from "react";

// react-pdf's <Document>/<Page> load through React's Suspense `use()` API and
// re-throw failures (e.g. a corrupt/unsupported PDF) for an Error Boundary to
// catch - without one, the throw is uncaught and React unmounts the whole app.
export default class PDFErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("PDF 렌더링 오류:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="pdf-placeholder">
          <p>이 PDF 파일을 표시할 수 없습니다. 다른 파일을 업로드해주세요.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

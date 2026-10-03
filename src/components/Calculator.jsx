import { useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const findLastNumberRegex = /(-?\d+\.?\d*)$/;

export default function Calculator() {
  const [display, setDisplay] = useLocalStorage("skct-calc-display", "0");
  const [isResultShown, setIsResultShown] = useLocalStorage("skct-calc-result-shown", false);

  const handleNumber = (e) => {
    setDisplay(isResultShown || display === "0" || display === "Error" ? e : (i) => i + e);
    setIsResultShown(false);
  };

  const handleOperator = (e) => {
    if (display === "Error") return;
    const last = display.slice(-1);
    ["+", "-", "×", "÷"].includes(last) ? setDisplay((s) => s.slice(0, -1) + e) : setDisplay((s) => s + e);
    setIsResultShown(false);
  };

  const handleParentheses = (e) => {
    setDisplay(isResultShown || display === "0" || display === "Error" ? e : (i) => i + e);
    setIsResultShown(false);
  };

  const handleDecimal = () => {
    const segments = display.split(/[+\-×÷()]/);
    if (!segments[segments.length - 1].includes(".")) setDisplay((i) => i + ".");
    setIsResultShown(false);
  };

  const handleClear = () => {
    setDisplay("0");
    setIsResultShown(false);
  };

  const handleBackspace = () => {
    if (isResultShown || display === "Error") {
      handleClear();
      return;
    }
    const e = display.slice(0, -1);
    setDisplay(e === "" ? "0" : e);
  };

  const handleSign = () => {
    if (isResultShown || display === "Error") return;
    const m = display.match(findLastNumberRegex);
    if (m) {
      const matched = m[0];
      const start = m.index;
      setDisplay(
        matched.startsWith("-")
          ? display.substring(0, start) + matched.substring(1)
          : display.substring(0, start) + `(-${matched})`
      );
    }
  };

  const handlePercent = () => {
    if (isResultShown || display === "Error") return;
    const m = display.match(findLastNumberRegex);
    if (m) {
      const value = parseFloat(m[0]) / 100;
      setDisplay(display.substring(0, m.index) + String(value));
    }
  };

  const handleEquals = () => {
    if (display === "Error" || isResultShown) return;
    try {
      const evalExpression = display.replace(/×/g, "*").replace(/÷/g, "/");
      // eslint-disable-next-line no-eval
      const result = eval(evalExpression);
      setDisplay(isFinite(result) ? String(parseFloat(result.toPrecision(15))) : "Error");
    } catch {
      setDisplay("Error");
    }
    setIsResultShown(true);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const { key } = e;
      e.preventDefault();
      if (key >= "0" && key <= "9") handleNumber(key);
      else if (["+", "-", "*", "/"].includes(key)) handleOperator(key === "*" ? "×" : key === "/" ? "÷" : key);
      else if (key === "(" || key === ")") handleParentheses(key);
      else if (key === ".") handleDecimal();
      else if (key === "%") handlePercent();
      else if (key === "Enter" || key === "=") handleEquals();
      else if (key === "Backspace") handleBackspace();
      else if (key.toLowerCase() === "c" || key === "Escape") handleClear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, isResultShown]);

  return (
    <div className="calculator">
      <div className="calc-header">계산기</div>
      <div className="calc-display">{display}</div>
      <div className="calc-buttons">
        <button className="btn-function" onClick={() => handleParentheses("(")}>(</button>
        <button className="btn-function" onClick={() => handleParentheses(")")}>)</button>
        <button className="btn-function" onClick={handlePercent}>%</button>
        <button className="btn-function" onClick={handleBackspace}>C</button>
        <button className="btn-function" onClick={handleClear}>AC</button>
        <button className="btn-function" onClick={handleSign}>+/-</button>
        <button className="btn-operator" onClick={() => handleOperator("÷")}>÷</button>
        <button className="btn-operator" onClick={() => handleOperator("×")}>×</button>
        <button className="btn-number" onClick={() => handleNumber("7")}>7</button>
        <button className="btn-number" onClick={() => handleNumber("8")}>8</button>
        <button className="btn-number" onClick={() => handleNumber("9")}>9</button>
        <button className="btn-operator" onClick={() => handleOperator("-")}>-</button>
        <button className="btn-number" onClick={() => handleNumber("4")}>4</button>
        <button className="btn-number" onClick={() => handleNumber("5")}>5</button>
        <button className="btn-number" onClick={() => handleNumber("6")}>6</button>
        <button className="btn-operator" onClick={() => handleOperator("+")}>+</button>
        <button className="btn-number" onClick={() => handleNumber("1")}>1</button>
        <button className="btn-number" onClick={() => handleNumber("2")}>2</button>
        <button className="btn-number" onClick={() => handleNumber("3")}>3</button>
        <button className="btn-operator" onClick={handleEquals}>=</button>
        <button className="btn-number btn-zero" onClick={() => handleNumber("0")}>0</button>
        <button className="btn-number" onClick={handleDecimal}>.</button>
      </div>
    </div>
  );
}

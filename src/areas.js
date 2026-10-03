export const AREA_NAMES = ["언어이해", "자료해석", "창의수리", "언어추리", "수열추리"];
export const QUESTIONS_PER_AREA = 20; // 5 x 20 = 100
export const AREAS = AREA_NAMES.map((name, i) => ({
  name,
  start: i * QUESTIONS_PER_AREA + 1,
  end: (i + 1) * QUESTIONS_PER_AREA,
}));

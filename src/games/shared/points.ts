/**
 * ─── LANDMARK: POINTS CLAMP ────────────────────────────────────────────────
 * Пределы счётчиков листа. Вунды в Dark Heresy уходят в минус до `-max`
 * (тяжёлые ранения), но не ниже: за этим пределом персонаж уже мёртв, и
 * дальнейшее вычитание только ломает арифметику и историю. Остальные
 * счётчики (судьба, безумие, порча, кастомные ресурсы) неотрицательны.
 */
export function clampWoundPoints(current: number, max: number): number {
  const safeCurrent = Number.isFinite(current) ? Math.trunc(current) : 0;
  const upper = Number.isFinite(max) ? Math.max(0, Math.trunc(max)) : 0;
  const clamped = Math.min(Math.max(safeCurrent, -upper), upper);
  return clamped === 0 ? 0 : clamped;
}

/** Счётчик, который не может быть отрицательным. */
export function clampResourcePoints(current: number, max: number): number {
  const safeCurrent = Number.isFinite(current) ? Math.trunc(current) : 0;
  const upper = Number.isFinite(max) ? Math.max(0, Math.trunc(max)) : 0;
  return Math.min(Math.max(safeCurrent, 0), upper);
}

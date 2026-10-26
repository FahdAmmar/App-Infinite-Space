/**
 * نقاط موزعة بانتظام على سطح كرة (حلزون فيبوناتشي): توزيع متساوٍ بلا تكتلات عند القطبين،
 * فيبدو حقل النقاط متناسقاً أثناء الدوران. تعيد مصفوفة x,y,z متتابعة جاهزة لـ BufferAttribute.
 */
export function fibonacciSphere(count: number, radius: number): Float32Array {
  const points = new Float32Array(Math.max(0, count) * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    // y من +1 إلى -1، ونصف قطر الدائرة الأفقية عند ذلك الارتفاع
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2
    const ring = Math.sqrt(1 - y * y)
    const angle = golden * i
    points[i * 3] = Math.cos(angle) * ring * radius
    points[i * 3 + 1] = y * radius
    points[i * 3 + 2] = Math.sin(angle) * ring * radius
  }
  return points
}

/** اقتراب تدريجي من الهدف: t بين 0 و1 (يُشتق من الزمن المنقضي كي لا يتأثر بمعدل الإطارات). */
export function approach(current: number, target: number, t: number): number {
  return current + (target - current) * Math.min(1, Math.max(0, t))
}

/** معامل سلاسة مستقل عن معدل الإطارات: 1 - e^(-speed·dt) */
export function smoothing(speed: number, deltaSeconds: number): number {
  return 1 - Math.exp(-speed * Math.max(0, deltaSeconds))
}

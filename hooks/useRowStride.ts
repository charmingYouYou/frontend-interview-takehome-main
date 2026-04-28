import { useEffect, useRef, useState } from 'react'

/**
 * 行 stride 实测 hook —— 把"行视觉占位高度（即下一行起点相对当前行起点的
 * y 偏移）"的真理来源从 JS 常量迁移到 CSS。
 *
 * 设计动机：
 *   GridBookingBars 通过 `top = rowIndex × rowHeightPx` 把每条 bar 在二维坐标系中
 *   绝对定位，rowHeightPx 必须严格等于 `.row` 的 offsetHeight（含 border-bottom）。
 *   原实现以模块级常量 `BOOKING_CONFIG.ROW_HEIGHT_PX = 41`（= --size-row-height
 *   40 + 1px 行底分隔线）硬编码该值，与 CSS 形成两份真理来源：分隔线方案改成
 *   box-shadow / outline、token 高度调整、行内增加 padding 等任一改动都会让 JS
 *   常量与实际 stride 漂移，bar 跨行累积错位（每跨一行漂 1px，rowIndex=25 处肉
 *   眼可见 bar 上抬到上一行）。
 *
 * 实现要点：
 *   1. 用 `offsetHeight` 而非 `getBoundingClientRect().height`：前者四舍五入为整
 *      数像素，与"按行索引乘 stride"的整数几何模型对齐，规避亚像素累积；
 *   2. ResizeObserver 在 layout 流水线尾端触发，CSS / 字体 / 缩放任一变化都会
 *      被自然捕获，无需手工订阅 window.resize；
 *   3. 同值短路（prev === next）避免无意义 setState 引发 BookingGrid 重渲染；
 *      next === 0 (元素被卸载 / display:none 瞬态) 时保留上一次有效值，避免
 *      bar 集体塌到行 0；
 *   4. 测量前 / SSR 期间使用 fallback。挂载后第一次 `update()` 立即实测覆盖，
 *      首帧若 fallback 与真实 stride 不一致最多漂 1 帧（mount 同步路径），
 *      后续完全跟随 CSS。
 *
 * 用法：
 *   const [ref, stride] = useRowStride<HTMLDivElement>(BOOKING_CONFIG.ROW_HEIGHT_PX)
 *   <RoomRow ref={i === 0 ? ref : undefined} ... />
 */
export function useRowStride<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T | null>(null)
  const [stride, setStride] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const next = el.offsetHeight
      // next === 0 视为瞬态（卸载 / display:none），保留旧值；同值跳过 setState。
      setStride(prev => (next === 0 || prev === next ? prev : next))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, stride] as const
}

import { useState, useCallback } from 'react'
import { BOOKING_CONFIG } from '@/lib/bookingConfig'

/**
 * 横向虚拟滚动可视范围 hook。
 *
 * 输入：无（列宽与可视列数从 BOOKING_CONFIG 单例读取，避免 hook 与
 *      调用方各自维护魔法数字导致漂移）。
 * 输出：startIndex / endIndex（以 dayIndex 表示的可视窗）、handleScroll
 *      （绑定到滚动容器的 onScroll）。
 *
 * 阈值化 setState：
 *   原实现把 `scrollLeft` 直接进 React state，每像素滚动都触发整个
 *   BookingGrid 子树 reconcile，但 `startIndex = floor(scrollLeft / COL)`
 *   实际仅在跨过列边界（每 COLUMN_WIDTH_PX 像素一次）时变化。这里改为
 *   直接用 startIndex 做 state，并通过函数式 setter 比较新旧值——同列
 *   内的滚动事件被 React 自动跳过 rerender，setState 频率从 60Hz 像素流
 *   降到"每跨列一次"。代价是 GridBookingBars 的 sticky-left 吸附呈现
 *   "贴 COL → 瞬跳一格"的 stepwise 行为而非像素级平滑，肉眼在常规滚速
 *   下基本无感；快滚时若需要绝对平滑，可后续将 scroll 写入 ref + rAF
 *   驱动 transform、彻底踢出 React 渲染链路。
 *
 * 接口变化：
 *   旧版输出嵌套对象 `visibleRange { startIndex, endIndex, offsetPx }`
 *   并附带 `scrollLeft`；其中 `offsetPx` / `scrollLeft` 自虚拟化方案
 *   迭代后已无消费者（详见 grep），保留只会引导后续误用。这里拍平为
 *   `{ startIndex, endIndex, handleScroll }`，同时收窄输出表面。
 */
export function useVisibleRange() {
  const [startIndex, setStartIndex] = useState(0)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const next = Math.floor(
      e.currentTarget.scrollLeft / BOOKING_CONFIG.COLUMN_WIDTH_PX,
    )
    // 函数式 setter + 同值短路：列内滚动事件返回 prev，React 跳过 rerender；
    // 跨列事件返回新值，触发 BookingGrid 与 GridBookingBars 重渲染。
    setStartIndex(prev => (prev === next ? prev : next))
  }, [])

  return {
    startIndex,
    endIndex: startIndex + BOOKING_CONFIG.VISIBLE_COLUMNS,
    handleScroll,
  }
}

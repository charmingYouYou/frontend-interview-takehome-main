import { useState, useCallback } from 'react'
import { BOOKING_CONFIG } from '@/lib/bookingConfig'

interface VisibleRange {
  startIndex: number
  endIndex: number
  offsetPx: number
}

/**
 * 横向虚拟滚动可视范围 hook。
 *
 * 输入：无（列宽与可视列数从 BOOKING_CONFIG 单例读取，避免 hook 与
 *      调用方各自维护魔法数字导致漂移）。
 * 输出：visibleRange（startIndex / endIndex / offsetPx）、handleScroll
 *      （绑定到滚动容器的 onScroll）、scrollLeft。
 * 副作用：内部 useState 维护 scrollLeft，受控于消费方滚动事件。
 */
export function useVisibleRange() {
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft)
  }, [])

  const { COLUMN_WIDTH_PX, VISIBLE_COLUMNS } = BOOKING_CONFIG
  const startIndex = Math.floor(scrollLeft / COLUMN_WIDTH_PX)
  const visibleRange: VisibleRange = {
    startIndex,
    endIndex: startIndex + VISIBLE_COLUMNS,
    offsetPx: scrollLeft % COLUMN_WIDTH_PX,
  }

  return { visibleRange, handleScroll, scrollLeft }
}

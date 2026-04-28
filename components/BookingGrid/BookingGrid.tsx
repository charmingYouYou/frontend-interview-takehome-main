import React from 'react'
import { Booking, RoomUnit } from '@/types'
import { useVisibleRange } from '@/hooks/useVisibleRange'
import { useRowStride } from '@/hooks/useRowStride'
import { RoomRow } from './RoomRow'
import { GridBookingBars } from './GridBookingBars'
import { BOOKING_CONFIG } from '@/lib/bookingConfig'
import { buildDayLabels } from '@/lib/date'
import styles from './BookingGrid.module.css'

interface BookingGridProps {
  roomUnits: RoomUnit[]
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
}

/**
 * BookingGrid：预订时间网格的顶层容器。
 *
 * 职责：组合表头（房型槽 + 日期列）与滚动主体（多个 RoomRow + 顶层
 *       GridBookingBars 数据层），并通过 useVisibleRange 维护可视窗口
 *       供 GridBookingBars 做窗口过滤。
 * 滚动模型：整个网格只有一个滚动容器 `.body`，表头 `.header` 与全部
 *          RoomRow 同处于 `.body` 内层 wrapper（以 `minWidth` 撑出全宽），
 *          通过 `position: sticky` 实现首行（top:0）/ 首列（left:0）双向
 *          吸附 —— 横滚时表头日期列与下方日格自然对齐、纵滚时房型标签
 *          始终可见。
 * BookingBars 提升：原 BookingBars 嵌套在每个 RoomRow 内、随 visibleRange
 *          下发到每行各自渲染；现统一上移到 grid 层的 GridBookingBars，
 *          以二维绝对坐标（left = LABEL + dayIndex × COLUMN_WIDTH，
 *          top = rowIndex × ROW_HEIGHT_PX）一次性渲染所有 bar。横滚时
 *          只剩 BookingGrid + GridBookingBars 两层重渲染，N 个 RoomRow
 *          因 props 引用稳定（rowName / totalDays / columnWidthPx 跨帧
 *          不变）配合 React.memo 浅比较直接跳过。
 * 表头渲染口径：表头日期列按 TOTAL_DAYS 全量渲染，与 DayCells 全量策略
 *          对齐；useVisibleRange 不再驱动表头视图，仅供 GridBookingBars
 *          数据层过滤。
 * 状态归属：本组件不再持有任何 hover 相关 React 状态 —— 行 / 日格 hover
 *          已彻底下沉到 CSS `:hover` 伪类，鼠标进出网格不会触发任何
 *          setState 与重渲染链路。
 * 配置来源：列宽 / 标签列宽 / 总天数 / 表头背景 / 日期窗口起点全部从
 *          BOOKING_CONFIG 读取（字段使用常量命名规范 UPPER_SNAKE_CASE），
 *          同名字段以驼峰 props 显式透传给子组件，保持子组件接口稳定。
 * 行 stride 真理来源：bar 几何计算所需的行 stride 由 useRowStride 在首行
 *          RoomRow 上挂 ResizeObserver 实测 offsetHeight 得到，CSS 行高
 *          方案（token 高度、border 切换、行内 padding 调整）变化时自动
 *          跟随，不再依赖 JS 端硬编码常量。BOOKING_CONFIG.ROW_HEIGHT_PX
 *          仅作为 SSR / 首帧测量未就绪时的 fallback。
 * 视觉规格：所有静态样式（颜色 / 间距 / 边框 / 字号 / 表头背景 / sticky
 *          层级）来自 BookingGrid.module.css + tokens.css；仅依赖 JS 常量
 *          的几何值（列宽、内层 wrapper 最小宽度、bar 坐标等）以 inline
 *          style 注入。
 */
export function BookingGrid({ roomUnits, bookings, onBookingClick }: BookingGridProps) {
  const { startIndex, endIndex, handleScroll } = useVisibleRange()
  const {
    COLUMN_WIDTH_PX,
    LABEL_COLUMN_WIDTH_PX,
    ROW_HEIGHT_PX,
    BAR_OFFSET_TOP_PX,
    TOTAL_DAYS,
    DATE_RANGE_START,
  } = BOOKING_CONFIG
  // 实测首行 offsetHeight 作为行 stride 的真理来源；ROW_HEIGHT_PX 仅作
  // SSR / 首帧 fallback，挂载后第一帧立即被实测值覆盖。
  const [firstRowRef, rowStride] = useRowStride<HTMLDivElement>(ROW_HEIGHT_PX)
  const dayLabels = buildDayLabels(DATE_RANGE_START, TOTAL_DAYS)

  return (
    <div className={styles.root}>
      {/* 唯一滚动容器：表头与所有 RoomRow 同处其中，通过 sticky 实现首行 / 首列吸附 */}
      <div className={styles.body} onScroll={handleScroll}>
        <div
          className={styles.inner}
          style={{ minWidth: TOTAL_DAYS * COLUMN_WIDTH_PX + LABEL_COLUMN_WIDTH_PX }}
        >
          {/* Header row：sticky top:0 */}
          <div className={styles.header}>
            <div className={styles.headerLabel}>Room</div>
            <div className={styles.headerDays}>
              {Array.from({ length: TOTAL_DAYS }, (_, dayIndex) => (
                <div
                  key={dayIndex}
                  className={styles.headerDay}
                  style={{
                    width: COLUMN_WIDTH_PX,
                    minWidth: COLUMN_WIDTH_PX,
                  }}
                >
                  {dayLabels[dayIndex]}
                </div>
              ))}
            </div>
          </div>

          {/* 行区 + bar 层共用同一定位上下文：rowsLayer 既排列 RoomRow，
              又承载绝对定位的 .barsLayer 让其覆盖所有行的二维平面。 */}
          <div className={styles.rowsLayer}>
            {roomUnits.map((room, i) => (
              <RoomRow
                key={room.id}
                // 仅首行挂 ref：useRowStride 实测一行即可代表全表（所有
                // RoomRow 共用同一套 CSS 规则，stride 一致）；其余行 ref=undefined
                // 不影响 React.memo 浅比较，渲染次数仍收敛为 0。
                ref={i === 0 ? firstRowRef : undefined}
                rowName={room.name}
                totalDays={TOTAL_DAYS}
                columnWidthPx={COLUMN_WIDTH_PX}
              />
            ))}

            <div className={styles.barsLayer}>
              <GridBookingBars
                bookings={bookings}
                roomUnits={roomUnits}
                visibleStartIndex={startIndex}
                visibleEndIndex={endIndex}
                columnWidthPx={COLUMN_WIDTH_PX}
                rowHeightPx={rowStride}
                barOffsetTopPx={BAR_OFFSET_TOP_PX}
                labelColumnWidthPx={LABEL_COLUMN_WIDTH_PX}
                dateRangeStart={DATE_RANGE_START}
                onBookingClick={onBookingClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

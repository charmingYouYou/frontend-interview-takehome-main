import React, { useMemo, memo } from "react";
import { Booking } from "@/types";
import { STATUS_COLOR_VARS, STATUS_FALLBACK_COLOR } from "@/lib/bookingStatus";
import { diffDays } from "@/lib/date";
import styles from "./RoomRow.module.css";

interface RoomRowProps {
  rowId: string;
  rowName: string;
  bookings: Booking[];
  /** 可视窗口起始 dayIndex，仅用于 booking bar 过滤；日格层不感知。 */
  visibleStartIndex: number;
  /** 可视窗口结束 dayIndex（含），仅用于 booking bar 过滤；日格层不感知。 */
  visibleEndIndex: number;
  /** 日历窗口总天数，用于日格背景全量渲染。 */
  totalDays: number;
  /** 单日列宽（px），由父级 BookingGrid 从 BOOKING_CONFIG 透传，避免子组件直读单例。 */
  columnWidthPx: number;
  /** 时间窗起点（ISO 日期），由父级 BookingGrid 注入，避免组件直读全局 config。 */
  dateRangeStart: string;
  onBookingClick: (booking: Booking) => void;
}

interface DayCellsProps {
  totalDays: number;
  columnWidthPx: number;
}

/**
 * DayCells：单行内的等宽日格背景层。
 *
 * 拆出独立子组件 + React.memo 的目的：日格仅依赖 totalDays（窗口总天数）
 * 与 columnWidthPx（列宽）两个模块级常量（来自 BOOKING_CONFIG，跨整个
 * 应用生命周期不变），与 bookings 数据、滚动窗口 visibleRange 全部正交。
 * props 跨帧恒定意味着 memo 浅比较永久命中 —— 无论 SWR 数据刷新还是网格
 * 横滚，本层 DOM 都不会重渲染，真正达成"日格永不重渲染"的设计目标。
 * Hover 视觉态由 CSS `.cell:hover` 伪类承担，不进入 React 渲染链路。
 *
 * 关于虚拟化：当前数据规模（30 列 × 31 行 ≈ 900 个 cell）下全量渲染
 * 完全可承受（见 DECISIONS 权衡取舍 #4），让浏览器原生横滚处理可视
 * 区裁剪。这同时绕开了原"窗口式 cell + 容器 minWidth 撑全宽"造成的
 * 视觉错位（cells 锚定在容器左端、随 scrollLeft 被卷出视口）的伪
 * 虚拟化问题。
 */
const DayCells = memo(function DayCells({
  totalDays,
  columnWidthPx,
}: DayCellsProps) {
  return (
    <>
      {Array.from({ length: totalDays }, (_, i) => (
        <div
          key={i}
          className={styles.cell}
          style={{
            left: i * columnWidthPx,
            width: columnWidthPx,
          }}
        />
      ))}
    </>
  );
});

interface BookingBarsProps {
  bookings: Booking[];
  visibleStartIndex: number;
  visibleEndIndex: number;
  columnWidthPx: number;
  dateRangeStart: string;
  onBookingClick: (booking: Booking) => void;
}

/**
 * BookingBars：单行内的预订条数据层。
 *
 * 职责：把 Booking 数组按 dateRangeStart 计算出每条的 dayIndex 跨度，
 *      过滤出与可视窗口 [visibleStartIndex, visibleEndIndex] 相交的子集，
 *      并以绝对定位的色块渲染到 timeline 容器内。
 * 拆出独立子组件 + React.memo 的目的：
 *   - **关注点分离**：booking bar 是"数据层"渲染产物，依赖 bookings 数据
 *     与可视窗口；日格 DayCells 是"几何层"，依赖几何常量。两层职责正交、
 *     生命周期不同，拆开后各自独立 memo，互不牵连。
 *   - **重渲染最小化**：当父级 RoomRow 因无关 prop 浅比较失败（例如父级
 *     回调引用变化）而重渲染时，BookingBars 的 props 若未变，memo 浅比较
 *     命中即跳过 visibleBookings 计算与 DOM 重渲染。
 *   - **可单测**：visibleBookings 计算与 bar 渲染整体内聚在一处，可对
 *     "给定 bookings × 窗口 → 渲染子集与定位"这条契约做独立单测，无需
 *     mock 整个 RoomRow。
 * 虚拟化策略：bar 数量在长尾历史预订堆积场景下可能远大于日格数（每行
 *      数十至数百条），保留 visibleStart/EndIndex 窗口过滤是数据层的合理
 *      虚拟化；与日格层"全量渲染"的策略形成"几何全量、数据窗口"差异化
 *      虚拟化。
 */
const BookingBars = memo(function BookingBars({
  bookings,
  visibleStartIndex,
  visibleEndIndex,
  columnWidthPx,
  dateRangeStart,
  onBookingClick,
}: BookingBarsProps) {
  const visibleBookings = useMemo(() => {
    return bookings
      .map((b) => {
        const startDay = diffDays(dateRangeStart, b.checkIn);
        const endDay = diffDays(dateRangeStart, b.checkOut);
        const color = STATUS_COLOR_VARS[b.status] ?? STATUS_FALLBACK_COLOR;
        return { booking: b, startDay, endDay, color };
      })
      .filter(
        ({ startDay, endDay }) =>
          endDay >= visibleStartIndex && startDay <= visibleEndIndex,
      );
  }, [bookings, visibleStartIndex, visibleEndIndex, dateRangeStart]);

  return (
    <>
      {visibleBookings.map(({ booking, startDay, endDay, color }) => {
        const left = Math.max(
          0,
          (startDay - visibleStartIndex) * columnWidthPx,
        );
        const width =
          (Math.min(endDay, visibleEndIndex) -
            Math.max(startDay, visibleStartIndex) +
            1) *
          columnWidthPx;
        return (
          <div
            key={booking.id}
            className={styles.bar}
            title={`${booking.guestName} (${booking.status})`}
            onClick={() => onBookingClick(booking)}
            style={{
              left,
              width: width - 2,
              background: color,
            }}
          >
            {booking.guestName}
          </div>
        );
      })}
    </>
  );
});

/**
 * RoomRow：渲染单个房型在日历窗口内的预订情况。
 *
 * 配置来源：列宽 columnWidthPx / 总天数 totalDays / 日历窗口起点
 *          dateRangeStart 由父级 BookingGrid 通过 props 显式透传（数据
 *          来源仍为 BOOKING_CONFIG），保持单向数据流与可注入接口。
 * 三层结构：本组件作为"行容器"，仅承载布局（label + timeline）与状态
 *          透传，不持有任何渲染逻辑；
 *   - DayCells：几何层，全量渲染、永不重渲染；
 *   - BookingBars：数据层，按可视窗口过滤、随数据 / 滚动重渲染；
 *   两个子层各自 React.memo，与本组件 memo 形成"行 → 几何 / 数据"双子层
 *   结构，重渲染粒度可独立控制。
 * 重渲染抑制：bookings prop 由父级以 useMemo 按 roomId 分桶下发，引用
 *          跨帧稳定；本组件以 React.memo 包裹，浅比较命中即跳过整体
 *          渲染。
 * Hover 表达：行 / 日格 hover 视觉态全部由 CSS `:hover` 伪类承载，无
 *          JS 状态、无父组件 setState、无渲染链路开销。
 * 视觉规格：所有静态样式（颜色 / 间距 / 尺寸 / 圆角 / 动效）来自
 *          RoomRow.module.css + tokens.css；仅 left/width 等几何计算结果
 *          以 inline style 注入。
 */
export function RoomRowImpl({
  rowId,
  rowName,
  bookings,
  visibleStartIndex,
  visibleEndIndex,
  totalDays,
  columnWidthPx,
  dateRangeStart,
  onBookingClick,
}: RoomRowProps) {
  console.log("render", rowId);

  return (
    <div className={styles.row}>
      <div className={styles.label}>{rowName}</div>

      <div className={styles.timeline}>
        {/* 几何层：全量日格背景，永不重渲染 */}
        <DayCells totalDays={totalDays} columnWidthPx={columnWidthPx} />

        {/* 数据层：按可视窗口过滤的预订条 */}
        <BookingBars
          bookings={bookings}
          visibleStartIndex={visibleStartIndex}
          visibleEndIndex={visibleEndIndex}
          columnWidthPx={columnWidthPx}
          dateRangeStart={dateRangeStart}
          onBookingClick={onBookingClick}
        />
      </div>
    </div>
  );
}

export const RoomRow = memo(RoomRowImpl);

import React, { memo, useMemo } from "react";
import { Booking } from "@/types";
import { STATUS_COLOR_VARS, STATUS_FALLBACK_COLOR } from "@/lib/bookingStatus";
import { diffDays } from "@/lib/date";
import styles from "./RoomRow.module.css";

interface GridBookingBarsProps {
  /** 全集 bookings；GridBookingBars 在 grid 层一次性渲染所有 bar，避免按行散落。 */
  bookings: Booking[];
  /** 可视窗口起始 dayIndex；用于数据层窗口过滤（剔除完全在窗口左侧之外的 bar）。 */
  visibleStartIndex: number;
  /** 可视窗口结束 dayIndex（含），用于数据层窗口过滤。 */
  visibleEndIndex: number;
  /** 单日列宽（px）。 */
  columnWidthPx: number;
  /**
   * roomId → 该 room 行顶边相对 .barsLayer 顶部的 y 偏移（px）。
   * 由父级累积每行 `laneCount × LANE_HEIGHT_PX + 1px border` 得到，
   * 取代旧版"rowIndex × rowHeightPx"的等宽行假设，支持多 lane 动态行高。
   */
  rowTopByRoomId: Map<string, number>;
  /**
   * bookingId → 该 booking 在所属 room 行内的 lane 索引（0-based）。
   * 由 lib/laneAssignment.assignLanes 预分配，bar 的 y 在 rowTop 基础上
   * 累加 `laneIndex × laneHeightPx`，让重叠区间彼此错开堆叠不互相覆盖。
   */
  laneByBookingId: Map<string, number>;
  /** 单条 lane 内容高度（px），= LANE_HEIGHT_PX。 */
  laneHeightPx: number;
  /** bar 在 lane 内的纵向偏移（px），需累加进 inline top。 */
  barOffsetTopPx: number;
  /** 左侧房型标签列宽（px）；bar 层覆盖整行（含 label 区），left 需加此偏移。 */
  labelColumnWidthPx: number;
  /** 时间窗起点（ISO 日期），驱动 checkIn/checkOut → dayIndex 换算。 */
  dateRangeStart: string;
  onBookingClick: (booking: Booking) => void;
}

/**
 * GridBookingBars：grid 层统一渲染的预订条数据层。
 *
 * 提升动机：原 BookingBars 嵌套在每个 RoomRow 内，横滚时 visibleStart/EndIndex
 *      变化会沿"BookingGrid → 每行 RoomRow → 每行 BookingBars"链路下发，
 *      尽管子层各自 React.memo 拆分，但 RoomRow 函数体仍要执行 N 次以
 *      完成 props 转发。把 BookingBars 提升到 grid 层后：
 *        - RoomRow 仅依赖跨帧稳定的 rowName / totalDays / columnWidthPx，
 *          props 引用稳定 → memo 命中 → 横滚时 RoomRow 渲染次数收敛为 0；
 *        - GridBookingBars 单点承接窗口变化，整网格滚动只剩本组件
 *          重渲染。
 * 几何模型：本层与 RoomRow 兄弟节点共处于 .rowsLayer（position:relative）
 *      内的 .barsLayer（position:absolute, inset:0）；坐标系跨整个网格
 *      主体，bar 的：
 *        - top = rowTopByRoomId[roomId] + laneIndex × LANE_HEIGHT_PX
 *                + BAR_OFFSET_TOP_PX
 *          （rowTop 由 BookingGrid 累积每行 `laneCount × LANE_HEIGHT_PX
 *          + 1px border` 得到，laneIndex 由 lib/laneAssignment 区间贪心
 *          着色派生 —— 同房型重叠区间被分到独立 lane 错开堆叠）
 *        - left = LABEL_COLUMN_WIDTH_PX + max(0, startDay) × columnWidthPx
 *          （startDay 为负的 bar 视觉左缘 clamp 到 timeline 起点）
 *        - width = (endDay - max(0, startDay) + 1) × columnWidthPx
 *      bar 始终保持其 lane 内的真实区间几何，越过可视窗左缘的部分由滚动
 *      容器自然裁剪。
 * 文字 sticky：guestName 包在 .barLabel 子元素内，由 CSS `position: sticky;
 *      left: var(--size-row-label-width)` 驱动 —— 滚动容器 .body 是其
 *      scrollport，文字被钉在 sticky label 列右缘的 viewport 位置。bar 跨
 *      可视窗左缘时文字自动贴在视口左边可见；右界天然受 .barLabel 父级
 *      content box（即 .bar 自身）约束，bar 完全滚出时文字随之退出。
 *      此方案纯 CSS、跟随真实 scrollLeft 的像素，不依赖 visibleStartIndex
 *      stepwise 阈值化，文字位移在滚动中逐像素平滑。
 *      前置约束：.bar 必须不建立 scrolling container（否则 sticky 会以
 *      .bar 自身为参照、永不触发）—— .bar 的内容裁剪因此改用 clip-path
 *      而非 overflow:hidden（详见 RoomRow.module.css 的 .bar 规则）。
 * 层叠 / 命中：.barsLayer 自身 pointer-events:none，让非 bar 区域的鼠标
 *      事件穿透到底层 cell / row（保留 :hover 伪类驱动的视觉态）；
 *      bar 元素则恢复 pointer-events:auto 接收 click。
 * 性能：visibleBookings 计算与坐标 mapping 整体 useMemo，仅在 bookings /
 *      可视窗口 / 几何常量变化时重算。
 */
export const GridBookingBars = memo(function GridBookingBars({
  bookings,
  visibleStartIndex,
  visibleEndIndex,
  columnWidthPx,
  rowTopByRoomId,
  laneByBookingId,
  laneHeightPx,
  barOffsetTopPx,
  labelColumnWidthPx,
  dateRangeStart,
  onBookingClick,
}: GridBookingBarsProps) {
  const visibleBookings = useMemo(() => {
    return bookings
      .map((b) => {
        const startDay = diffDays(dateRangeStart, b.checkIn);
        const endDay = diffDays(dateRangeStart, b.checkOut);
        const rowTop = rowTopByRoomId.get(b.roomUnit.roomId);
        const lane = laneByBookingId.get(b.id) ?? 0;
        const color = STATUS_COLOR_VARS[b.status] ?? STATUS_FALLBACK_COLOR;
        return { booking: b, startDay, endDay, rowTop, lane, color };
      })
      .filter(
        ({ startDay, endDay, rowTop }) =>
          rowTop !== undefined &&
          endDay >= visibleStartIndex &&
          startDay <= visibleEndIndex,
      );
  }, [
    bookings,
    rowTopByRoomId,
    laneByBookingId,
    visibleStartIndex,
    visibleEndIndex,
    dateRangeStart,
  ]);

  return (
    <>
      {visibleBookings.map(
        ({ booking, startDay, endDay, rowTop, lane, color }) => {
          const x = labelColumnWidthPx + Math.max(0, startDay * columnWidthPx);
          const y = (rowTop as number) + lane * laneHeightPx + barOffsetTopPx;
          const width = (endDay - Math.max(0, startDay) + 1) * columnWidthPx;
          // 用 inline left/top 而非 transform：父级 transform 会破坏内部
          // .barLabel 的 position:sticky 参照系（实测 sticky 会以 .bar 自身
          // 而非 .body 为 scrollport，导致文字粘在 bar 内固定偏移、不再
          // 跟随真实滚动）。改用 left/top 后 sticky 正确以 .body 为参照。
          // 性能：x / y 不再依赖 scrollLeft，React 浅比对 inline style 不
          // 会触发 DOM 写入；滚动本身由滚动容器整体合成处理，不依赖每条
          // bar 各自开 compositor layer。
          return (
            <div
              key={booking.id}
              className={styles.bar}
              title={`${booking.guestName} (${booking.status})`}
              onClick={() => onBookingClick(booking)}
              style={{
                width: width - 2,
                background: color,
                left: x,
                top: y,
              }}
            >
              {/* 文字 sticky 由 .barLabel 的 CSS position:sticky 驱动，
                  无需 JS 跟踪 scrollLeft / visibleStartIndex；详见样式注释。 */}
              <span className={styles.barLabel}>{booking.guestName}</span>
            </div>
          );
        },
      )}
    </>
  );
});

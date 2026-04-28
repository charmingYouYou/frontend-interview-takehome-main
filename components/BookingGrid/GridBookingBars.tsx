import React, { memo, useMemo } from "react";
import { Booking, RoomUnit } from "@/types";
import { STATUS_COLOR_VARS, STATUS_FALLBACK_COLOR } from "@/lib/bookingStatus";
import { diffDays } from "@/lib/date";
import styles from "./RoomRow.module.css";

interface GridBookingBarsProps {
  /** 全集 bookings；GridBookingBars 在 grid 层一次性渲染所有 bar，避免按行散落。 */
  bookings: Booking[];
  /** 房型有序列表，用于建立 roomId → rowIndex 的映射，决定每条 bar 的 top。 */
  roomUnits: RoomUnit[];
  /** 可视窗口起始 dayIndex；bar 与之相交时左缘吸附实现"sticky-left"视觉。 */
  visibleStartIndex: number;
  /** 可视窗口结束 dayIndex（含），用于数据层窗口过滤。 */
  visibleEndIndex: number;
  /** 单日列宽（px）。 */
  columnWidthPx: number;
  /** 单行行高（px），用于 bar 的 top 计算。 */
  rowHeightPx: number;
  /** bar 在行内的纵向偏移（px），需累加进 inline top。 */
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
 *      内的 .barsLayer（position:absolute, inset:0, padding-top 抵消 bar
 *      的 offset）；坐标系跨整个网格主体，bar 的：
 *        - top = rowIndex × rowHeightPx
 *        - left = LABEL_COLUMN_WIDTH_PX + clippedStart × columnWidthPx
 *          （留出 sticky label 列宽度）
 *        - width = (endDay - clippedStart + 1) × columnWidthPx
 *      其中 `clippedStart = max(startDay, visibleStartIndex)` —— bar 跨过
 *      可视窗左缘时左缘吸附到 visibleStartIndex 处，guestName 横滚中持续
 *      贴可视窗左边可见，右缘锚定真实 endDay 由滚动容器自然裁剪。
 * 层叠 / 命中：.barsLayer 自身 pointer-events:none，让非 bar 区域的鼠标
 *      事件穿透到底层 cell / row（保留 :hover 伪类驱动的视觉态）；
 *      bar 元素则恢复 pointer-events:auto 接收 click。
 * 性能：visibleBookings 计算与坐标 mapping 整体 useMemo，仅在 bookings /
 *      可视窗口 / 几何常量变化时重算。
 */
export const GridBookingBars = memo(function GridBookingBars({
  bookings,
  roomUnits,
  visibleStartIndex,
  visibleEndIndex,
  columnWidthPx,
  rowHeightPx,
  barOffsetTopPx,
  labelColumnWidthPx,
  dateRangeStart,
  onBookingClick,
}: GridBookingBarsProps) {
  // roomId → rowIndex 索引：bar 不再天然属于某一 RoomRow，需在 grid 层
  // 建立映射决定 top；roomUnits 已是有序数组，O(N) 一次性建表即可。
  const rowIndexByRoomId = useMemo(() => {
    const map = new Map<string, number>();
    roomUnits.forEach((room, index) => map.set(room.id, index));
    return map;
  }, [roomUnits]);

  const visibleBookings = useMemo(() => {
    return bookings
      .map((b) => {
        const startDay = diffDays(dateRangeStart, b.checkIn);
        const endDay = diffDays(dateRangeStart, b.checkOut);
        const rowIndex = rowIndexByRoomId.get(b.roomUnit.roomId);
        const color = STATUS_COLOR_VARS[b.status] ?? STATUS_FALLBACK_COLOR;
        return { booking: b, startDay, endDay, rowIndex, color };
      })
      .filter(
        ({ startDay, endDay, rowIndex }) =>
          rowIndex !== undefined &&
          endDay >= visibleStartIndex &&
          startDay <= visibleEndIndex,
      );
  }, [
    bookings,
    rowIndexByRoomId,
    visibleStartIndex,
    visibleEndIndex,
    dateRangeStart,
  ]);

  return (
    <>
      {visibleBookings.map(
        ({ booking, startDay, endDay, rowIndex, color }) => {
          const clippedStart = Math.max(startDay, visibleStartIndex);
          const x = labelColumnWidthPx + clippedStart * columnWidthPx;
          const y = (rowIndex as number) * rowHeightPx + barOffsetTopPx;
          const width = (endDay - clippedStart + 1) * columnWidthPx;
          // 用 transform: translate3d 推动位置而非 inline left/top：滚动改写
          // 仅触发 compositor 重新摆位，跳过 layout / paint；translate3d 的
          // 第三参（z=0）显式声明 GPU 合成层，与 .bar 上的 will-change:
          // transform 配合稳定开层。
          return (
            <div
              key={booking.id}
              className={styles.bar}
              title={`${booking.guestName} (${booking.status})`}
              onClick={() => onBookingClick(booking)}
              style={{
                width: width - 2,
                background: color,
                transform: `translate3d(${x}px, ${y}px, 0)`,
              }}
            >
              {booking.guestName}
            </div>
          );
        },
      )}
    </>
  );
});

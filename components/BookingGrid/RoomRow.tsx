import React, { useMemo } from "react";
import { Booking, BookingStatus } from "@/types";
import { diffDays } from "@/lib/date";
import styles from "./RoomRow.module.css";

export interface HoveredCell {
  rowId: string;
  dayIndex: number;
}

interface RoomRowProps {
  rowId: string;
  rowName: string;
  bookings: Booking[];
  visibleStartIndex: number;
  visibleEndIndex: number;
  /** 日历窗口总天数；当前组件未直接消费，作为父级显式契约保留以便未来扩展。 */
  totalDays: number;
  /** 单日列宽（px），由父级 BookingGrid 从 BOOKING_CONFIG 透传，避免子组件直读单例。 */
  columnWidthPx: number;
  /** 时间窗起点（ISO 日期），由父级 BookingGrid 注入，避免组件直读全局 config。 */
  dateRangeStart: string;
  /** 当前悬停格（Grid 范围内单一事实），由父级集中维护并透传。 */
  hoveredCell: HoveredCell | null;
  /** 上报本行的 cell hover 变化；传 null 表示离开。 */
  onHoverCell: (cell: HoveredCell | null) => void;
  onBookingClick: (booking: Booking) => void;
}

/**
 * Booking 状态到 token 的映射。
 *
 * 取值统一指向 styles/tokens.css 中的 --color-status-* 变量，使颜色定义
 * 集中在 token 层；组件只持有「状态 → 变量名」的逻辑映射，避免在组件
 * 内重复维护 hex 字面量。
 */
const STATUS_COLOR_VARS: Record<BookingStatus, string> = {
  confirmed: "var(--color-status-confirmed)",
  pending: "var(--color-status-pending)",
  in_house: "var(--color-status-in-house)",
  checked_out: "var(--color-status-checked-out)",
  cancelled: "var(--color-status-cancelled)",
};

const STATUS_FALLBACK_COLOR = "var(--color-status-fallback)";

/**
 * 拼接 className，过滤掉 falsy 值（用于条件挂载 hover 类）。
 */
function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/**
 * RoomRow：渲染单个房型在可视时间窗内的预订情况。
 *
 * 配置来源：列宽 columnWidthPx 与日历窗口起点 dateRangeStart 由父级
 *          BookingGrid 通过 props 显式透传（数据来源仍为 BOOKING_CONFIG），
 *          保持单向数据流与可注入接口；hoveredCell 同样由父级集中维护。
 *          totalDays 当前组件不直接消费，但仍声明为 props 字段以稳定契约
 *          供未来扩展使用。
 * 视觉规格：所有静态样式（颜色 / 间距 / 尺寸 / 圆角 / 动效）来自
 *          RoomRow.module.css + tokens.css；仅 left/width 等几何计算结果
 *          以 inline style 注入。
 */
export function RoomRow({
  rowId,
  rowName,
  bookings,
  visibleStartIndex,
  visibleEndIndex,
  totalDays,
  columnWidthPx,
  dateRangeStart,
  hoveredCell,
  onHoverCell,
  onBookingClick,
}: RoomRowProps) {
  console.log("render", rowId);

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

  const isHovered = hoveredCell?.rowId === rowId;

  return (
    <div className={cx(styles.row, isHovered && styles.rowHovered)}>
      <div className={styles.label}>{rowName}</div>

      <div className={styles.timeline}>
        {/* 日格背景：等宽栅格，承载 cell hover 状态 */}
        {Array.from(
          { length: visibleEndIndex - visibleStartIndex + 1 },
          (_, i) => {
            const dayIndex = visibleStartIndex + i;
            const isCellHovered =
              hoveredCell?.rowId === rowId &&
              hoveredCell?.dayIndex === dayIndex;
            return (
              <div
                key={dayIndex}
                className={cx(styles.cell, isCellHovered && styles.cellHovered)}
                style={{
                  left: (dayIndex - visibleStartIndex) * columnWidthPx,
                  width: columnWidthPx,
                }}
                onMouseEnter={() => onHoverCell({ rowId, dayIndex })}
                onMouseLeave={() => onHoverCell(null)}
              />
            );
          },
        )}

        {/* 预订条：跨日色块 */}
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
      </div>
    </div>
  );
}

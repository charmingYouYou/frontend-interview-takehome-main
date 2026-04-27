import React, { useMemo } from "react";
import { Booking, BookingStatus } from "@/types";
import { useAppContext } from "@/context/AppContext";
import styles from "./RoomRow.module.css";

const COLUMN_WIDTH_PX = 48;

interface RoomRowProps {
  rowId: string;
  rowName: string;
  bookings: Booking[];
  visibleStartIndex: number;
  visibleEndIndex: number;
  totalDays: number;
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
 * 视觉规格：所有静态样式（颜色 / 间距 / 尺寸 / 圆角 / 动效）来自
 * RoomRow.module.css + tokens.css；仅 left/width 等几何计算结果
 * 以 inline style 注入。
 */
export function RoomRow({
  rowId,
  rowName,
  bookings,
  visibleStartIndex,
  visibleEndIndex,
  totalDays,
  onBookingClick,
}: RoomRowProps) {
  console.log("render", rowId);

  const { hoveredCell, setHoveredCell, config } = useAppContext();

  const visibleBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        const startDay = Math.floor(
          (new Date(b.checkIn).getTime() -
            new Date(config.dateRangeStart).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const endDay = Math.floor(
          (new Date(b.checkOut).getTime() -
            new Date(config.dateRangeStart).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return endDay >= visibleStartIndex && startDay <= visibleEndIndex;
      })
      .map((b) => {
        const startDay = Math.floor(
          (new Date(b.checkIn).getTime() -
            new Date(config.dateRangeStart).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const endDay = Math.floor(
          (new Date(b.checkOut).getTime() -
            new Date(config.dateRangeStart).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const color = STATUS_COLOR_VARS[b.status] ?? STATUS_FALLBACK_COLOR;
        return { booking: b, startDay, endDay, color };
      });
  }, [bookings, visibleStartIndex, visibleEndIndex, config.dateRangeStart]);

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
                  left: (dayIndex - visibleStartIndex) * COLUMN_WIDTH_PX,
                  width: COLUMN_WIDTH_PX,
                }}
                onMouseEnter={() => setHoveredCell({ rowId, dayIndex })}
                onMouseLeave={() => setHoveredCell(null)}
              />
            );
          },
        )}

        {/* 预订条：跨日色块 */}
        {visibleBookings.map(({ booking, startDay, endDay, color }) => {
          const left = Math.max(
            0,
            (startDay - visibleStartIndex) * COLUMN_WIDTH_PX,
          );
          const width =
            (Math.min(endDay, visibleEndIndex) -
              Math.max(startDay, visibleStartIndex) +
              1) *
            COLUMN_WIDTH_PX;
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

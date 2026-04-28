import React, { memo } from "react";
import styles from "./RoomRow.module.css";

interface RoomRowProps {
  rowName: string;
  /** 日历窗口总天数，用于日格背景全量渲染。 */
  totalDays: number;
  /** 单日列宽（px），由父级 BookingGrid 从 BOOKING_CONFIG 透传，避免子组件直读单例。 */
  columnWidthPx: number;
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

/**
 * RoomRow：渲染单个房型行的几何骨架（label + 日格背景）。
 *
 * 重构（BookingBars 提升）后职责收窄：
 *   - 本组件不再持有 bookings / visibleRange / onBookingClick，仅依赖
 *     rowName / totalDays / columnWidthPx 三个跨帧稳定的输入；
 *   - 预订条 bar 的渲染整体上移到 BookingGrid 层的 GridBookingBars，
 *     使用 rowIndex × ROW_HEIGHT_PX 在二维坐标系中绝对定位；
 *   - 横滚时滚动容器只触发顶层组件 + GridBookingBars 重渲染，
 *     RoomRow 的 props 始终引用稳定，配合 React.memo 浅比较直接跳过，
 *     N 行函数体执行 → 0。
 * Hover 表达：行 / 日格 hover 视觉态全部由 CSS `:hover` 伪类承载，无
 *          JS 状态、无父组件 setState、无渲染链路开销。
 * 视觉规格：所有静态样式（颜色 / 间距 / 尺寸 / 圆角 / 动效）来自
 *          RoomRow.module.css + tokens.css；仅日格 left/width 几何值
 *          以 inline style 注入。
 */
export function RoomRowImpl({
  rowName,
  totalDays,
  columnWidthPx,
}: RoomRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>{rowName}</div>

      <div className={styles.timeline}>
        {/* 几何层：全量日格背景，永不重渲染 */}
        <DayCells totalDays={totalDays} columnWidthPx={columnWidthPx} />
      </div>
    </div>
  );
}

export const RoomRow = memo(RoomRowImpl);

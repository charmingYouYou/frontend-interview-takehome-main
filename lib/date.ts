import dayjs, { Dayjs } from 'dayjs'

/**
 * 项目统一日期工具层。
 *
 * 职责：收敛所有 `new Date()` / 时间戳运算 / 日期格式化逻辑，作为日期处理
 *      的单一事实来源；其余模块（组件、hook、配置、mock 数据）禁止再裸用
 *      `new Date(...)` 与字符串拼接式格式化，统一通过本文件导出的函数消费。
 *
 * 设计动机：
 * 1. 一致性：原代码在 `BookingGrid` / `RoomRow` / `bookingConfig` /
 *    `mockData` 共 8+ 处独立调用 `new Date()`，跨日边界（如 23:59 → 00:01）
 *    会让"今天"在不同文件取到不同值，产生 off-by-one 的视觉漂移。集中
 *    入口后，仅在工具层一处取系统当前时间，且支持注入"基准时间"以保证
 *    单次渲染周期内的强一致。
 * 2. 可替换性：底层选用 dayjs（不可变 API、跨时区一致、< 3KB），后续若
 *    扩展时区、农历、相对时间等能力可在此处增加 plugin，调用方零改动。
 * 3. 类型友好：所有公开函数以 ISO 日期字符串（`YYYY-MM-DD`）为主输入类型，
 *    避免 Date 实例在 JSON / props / SWR 缓存中的序列化心智，保持纯字符串
 *    单向数据流。
 *
 * 输入输出约定：
 * - 凡涉及"日期"的参数与返回值均使用 `YYYY-MM-DD` 字符串；
 * - 跨日天数差以"自然日"为单位（按本地时区切日），不引入小时/分钟概念；
 * - 函数均为纯函数，无副作用，可安全在 useMemo / SSR 中调用。
 */

/** ISO 日期字符串别名，提示调用方此处期望 `YYYY-MM-DD` 形态而非任意 string。 */
export type IsoDate = string

const ISO_DATE_FORMAT = 'YYYY-MM-DD'

/**
 * 取"今天"的 ISO 日期字符串。
 *
 * 使用约定：调用方应**仅在模块求值期**取一次（赋给模块级 const 锚点），
 * 后续衍生值通过 `addDays` 派生；禁止在组件渲染、事件回调等运行时路径
 * 上反复调用，以避免 23:59 → 00:01 边界产生跨日漂移。当前项目仅
 * `lib/bookingConfig` / `lib/mockData` 各取一次锚点，新增调用点请同样
 * 遵循此约定。
 */
export function today(): IsoDate {
  return dayjs().format(ISO_DATE_FORMAT)
}

/**
 * 在给定 ISO 日期上加 / 减 N 天，返回新的 ISO 日期字符串。
 * 负数表示向过去偏移。
 */
export function addDays(date: IsoDate, days: number): IsoDate {
  return dayjs(date).add(days, 'day').format(ISO_DATE_FORMAT)
}

/**
 * 计算两个 ISO 日期之间相差的自然日数（end - start）。
 *
 * 用于把日期差归一为整数天，替代原代码中
 * `(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24)` 的手算样板，
 * 同时规避夏令时切换导致的非整数误差。
 */
export function diffDays(start: IsoDate, end: IsoDate): number {
  return dayjs(end).startOf('day').diff(dayjs(start).startOf('day'), 'day')
}

/**
 * 把 ISO 日期格式化为 "M/D" 形式（如 4/27），用于网格表头日期标签。
 */
export function formatMonthDay(date: IsoDate): IsoDate {
  return dayjs(date).format('M/D')
}

/**
 * 以给定起点日期生成连续 length 天的 "M/D" 标签数组。
 * 抽出此封装是为了让 BookingGrid 表头的标签生成与"逐日加 1"逻辑解耦。
 */
export function buildDayLabels(start: IsoDate, length: number): string[] {
  const base: Dayjs = dayjs(start)
  return Array.from({ length }, (_, i) => base.add(i, 'day').format('M/D'))
}

import { BookingConfig } from '@/types'

/**
 * Booking 网格配置单例。
 *
 * 取代原 AppContext.defaultConfig：将散落在 BookingGrid / RoomRow /
 * useVisibleRange 中的魔法数字（列宽 48、标签列宽 140、总天数 30、
 * 单屏可视列数 14）与日历窗口范围统一收敛为一份单例配置，组件与 hook
 * 通过 import 直接消费。表头背景色 #e8f4fc 已迁移至 token 层
 * --color-bg-booking-header，由 CSS Module 直接消费，不再保留为 JS 字段。
 *
 * 命名规范：
 * - 常量本身使用 UPPER_SNAKE_CASE：`BOOKING_CONFIG`；
 * - 配置字段同样使用 UPPER_SNAKE_CASE（如 `COLUMN_WIDTH_PX`）：这些值
 *   是编译期已知的不可变配置量，不同于组件内部状态（驼峰），统一大写
 *   字段名可在调用点一眼识别"这是配置常量"，避免与运行时 state 混淆。
 *
 * 设计取舍：
 * - 这些字段在运行时从未被外部写入，是不可变默认值，因此选择模块级
 *   常量而非 Context / Provider，避免一份不变的数据被订阅链路重复包装；
 * - 命名从 APP_CONFIG → BOOKING_CONFIG：原有字段全部为 Booking 网格
 *   专属（日历窗口、列宽、表头），App 级抽象既不准确也不可复用，
 *   收窄到 Booking 域可让职责一目了然，未来若有 Messages / 其他域
 *   配置可独立新增 *Config 文件而非耦合到此处。
 *
 * 注：DATE_RANGE_START / DATE_RANGE_END 仍以模块求值期 new Date() 计算；
 * 如需在 "23:59 → 00:01" 类跨日边界保持稳定，应迁移到统一日期工具层
 * （见 DECISIONS.md 第 5 条），本次重构保持原行为不动。
 */
export const BOOKING_CONFIG: BookingConfig = {
  DATE_RANGE_START: new Date().toISOString().split('T')[0],
  DATE_RANGE_END: (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })(),
  COLUMN_WIDTH_PX: 48,
  LABEL_COLUMN_WIDTH_PX: 140,
  TOTAL_DAYS: 30,
  VISIBLE_COLUMNS: 14,
}

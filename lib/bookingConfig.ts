import { BookingConfig } from '@/types'
import { addDays, today } from '@/lib/date'

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
 * 日期取值：模块求值期通过 `lib/date.today()` 一次性取得 DATE_RANGE_START
 * 锚点，DATE_RANGE_END 基于同一锚点 `addDays` 派生，避免在同一模块内多
 * 次读取系统时间产生 23:59 → 00:01 边界 off-by-one 的窗口漂移。
 */
const TOTAL_DAYS = 30
const DATE_RANGE_START: string = today()

export const BOOKING_CONFIG: BookingConfig = {
  DATE_RANGE_START,
  DATE_RANGE_END: addDays(DATE_RANGE_START, TOTAL_DAYS),
  COLUMN_WIDTH_PX: 48,
  LABEL_COLUMN_WIDTH_PX: 140,
  // 行视觉占位高度（"行 stride"，下一行起点相对当前行起点的 y 偏移）：
  //   = token --size-row-height (40, 内容高) + .row border-bottom (1px) = 41。
  // 不要与 --size-row-height 直接对齐：后者是 .label / .timeline / .cell 的内容
  // 区高度，行整体因 border-bottom 还要再占 1px。GridBookingBars 通过
  // top = rowIndex × ROW_HEIGHT_PX 计算 bar 纵向位置，若误用 40 会每跨一行
  // 累积漂移（rowIndex=25 处实测 -19px，bar 越往下越上抬到上一行）。
  // 若未来 .row 的分隔线方案变化（例如改用 box-shadow 或独立网格层），需同步
  // 调整本值；为减少漂移再现风险，可考虑迁移到 ResizeObserver 实测行 stride。
  ROW_HEIGHT_PX: 41,
  // 必须与 styles/tokens.css 中 --size-bar-offset-top 保持一致：
  // bar 在行内的顶部偏移由 GridBookingBars 累加进 inline top，无法
  // 通过容器 padding-top 实现（absolute 子元素 top:0 参照 padding box）。
  BAR_OFFSET_TOP_PX: 6,
  TOTAL_DAYS,
  VISIBLE_COLUMNS: 14,
}

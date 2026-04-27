/**
 * Booking 状态域：枚举 + 展示元数据的单一事实来源。
 *
 * 收敛动机：原 BookingStatus 以 string union 形式定义于 types/index.ts，
 * 同时 STATUS_LABELS（BookingDrawer）与 STATUS_COLOR_VARS（RoomRow）以
 * 同义字面量 key 在多个组件中独立维护，存在三类风险：
 *   (1) 字面量分散（'in_house' / 'pending' …）改动时无法被编译器收束；
 *   (2) Record<BookingStatus, T> 漏写某状态不会被静态发现 —— issue 8 中
 *       getStatusPillClass 缺失 'pending' 即为此类典型；
 *   (3) 不同组件对状态的展示（label / color / pill class）各持一份，新增
 *       状态需要跨文件改动，易遗漏。
 *
 * 设计：
 * - 用 string enum 提供成员名 → 字符串值的 nominal 类型，运行时值与原
 *   union 字面量保持一致，mock 数据 / 服务端 payload 不需要迁移；
 * - STATUS_LABELS / STATUS_COLOR_VARS 在此处一并维护，类型签名为
 *   Record<BookingStatus, …>，新增枚举成员时编译器强制补齐。
 *
 * 注：状态 → Pill 修饰类的映射在此以"CSS Module key 名"形式承载（不直接
 * 持有 styles 对象引用），调用方通过 `styles[STATUS_PILL_CLASS_NAMES[status]]`
 * 完成最终解引用 —— 既保留 CSS Modules 的局部作用域优势，又把"哪些状态
 * 需要哪个修饰类"这条业务事实集中在状态域单一模块。
 */

export enum BookingStatus {
  Confirmed = 'confirmed',
  Pending = 'pending',
  InHouse = 'in_house',
  CheckedOut = 'checked_out',
  Cancelled = 'cancelled',
}

/**
 * 状态展示文案（英文 Title Case）。
 * 单一事实来源：所有 UI 文案从此处取，未来切 i18n 仅改本文件。
 */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.Confirmed]: 'Confirmed',
  [BookingStatus.Pending]: 'Pending',
  [BookingStatus.InHouse]: 'In House',
  [BookingStatus.CheckedOut]: 'Checked Out',
  [BookingStatus.Cancelled]: 'Cancelled',
}

/**
 * 状态 → token 变量的映射（供 BookingGrid 预订条背景色使用）。
 * 颜色定义集中在 styles/tokens.css，本表只维护"语义 → 变量名"的逻辑映射。
 */
export const STATUS_COLOR_VARS: Record<BookingStatus, string> = {
  [BookingStatus.Confirmed]: 'var(--color-status-confirmed)',
  [BookingStatus.Pending]: 'var(--color-status-pending)',
  [BookingStatus.InHouse]: 'var(--color-status-in-house)',
  [BookingStatus.CheckedOut]: 'var(--color-status-checked-out)',
  [BookingStatus.Cancelled]: 'var(--color-status-cancelled)',
}

export const STATUS_FALLBACK_COLOR = 'var(--color-status-fallback)'

/**
 * 状态 → CSS Module 类名（字符串 key，非 styles 引用）。
 *
 * 调用方用法：`styles[STATUS_PILL_CLASS_NAMES[status]] ?? styles.statusPillDefault`
 * 选择只持有 key 名而非 styles[...] 解引用结果的原因：
 *   (1) 避免本模块与某个 CSS Module 文件耦合（多组件复用同一映射时，各
 *       自的 styles 对象相同 key 即可生效）；
 *   (2) CSS Module 的 styles 对象需在打包期确定，状态域作为业务层模块
 *       不应承担打包期解引用职责。
 */
export const STATUS_PILL_CLASS_NAMES: Record<BookingStatus, string> = {
  [BookingStatus.Confirmed]: 'statusPillConfirmed',
  [BookingStatus.Pending]: 'statusPillPending',
  [BookingStatus.InHouse]: 'statusPillInHouse',
  [BookingStatus.CheckedOut]: 'statusPillCheckedOut',
  [BookingStatus.Cancelled]: 'statusPillCancelled',
}

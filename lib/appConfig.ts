import { AppConfig } from '@/types'

/**
 * 应用级静态配置常量。
 *
 * 取代原 AppContext 中的 defaultConfig：这些字段在运行时从未被外部写入，
 * 仅作为只读默认值被 Booking 相关组件消费。以模块常量形式导出后，调用方
 * 直接 import 使用，无需 Provider/订阅链路，也避免了一份不变的数据被
 * Context 重复包装造成的渲染抖动与心智成本。
 *
 * 注：dateRangeStart/dateRangeEnd 仍以模块求值期 new Date() 计算；如需在
 * "23:59 → 00:01" 类跨日边界保持稳定，应迁移到统一日期工具层（见
 * DECISIONS.md 第 4 条），本次重构保持原行为不动。
 */
export const APP_CONFIG: AppConfig = {
  dateRangeStart: new Date().toISOString().split('T')[0],
  dateRangeEnd: (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })(),
  columnWidthPx: 48,
  visibleColumnsBuffer: 2,
  bookingHeaderBackground: '#e8f4fc',
}

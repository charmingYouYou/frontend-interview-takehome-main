import { Booking } from '@/types'
import { diffDays } from '@/lib/date'

/**
 * 同房型 booking 重叠的 lane（泳道）分配结果。
 *
 * - laneByBookingId：每条 booking 在所属 room 行内被分到的 lane 索引
 *   （0-based，0 即"最上方那条"）；GridBookingBars 用其计算 bar 的 y。
 * - laneCountByRoomId：每个 room 的最大并发 lane 数（≥1，无 booking 时
 *   亦视为 1，保留单 lane 的最小行高）；RoomRow 用其撑出动态行高，
 *   BookingGrid 用其累积每行的 top offset。
 */
export interface LaneAssignment {
  laneByBookingId: Map<string, number>
  laneCountByRoomId: Map<string, number>
}

/**
 * 同房型 booking 的 lane（泳道）分配 —— 经典区间贪心着色。
 *
 * 业务背景：同一 roomId 下若存在时间区间重叠的多条 booking（如换房中转 /
 *      改期 / 数据生成器碰撞），单 lane 直接渲染会让 bar 几何相互覆盖、
 *      用户看不到完整数据。本函数把每条 booking 分到一条独立 lane，使
 *      RoomRow 行高按最大并发度自适应展开，业务上等价于行业 PMS（Cloudbeds
 *      / Mews）的 swim lane 布局。
 *
 * 算法（O(N log N) per room）：
 *   1. 按 roomId 分组，组内按 (startDay, endDay) 升序；
 *   2. 维护 lanes 数组，lanes[i] = 第 i 条 lane 上最近一条 booking 的 endDay；
 *   3. 对每条 booking，线性扫描 lanes 找到最早一条满足 lanes[i] < startDay
 *      的 lane（即"上一条已结束"）即可复用；找不到则开新 lane；
 *   4. lanes.length 即该 room 的最大并发度（laneCount）。
 *
 * 重叠判定 `<` 而非 `<=`：bar 的视觉宽度按 (endDay - startDay + 1) 列计算
 *      —— 即 endDay 那一列也被 bar 占满；故 prev.endDay == curr.startDay 时
 *      仍视为重叠，需开新 lane。如未来改为"checkOut 日不占列"语义，需把
 *      条件放宽为 `lanes[i] <= start`。
 *
 * 稳定性：startDay 相同时按 endDay 二级排序，保证同 startDay 多条 booking
 *      的 lane 顺序与输入顺序无关，跨重渲染稳定，便于 React.memo 命中。
 *
 * 不修改入参：函数内对每个 room 的子数组单独排序（拷贝），不污染外部
 *      bookings 引用，配合上层 useMemo 即可保证返回引用稳定。
 */
export function assignLanes(
  bookings: Booking[],
  dateRangeStart: string,
): LaneAssignment {
  const byRoom = new Map<string, Booking[]>()
  for (const b of bookings) {
    const list = byRoom.get(b.roomUnit.roomId)
    if (list) list.push(b)
    else byRoom.set(b.roomUnit.roomId, [b])
  }

  const laneByBookingId = new Map<string, number>()
  const laneCountByRoomId = new Map<string, number>()

  byRoom.forEach((list, roomId) => {
    const sorted = [...list].sort((a, b) => {
      const sa = diffDays(dateRangeStart, a.checkIn)
      const sb = diffDays(dateRangeStart, b.checkIn)
      if (sa !== sb) return sa - sb
      const ea = diffDays(dateRangeStart, a.checkOut)
      const eb = diffDays(dateRangeStart, b.checkOut)
      return ea - eb
    })

    const lanes: number[] = []
    for (const booking of sorted) {
      const start = diffDays(dateRangeStart, booking.checkIn)
      const end = diffDays(dateRangeStart, booking.checkOut)
      let placed = -1
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] < start) {
          lanes[i] = end
          placed = i
          break
        }
      }
      if (placed === -1) {
        lanes.push(end)
        placed = lanes.length - 1
      }
      laneByBookingId.set(booking.id, placed)
    }
    laneCountByRoomId.set(roomId, Math.max(1, lanes.length))
  })

  return { laneByBookingId, laneCountByRoomId }
}

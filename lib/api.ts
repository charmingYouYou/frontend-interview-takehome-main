import useSWR, { useSWRConfig, SWRConfiguration } from 'swr'
import { Booking, BookingDetail, Ticket } from '@/types'

/**
 * 统一请求层 —— 项目内所有 SWR / fetch 调用的单一入口。
 *
 * 整合了三类原本散落在 4 个文件中的样板：
 * 1. fetcher 实现（res.ok 校验 + JSON 解析）
 * 2. SWR key（API 路径字符串字面量）
 * 3. 各领域读 / 写 hook（useBookings / useTickets / markTicketRead 等）
 *
 * 收敛后：调用方只需 `import { useBookings } from '@/lib/api'`，无需再
 * 自带 fetcher、不再硬编码路径字面量、错误响应统一抛出便于上层处理。
 */

/**
 * 集中的 API 端点表。
 *
 * 所有 fetch / useSWR 的 URL 必须从这里取值，禁止在调用方写裸字符串。
 * 静态路径用常量，含路径参数的用函数生成；改路径只需在此处改一处。
 */
export const API_ENDPOINTS = {
  bookings: '/api/bookings',
  bookingDetail: (id: string) => `/api/bookings/${id}`,
  tickets: '/api/tickets',
  ticketRead: (id: string) => `/api/tickets/${id}/read`,
} as const

/**
 * 抛错型 GET fetcher。
 *
 * 与原各处复制的 `(url) => fetch(url).then(r => r.json())` 不同：
 * 显式校验 res.ok，非 2xx 抛 HttpError 以便 SWR 触发 onError 链路，
 * 避免把 4xx/5xx body 当成正常 JSON 渲染。
 */
async function httpGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new HttpError(`GET ${url} failed: ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * 抛错型 POST 客户端。可选 JSON body；返回 JSON 解析后的响应。
 */
async function httpPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new HttpError(`POST ${url} failed: ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * HTTP 层错误类型，携带 status 便于上层精细分支处理。
 */
export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'HttpError'
  }
}

/* === 领域 hooks ============================================== */

/** 拉取 Booking 列表（首页日历用）。 */
export function useBookings(config?: SWRConfiguration<Booking[]>) {
  return useSWR<Booking[]>(API_ENDPOINTS.bookings, httpGet, config)
}

/**
 * 拉取单条 Booking 详情；id 为 null 时不发起请求（SWR conditional key）。
 */
export function useBookingDetail(
  id: string | null | undefined,
  config?: SWRConfiguration<BookingDetail>,
) {
  return useSWR<BookingDetail>(
    id ? API_ENDPOINTS.bookingDetail(id) : null,
    httpGet,
    config,
  )
}

/** 拉取 Ticket 列表（Sidebar 与 /messages 共用同一 key）。 */
export function useTickets(config?: SWRConfiguration<Ticket[]>) {
  return useSWR<Ticket[]>(API_ENDPOINTS.tickets, httpGet, config)
}

/* === 写操作 ================================================= */

/**
 * 调用 markTicketRead 时所需的 mutate 引用类型，等价于 useSWRConfig().mutate。
 */
type MutateFn = ReturnType<typeof useSWRConfig>['mutate']

/**
 * 把指定 ticket 标记为已读（乐观更新 + 远端写入 + revalidate 兜底）。
 *
 * 调用方传入 mutate（来自 useSWRConfig），本函数封装了三步走模板：
 * (a) optimisticData 立即把缓存中对应 ticket.unread 改为 false，列表
 *     红点与 Sidebar 徽标无需等待网络即时收敛；
 * (b) mutator 内 POST 远端持久化；
 * (c) revalidate=true 在请求完成后用服务端真值再回填一次；
 * 任一步失败则 rollbackOnError 回滚到先前缓存。
 */
export function markTicketRead(mutate: MutateFn, ticketId: string) {
  return mutate<Ticket[]>(
    API_ENDPOINTS.tickets,
    async (current) => {
      await httpPost<Ticket>(API_ENDPOINTS.ticketRead(ticketId))
      return current?.map(t => t.id === ticketId ? { ...t, unread: false } : t)
    },
    {
      optimisticData: (current) =>
        current?.map(t => t.id === ticketId ? { ...t, unread: false } : t) ?? [],
      rollbackOnError: true,
      populateCache: true,
      revalidate: true,
    },
  )
}

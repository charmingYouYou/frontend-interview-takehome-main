import type { NextApiRequest, NextApiResponse } from 'next'
import { TICKETS } from '@/lib/mockData'
import { Ticket } from '@/types'

/**
 * POST /api/tickets/:id/read —— 将指定 ticket 标记为已读。
 *
 * 职责：在内存态的 mockData TICKETS 上对 `unread` 字段做幂等置 false，
 *       并返回最新 ticket 实体。前端用本接口把"用户访问 ticket"这一
 *       UI 行为提交为后端持久化事实，并配合 SWR 乐观更新与重校验。
 * 输入：路径参数 id（ticket 主键）。无 body。
 * 输出：200 + 最新 Ticket；404 当 id 不存在；405 当方法非 POST。
 * 边界：mockData 为进程内单例，重启后会复位；非 idempotency 关键场景，
 *       多次调用结果一致。生产实现应替换为持久层 + 鉴权校验。
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ticket | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { id } = req.query
  const ticket = TICKETS.find(t => t.id === id)
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  ticket.unread = false

  setTimeout(() => {
    res.status(200).json(ticket)
  }, 200)
}

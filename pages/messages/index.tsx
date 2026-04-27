import React from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import useSWR, { useSWRConfig } from 'swr'
import { Ticket } from '@/types'
import styles from './index.module.css'

const TICKETS_KEY = '/api/tickets'

interface MessagesPageProps {
  initialTicketId: string | null
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * 拼接 className，过滤掉 falsy 值（与 RoomRow 中 cx 同义，用于 active/unread 等状态叠加）。
 */
function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}

/**
 * Messages 页：
 * - 左侧 ticket 列表 + 右侧消息视图的两栏布局
 * - active / unread 状态通过条件 className 切换，避免 inline style 三元
 * - 所有静态样式来自 messages/index.module.css + tokens.css
 *
 * 状态归属（本次重构调整）：原 MessagesContext 中维护的 currentHouse /
 * activeTicketId / unreadCount 已就地下沉。activeTicketId 由 URL query
 * 派生（已是路由真理来源），unreadCount 由 Sidebar 通过同一 SWR key
 * 直接派生，currentHouse 同样从 query 读取。本页面因此不再需要订阅
 * 任何全局 Context，去掉了"页面 setUnreadCount → context → Sidebar"
 * 这条易失同步链路。
 */
const MessagesPage: NextPage<MessagesPageProps> = ({ initialTicketId }) => {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const { data: tickets } = useSWR<Ticket[]>(TICKETS_KEY, fetcher)

  // Use ticketId from URL query, fallback to SSR initial prop
  const currentTicketId = (router.query.ticketId as string) ?? initialTicketId

  /**
   * 命中未读 ticket 时同步把 unread 置为已读：
   * - 乐观更新：先在 SWR 缓存里把对应 ticket.unread 改为 false，使列表
   *   红点与 Sidebar 徽标即时收敛，无需等待网络回环；revalidate=false
   *   避免在请求飞行期间被新一轮 GET 覆盖回未读态；
   * - 远端写入：POST /api/tickets/:id/read 持久化已读事实；
   * - 真值兜底：写入完成后再触发一次 revalidate，用服务端权威数据
   *   修正乐观值；任一步失败则回滚到先前缓存（rollbackOnError）。
   */
  const markTicketRead = (ticketId: string) => {
    mutate<Ticket[]>(
      TICKETS_KEY,
      async (current) => {
        await fetch(`/api/tickets/${ticketId}/read`, { method: 'POST' })
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

  const handleTicketClick = (ticket: Ticket) => {
    if (ticket.unread) markTicketRead(ticket.id)
    router.push(`/messages?ticketId=${ticket.id}&houseId=${ticket.houseId}`)
  }

  const activeTicket = tickets?.find(t => t.id === currentTicketId)

  return (
    <div className={styles.page}>
      {/* Ticket list */}
      <div className={styles.ticketList}>
        <div className={styles.ticketListHeader}>
          Messages
        </div>

        {tickets?.map(ticket => {
          const isActive = ticket.id === currentTicketId
          return (
            <div
              key={ticket.id}
              onClick={() => handleTicketClick(ticket)}
              className={cx(styles.ticketItem, isActive && styles.ticketItemActive)}
            >
              <div className={styles.ticketHeader}>
                <span className={cx(styles.ticketGuest, ticket.unread && styles.ticketGuestUnread)}>
                  {ticket.guestName}
                </span>
                {ticket.unread && (
                  <span className={styles.unreadDot} />
                )}
              </div>
              <div className={cx(styles.ticketSubject, ticket.unread && styles.ticketSubjectUnread)}>
                {ticket.subject}
              </div>
              <div className={styles.ticketPreview}>
                {ticket.lastMessage}
              </div>
              <div className={styles.ticketHouse}>
                {ticket.houseName}
              </div>
            </div>
          )
        })}
      </div>

      {/* Message view */}
      <div className={styles.messageView}>
        {activeTicket ? (
          <div className={styles.messageContent}>
            <h2 className={styles.messageTitle}>{activeTicket.subject}</h2>
            <p className={styles.messageMeta}>
              {activeTicket.guestName} · {activeTicket.houseName}
            </p>
            <div className={styles.messageBubble}>
              {activeTicket.lastMessage}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            Select a message to view
          </div>
        )}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const ticketId = (context.query.ticketId as string) ?? null
  return {
    props: {
      initialTicketId: ticketId,
    },
  }
}

export default MessagesPage

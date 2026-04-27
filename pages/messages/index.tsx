import React from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import { useSWRConfig } from 'swr'
import { Ticket } from '@/types'
import { useTickets, markTicketRead } from '@/lib/api'
import styles from './index.module.css'

interface MessagesPageProps {
  initialTicketId: string | null
}

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
  const { data: tickets } = useTickets()

  // Use ticketId from URL query, fallback to SSR initial prop
  const currentTicketId = (router.query.ticketId as string) ?? initialTicketId

  const handleTicketClick = (ticket: Ticket) => {
    // 命中未读 ticket 时由统一请求层完成乐观更新 + 远端写入 + revalidate
    if (ticket.unread) markTicketRead(mutate, ticket.id)
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

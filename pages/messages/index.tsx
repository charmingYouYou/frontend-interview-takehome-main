import React, { useEffect } from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import useSWR from 'swr'
import { Ticket } from '@/types'
import { useMessagesContext } from '@/context/MessagesContext'
import styles from './index.module.css'

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
 * 行为契约（不在本次重构中改动）：SWR key、router.push 路由、
 * getServerSideProps、useMessagesContext 调用与原实现保持一致。
 */
const MessagesPage: NextPage<MessagesPageProps> = ({ initialTicketId }) => {
  const router = useRouter()
  const { activeTicketId, setActiveTicketId, setUnreadCount } = useMessagesContext()
  const { data: tickets } = useSWR<Ticket[]>('/api/tickets', fetcher)

  // Sync unread count into context
  useEffect(() => {
    if (tickets) {
      setUnreadCount(tickets.filter(t => t.unread).length)
    }
  }, [tickets, setUnreadCount])

  // Use ticketId from URL or prop
  const currentTicketId = (router.query.ticketId as string) ?? initialTicketId ?? activeTicketId

  const handleTicketClick = (ticket: Ticket) => {
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

import React, { useEffect } from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import { useSWRConfig } from 'swr'
import clsx from 'clsx'
import { Ticket } from '@/types'
import { useTickets, markTicketRead } from '@/lib/api'
import styles from './index.module.css'

interface MessagesPageProps {
  initialTicketId: string | null
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
 * 直接派生；currentHouse 已被识别为 ticketId 的派生量（通过 tickets
 * 查表即可还原），不再作为独立路由参数维护。本页面因此不再需要订阅
 * 任何全局 Context，去掉了"页面 setUnreadCount → context → Sidebar"
 * 这条易失同步链路。
 */
const MessagesPage: NextPage<MessagesPageProps> = ({ initialTicketId }) => {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const { data: tickets } = useTickets()

  // Use ticketId from URL query, fallback to SSR initial prop
  const currentTicketId = (router.query.ticketId as string) ?? initialTicketId

  const activeTicket = tickets?.find(t => t.id === currentTicketId)

  /**
   * URL-driven 已读副作用：当 currentTicketId 指向的 ticket 处于未读态时，
   * 触发统一请求层的"乐观更新 + 远端写入 + revalidate"流程。
   *
   * 为何挂在 effect 而非 click handler：click 仅是诸多入口之一，直接 URL
   * 访问、SSR 首屏命中 initialTicketId、浏览器前进/后退、外部链接跳转都
   * 不会触发 click。把"已读"绑定到 URL 变化（通过 currentTicketId 派生），
   * 所有入口收敛到同一条副作用路径，click handler 退化为纯导航。
   *
   * 依赖说明：tickets 必入依赖，覆盖"SSR 已带 ticketId 但 SWR 数据尚未
   * 到位"的初次渲染场景；ticket.unread 在乐观更新后翻转为 false，effect
   * 自然终止递归，无需额外去重。
   */
  useEffect(() => {
    if (!tickets || !currentTicketId) return
    const ticket = tickets.find(t => t.id === currentTicketId)
    if (ticket?.unread) markTicketRead(mutate, ticket.id)
  }, [currentTicketId, tickets, mutate])

  const handleTicketClick = (ticket: Ticket) => {
    // 仅以 ticketId 定位会话；houseId 是 ticket 的派生属性（tickets.find(...).houseId
    // 即可还原），放进 URL 会形成"两份真理来源"，刷新/分享路径下需额外约束
    // 一致性。统一收敛到 ticketId 后，链接更短、语义更窄。
    router.push(`/messages?ticketId=${ticket.id}`)
  }

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
              className={clsx(styles.ticketItem, isActive && styles.ticketItemActive)}
            >
              <div className={styles.ticketHeader}>
                <span className={clsx(styles.ticketGuest, ticket.unread && styles.ticketGuestUnread)}>
                  {ticket.guestName}
                </span>
                {ticket.unread && (
                  <span className={styles.unreadDot} />
                )}
              </div>
              <div className={clsx(styles.ticketSubject, ticket.unread && styles.ticketSubjectUnread)}>
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

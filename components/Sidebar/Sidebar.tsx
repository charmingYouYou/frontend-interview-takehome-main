import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMessagesContext } from '@/context/MessagesContext'
import styles from './Sidebar.module.css'

/**
 * Sidebar：应用左侧导航栏。
 *
 * 职责：基于固定的 NAV_ITEMS 渲染品牌区与导航链接，并在 /messages 入口处
 *       根据 useMessagesContext().unreadCount 显示未读徽标。active 态由
 *       router.pathname 与 item.href 的等值比较决定，通过条件挂载
 *       styles.navLinkActive 切换视觉。
 * 边界：所有静态视觉规格（颜色、间距、尺寸、动效）由 Sidebar.module.css +
 *       tokens.css 提供；本组件不持有任何 inline style，也不参与业务逻辑。
 */

const NAV_ITEMS = [
  { href: '/', label: 'Bookings' },
  { href: '/messages', label: 'Messages' },
]

/**
 * 拼接 className，过滤 falsy 值（用于条件挂载 active 修饰类）。
 */
function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}

export function Sidebar() {
  const router = useRouter()
  const { unreadCount } = useMessagesContext()

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        PMS Demo
      </div>

      {NAV_ITEMS.map(item => {
        const isActive = router.pathname === item.href
        const isMessages = item.href === '/messages'
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(styles.navLink, isActive && styles.navLinkActive)}
          >
            <span>{item.label}</span>
            {isMessages && unreadCount > 0 && (
              <span className={styles.unreadBadge}>
                {unreadCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

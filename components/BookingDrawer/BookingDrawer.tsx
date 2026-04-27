import React from 'react'
import clsx from 'clsx'
import { Booking, BookingStatus } from '@/types'
import { STATUS_LABELS, STATUS_PILL_CLASS_NAMES } from '@/lib/bookingStatus'
import { useBookingDetail } from '@/lib/api'
import styles from './BookingDrawer.module.css'

interface BookingDrawerProps {
  booking: Booking | null
  onClose: () => void
}

/**
 * 状态 → Pill 修饰类的解引用：通过 lib/bookingStatus 中维护的"状态 →
 * CSS Module key 名"映射，再叠加本组件的 styles 对象解引用得到最终
 * className。映射本身（含枚举完备性约束）位于状态域单一模块，组件只
 * 负责把抽象 key 映射到本组件的 CSS Module 实例。
 */
function getStatusPillClass(status: BookingStatus): string {
  return styles[STATUS_PILL_CLASS_NAMES[status]] ?? styles.statusPillDefault
}

/**
 * BookingDrawer：右侧固定预订详情抽屉。
 *
 * 视觉规格：所有静态样式（颜色 / 间距 / 字号 / 阴影 / 圆角）来自
 * BookingDrawer.module.css + tokens.css；组件层不持有任何视觉字面量，
 * 仅通过条件 className 切换 status pill 三态。
 *
 * 数据契约（事实来源优先级）：detail（远端权威） > booking（列表视图快照）。
 * - booking 来自父级日历列表数据，仅作为 detail 拉取完成前的「乐观首屏」
 *   占位，避免抽屉打开瞬间出现整面骨架屏；
 * - 一旦 useBookingDetail 命中或加载完成，立即切换到 detail 渲染所有
 *   共有字段（guestName / roomUnit / dates / status / totalAmount），
 *   保证抽屉展示与服务端最新状态一致，规避列表快照与详情数据不同步
 *   导致的视图漂移；
 * - 通过 `const view = detail ?? booking` 统一取值，BookingDetail 继承
 *   自 Booking，类型层无须分支即可天然兼容。
 */
export function BookingDrawer({ booking, onClose }: BookingDrawerProps) {
  const { data: detail, isLoading } = useBookingDetail(booking?.id)

  if (!booking) return null

  const view = detail ?? booking

  return (
    <div className={styles.drawer}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Booking Detail</h2>
        <button onClick={onClose} className={styles.closeButton}>
          ×
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* 共有字段：detail 命中后以 detail 为准，booking 仅作首屏占位 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Guest</h3>
          <p className={styles.valuePrimary}>{view.guestName}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Room</h3>
          <p className={styles.valueSecondary}>{view.roomUnit.name}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dates</h3>
          <p className={styles.valueSecondary}>{view.checkIn} → {view.checkOut}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Status</h3>
          <span className={clsx(styles.statusPill, getStatusPillClass(view.status))}>
            {STATUS_LABELS[view.status] ?? view.status}
          </span>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Amount</h3>
          <p className={styles.valueAmount}>SGD {view.totalAmount.toLocaleString()}</p>
        </section>

        <div className={styles.additional}>
          <h3 className={styles.additionalTitle}>
            Additional Details
            {isLoading && <span className={styles.loadingHint}>loading...</span>}
          </h3>

          {detail ? (
            <>
              <Row label="Email" value={detail.guestEmail} />
              <Row label="Phone" value={detail.guestPhone} />
              <Row label="Source" value={detail.source} />
              <Row label="Payment" value={detail.paymentStatus} />
              {detail.specialRequests && <Row label="Requests" value={detail.specialRequests} />}
            </>
          ) : !isLoading ? (
            <p className={styles.emptyHint}>No additional details available.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Row：附加详情中的「标签 + 值」一行。
 *
 * 仅做布局承载，所有视觉规格由 BookingDrawer.module.css 提供。
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  )
}

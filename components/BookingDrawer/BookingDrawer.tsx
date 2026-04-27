import React from 'react'
import { Booking } from '@/types'
import { useBookingDetail } from '@/lib/api'
import styles from './BookingDrawer.module.css'

interface BookingDrawerProps {
  booking: Booking | null
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  in_house: 'In House',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
}

/**
 * 拼接 className，过滤掉 falsy 值（与 RoomRow 中的同名 helper 保持一致风格）。
 */
function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}

/**
 * 将 booking.status 映射到对应的状态 Pill 修饰类。
 *
 * 仅承担「业务状态 → 视觉修饰类」的逻辑映射，颜色与字号本身均在
 * BookingDrawer.module.css 中通过 token 变量定义；新增状态时只需
 * 在此处补充一行映射，无需触碰组件 JSX。
 */
function getStatusPillClass(status: string): string {
  if (status === 'in_house') return styles.statusPillInHouse
  if (status === 'confirmed') return styles.statusPillConfirmed
  return styles.statusPillDefault
}

/**
 * BookingDrawer：右侧固定预订详情抽屉。
 *
 * 视觉规格：所有静态样式（颜色 / 间距 / 字号 / 阴影 / 圆角）来自
 * BookingDrawer.module.css + tokens.css；组件层不持有任何视觉字面量，
 * 仅通过条件 className 切换 status pill 三态。
 * 行为契约：基础数据来自父级 prop（即时渲染），附加详情通过 SWR 异步
 * 拉取（loading / 缺失态分别有占位）。
 */
export function BookingDrawer({ booking, onClose }: BookingDrawerProps) {
  const { data: detail, isLoading } = useBookingDetail(booking?.id)

  if (!booking) return null

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
        {/* Always show base data immediately (from parent prop) */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Guest</h3>
          <p className={styles.valuePrimary}>{booking.guestName}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Room</h3>
          <p className={styles.valueSecondary}>{booking.roomUnit.name}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dates</h3>
          <p className={styles.valueSecondary}>{booking.checkIn} → {booking.checkOut}</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Status</h3>
          <span className={cx(styles.statusPill, getStatusPillClass(booking.status))}>
            {STATUS_LABELS[booking.status] ?? booking.status}
          </span>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Amount</h3>
          <p className={styles.valueAmount}>SGD {booking.totalAmount.toLocaleString()}</p>
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

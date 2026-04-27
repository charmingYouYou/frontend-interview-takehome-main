import React from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import { BookingGrid } from '@/components/BookingGrid/BookingGrid'
import { BookingDrawer } from '@/components/BookingDrawer/BookingDrawer'
import { ROOM_UNITS } from '@/lib/mockData'
import { useBookings } from '@/lib/api'
import type { Booking } from '@/types'
import styles from './index.module.css'

interface BookingsPageProps {
  initialBookingId: string | null
}

/**
 * Bookings 首页：
 * - 通过 SWR 拉取 /api/bookings 列表，叶子组件 BookingGrid 负责网格渲染
 * - Drawer 开合状态以 URL query (`bookingId`) 为单一事实来源：刷新、分享、
 *   浏览器前进/后退、外部跳转都能精确还原选中态，与 /messages 的 ticketId
 *   策略一致
 * - getServerSideProps 注入 initialBookingId，仅作 SSR 首屏兜底，避免
 *   useRouter().query 在水合前为空导致首帧 Drawer 闪烁
 * - 所有静态样式来自 index.module.css + tokens.css，TSX 层不再保留 inline style
 */
const BookingsPage: NextPage<BookingsPageProps> = ({ initialBookingId }) => {
  const router = useRouter()
  const { data: bookings, isLoading } = useBookings()

  // 水合前 router.query 为空对象，用 SSR 注入的 initialBookingId 兜底首帧；
  // 水合完成后必须严格以 URL query 为单一事实来源 —— 否则 closeBooking
  // 把 bookingId 从 query 中移除后，?? 回退到 initialBookingId 会让 Drawer
  // 永远关不掉。
  const currentBookingId = router.isReady
    ? ((router.query.bookingId as string | undefined) ?? null)
    : initialBookingId
  const selectedBooking: Booking | null =
    bookings?.find(b => b.id === currentBookingId) ?? null

  const openBooking = (booking: Booking) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, bookingId: booking.id } },
      undefined,
      { shallow: true },
    )
  }

  const closeBooking = () => {
    const { bookingId: _omit, ...rest } = router.query
    router.push(
      { pathname: router.pathname, query: rest },
      undefined,
      { shallow: true },
    )
  }

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Booking Calendar</h1>
        {isLoading && <span className={styles.loadingHint}>Loading...</span>}
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        {bookings ? (
          <BookingGrid
            roomUnits={ROOM_UNITS}
            bookings={bookings}
            onBookingClick={openBooking}
          />
        ) : (
          <div className={styles.placeholder}>
            {isLoading ? 'Loading bookings...' : 'No bookings found.'}
          </div>
        )}
      </div>

      {/* Booking detail drawer */}
      {selectedBooking && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeBooking}
            className={styles.backdrop}
          />
          <BookingDrawer
            booking={selectedBooking}
            onClose={closeBooking}
          />
        </>
      )}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<BookingsPageProps> = async (context) => {
  const bookingId = (context.query.bookingId as string) ?? null
  return {
    props: {
      initialBookingId: bookingId,
    },
  }
}

export default BookingsPage

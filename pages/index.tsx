import React, { useState } from 'react'
import type { NextPage } from 'next'
import { Booking } from '@/types'
import { BookingGrid } from '@/components/BookingGrid/BookingGrid'
import { BookingDrawer } from '@/components/BookingDrawer/BookingDrawer'
import { ROOM_UNITS } from '@/lib/mockData'
import { useBookings } from '@/lib/api'
import styles from './index.module.css'

/**
 * Bookings 首页：
 * - 通过 SWR 拉取 /api/bookings 列表，叶子组件 BookingGrid 负责网格渲染
 * - 选中预订时弹出 BookingDrawer + 半透明遮罩
 * - 所有静态样式来自 index.module.css + tokens.css，TSX 层不再保留 inline style
 */
const BookingsPage: NextPage = () => {
  const { data: bookings, isLoading } = useBookings()
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

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
            onBookingClick={setSelectedBooking}
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
            onClick={() => setSelectedBooking(null)}
            className={styles.backdrop}
          />
          <BookingDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
          />
        </>
      )}
    </div>
  )
}

export default BookingsPage

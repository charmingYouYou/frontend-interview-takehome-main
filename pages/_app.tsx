import type { AppProps } from 'next/app'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import '@/styles/globals.css'
import styles from './_app.module.css'

/**
 * App 应用根组件：
 * - 渲染 Sidebar + main 主内容两栏布局
 * - 不再挂载任何全局 Provider：原 AppProvider / MessagesProvider 已被移除，
 *   静态配置由 lib/bookingConfig 常量提供，cell hover 状态下沉到 BookingGrid
 *   本地，messages 相关状态由 URL query + SWR 直接派生
 * - 所有静态样式来自 _app.module.css + tokens.css，组件层不再持有 inline style
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <Component {...pageProps} />
      </main>
    </div>
  )
}

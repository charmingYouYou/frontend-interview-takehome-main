import type { AppProps } from 'next/app'
import { AppProvider } from '@/context/AppContext'
import { MessagesProvider } from '@/context/MessagesContext'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import '@/styles/globals.css'
import styles from './_app.module.css'

/**
 * App 应用根组件：
 * - 套入 AppProvider / MessagesProvider 两层 Context
 * - 渲染 Sidebar + main 主内容两栏布局
 * - 所有静态样式来自 _app.module.css + tokens.css，组件层不再持有 inline style
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppProvider>
      <MessagesProvider>
        <div className={styles.shell}>
          <Sidebar />
          <main className={styles.main}>
            <Component {...pageProps} />
          </main>
        </div>
      </MessagesProvider>
    </AppProvider>
  )
}

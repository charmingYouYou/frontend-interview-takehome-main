import type { AppProps } from 'next/app'
import { SWRConfig } from 'swr'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ErrorBoundary } from '@/components/Async/ErrorBoundary'
import { HttpError } from '@/lib/api'
import '@/styles/globals.css'
import styles from './_app.module.css'

/**
 * SWR 自动重试默认配置。
 *
 * 策略：暂态错误（5xx / 网络抖动 / fetch reject）按指数退避自动重试 3 次，
 * 节奏 ≈ 1s → 2s → 4s，单次封顶 30s。耗尽后由视图层 `<AsyncBoundary>`
 * 渲染错误降级 UI，并通过 onRetry 按钮支持手动二次恢复。
 *
 * 4xx 客户端错误（HttpError.status ∈ [400, 500)）一律跳过自动重试 ——
 * 资源不存在 / 鉴权失败 / 参数错误等场景重试只会放大错误曲线，应直接
 * 进入错误态由用户决定下一步（修正参数、重新登录、放弃）。
 *
 * 暴露为模块级常量便于单测注入与未来按域差异化覆盖（如重要写操作单独
 * 提高 retryCount）。
 */
const SWR_RETRY_COUNT = 3
const SWR_RETRY_BASE_INTERVAL_MS = 1000
const SWR_RETRY_MAX_DELAY_MS = 30_000

/**
 * App 应用根组件：
 * - 渲染 Sidebar + main 主内容两栏布局
 * - 不再挂载任何全局 Provider：原 AppProvider / MessagesProvider 已被移除，
 *   静态配置由 lib/bookingConfig 常量提供，cell hover 状态下沉到 BookingGrid
 *   本地，messages 相关状态由 URL query + SWR 直接派生
 * - 全局错误捕获分三层：
 *   - SWRConfig.onErrorRetry：暂态错误自动指数退避重试 3 次，4xx 跳过；
 *   - SWRConfig.onError：重试耗尽 / 不可重试错误统一进入此回调，便于接入
 *     观测系统（控制台 / Sentry / Toast）。请求层错误同时由视图层
 *     `<AsyncBoundary>` 就近渲染降级 UI，二者职责互补；
 *   - ErrorBoundary：包裹整棵子树，兜底渲染期未处理异常，避免白屏；
 *     SWR 网络错误不会冒泡到此处。
 * - 所有静态样式来自 _app.module.css + tokens.css，组件层不再持有 inline style
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <SWRConfig
      value={{
        errorRetryCount: SWR_RETRY_COUNT,
        errorRetryInterval: SWR_RETRY_BASE_INTERVAL_MS,
        onErrorRetry: (error, _key, config, revalidate, { retryCount }) => {
          // 4xx 客户端错误重试无意义，直接放弃，让视图层进入错误态。
          if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
            return
          }
          // 超出最大重试次数则停止，由 onError 接力上报与降级 UI 接管。
          const maxRetry = config.errorRetryCount ?? SWR_RETRY_COUNT
          if (retryCount >= maxRetry) return
          // 指数退避：base * 2^retryCount，封顶 30s 避免长尾等待。
          const baseInterval = config.errorRetryInterval ?? SWR_RETRY_BASE_INTERVAL_MS
          const delay = Math.min(baseInterval * 2 ** retryCount, SWR_RETRY_MAX_DELAY_MS)
          setTimeout(() => revalidate({ retryCount }), delay)
        },
        onError: (error, key) => {
          // 全局观测点：可在此接入 Sentry / Toast 等基础设施。
          // eslint-disable-next-line no-console
          console.error('[SWR]', key, error)
        },
      }}
    >
      <ErrorBoundary>
        <div className={styles.shell}>
          <Sidebar />
          <main className={styles.main}>
            <Component {...pageProps} />
          </main>
        </div>
      </ErrorBoundary>
    </SWRConfig>
  )
}

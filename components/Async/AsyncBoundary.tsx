import React, { ReactNode } from 'react'
import styles from './AsyncBoundary.module.css'

/**
 * 统一异步态渲染外壳 —— 把 SWR 返回的 `{ data, error, isLoading }` 三态
 * 收敛为单一组件契约（error / loading / empty / success），消费方只需
 * 声明成功态 UI，其余状态由本组件统一接管，避免在每个页面手写
 * `if isLoading` / `if !data` 分支与"loading 文案散落各处"问题。
 *
 * 渲染优先级：error > loading > empty > success。
 *  - error 优先于 loading：SWR 在请求失败后会保留 `isLoading=false` +
 *    `error` 对象，若把 loading 排在前面会吞掉错误态；
 *  - empty 仅在拿到 data 且 `isEmpty(data)` 为真时触发，避免把首屏
 *    `data === undefined` 当成"空"渲染。
 *
 * 设计权衡：采用 render-prop（`children: (data) => ReactNode`）而非节点
 *  - 在数据未就绪前不会构造叶子组件，规避 "data!" 强断言或下游可空判空；
 *  - 类型推断在 children 闭包内部自然收敛为非空 `T`。
 */
interface AsyncBoundaryProps<T> {
  data: T | undefined
  error?: unknown
  isLoading: boolean
  /** 自定义 loading 占位；省略则使用统一 `<Loading />`。 */
  loadingFallback?: ReactNode
  /** 自定义 error 占位；可传 ReactNode 或 (err) => ReactNode。 */
  errorFallback?: ReactNode | ((err: Error) => ReactNode)
  /** 自定义 empty 占位；省略则使用统一 `<EmptyState />`。 */
  emptyFallback?: ReactNode
  /** 数据为空的判定函数；省略则不进入 empty 分支。 */
  isEmpty?: (data: T) => boolean
  /** 错误恢复回调，传入后 ErrorMessage 会展示 Retry 按钮。 */
  onRetry?: () => void
  children: (data: T) => ReactNode
}

export function AsyncBoundary<T>({
  data,
  error,
  isLoading,
  loadingFallback,
  errorFallback,
  emptyFallback,
  isEmpty,
  onRetry,
  children,
}: AsyncBoundaryProps<T>) {
  if (error) {
    const err = toError(error)
    if (typeof errorFallback === 'function') return <>{errorFallback(err)}</>
    return <>{errorFallback ?? <ErrorMessage error={err} onRetry={onRetry} />}</>
  }
  if (isLoading || data === undefined) {
    return <>{loadingFallback ?? <Loading />}</>
  }
  if (isEmpty?.(data)) {
    return <>{emptyFallback ?? <EmptyState />}</>
  }
  return <>{children(data)}</>
}

/**
 * 通用 Loading 块级占位：spinner + 文案，居中显示，适合占据整个区域。
 * a11y：role=status + aria-live=polite，屏幕阅读器以礼貌方式播报。
 */
export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden />
      <span className={styles.loadingLabel}>{label}</span>
    </div>
  )
}

/**
 * 通用 Loading 行内占位：用于"标题 + 加载提示"等紧凑场景。
 */
export function InlineLoading({ label = 'loading...' }: { label?: string }) {
  return (
    <span className={styles.inlineLoading} role="status" aria-live="polite">
      <span className={styles.inlineSpinner} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

/**
 * 通用错误块级占位：标题 + 详细信息 + 可选 Retry 按钮。
 * a11y：role=alert，屏幕阅读器立即播报。
 */
export function ErrorMessage({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorTitle}>Something went wrong</p>
      <p className={styles.errorDetail}>{error.message}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

/**
 * 通用空态占位：弱化文案，居中显示。
 */
export function EmptyState({ label = 'No data.' }: { label?: string }) {
  return <div className={styles.empty}>{label}</div>
}

/**
 * 把 SWR error（类型为 unknown）规整为 Error 实例，统一 message 取值口径。
 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  return new Error('Unknown error')
}

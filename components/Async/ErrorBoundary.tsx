import React from 'react'
import { ErrorMessage } from './AsyncBoundary'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** 自定义降级 UI；省略则使用 `<ErrorMessage />` + Reset。 */
  fallback?: (error: Error, reset: () => void) => React.ReactNode
  /** 错误上报钩子，便于接入 Sentry 等观测系统。 */
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 应用根级 React 错误边界 —— 捕获渲染期未处理异常，避免白屏。
 *
 * 职责边界：
 *  - 本边界仅负责"渲染抛错"这一类异常（render / lifecycle / hooks 内部抛出）；
 *  - SWR 异步请求错误已由 `AsyncBoundary` 在视图层 + `SWRConfig.onError`
 *    在请求层共同处理，不应由 ErrorBoundary 兜底；
 *  - 事件回调 / setTimeout / Promise 内部抛错不会被 React 捕获，按
 *    React 文档约定属于业务自行处理范畴。
 *
 * 默认降级 UI：复用 `<ErrorMessage>` 保持视觉一致；reset 回调清空 error
 * state，配合用户重试或路由切换可恢复。
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 默认控制台输出，便于本地调试；上层可通过 onError 接入观测系统。
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return <ErrorMessage error={error} onRetry={this.reset} />
  }
}

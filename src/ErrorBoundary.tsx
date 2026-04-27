import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="error-shell">
        <section className="error-panel" role="alert">
          <TriangleAlert size={34} />
          <p className="eyebrow">アプリを復旧してください</p>
          <h1>画面の読み込みで問題が発生しました</h1>
          <p>
            入力中のデータは端末またはローカルAPIに保存されている可能性があります。
            再読み込みしても直らない場合は、データ初期化を使って復旧できます。
          </p>
          <button className="primary-action" onClick={() => window.location.reload()} type="button">
            <RotateCcw size={18} />
            再読み込み
          </button>
        </section>
      </main>
    )
  }
}

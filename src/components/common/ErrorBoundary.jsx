/**
 * @fileoverview 렌더링 에러를 잡아 에러 페이지를 표시하는 ErrorBoundary.
 * React의 class component 기반 에러 바운더리로, 하위 컴포넌트에서 발생한 런타임 에러를 격리한다.
 */
import { Component } from 'react';
import ErrorPage from '../../pages/ErrorPage';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 운영 빌드에서는 응답 헤더(Authorization 등)가 errorInfo 에 따라붙어
    // 콘솔에 노출되는 사고를 막기 위해 DEV 환경에서만 상세 로깅한다.
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // 개발 환경에서는 에러 상세 표시
      const detail = import.meta.env.DEV && this.state.error
        ? this.state.error.message
        : undefined;
      return <ErrorPage code={500} message={detail || '화면을 표시하는 중 오류가 발생했습니다.'} />;
    }
    return this.props.children;
  }
}

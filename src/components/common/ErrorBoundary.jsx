/**
 * @fileoverview 렌더링 에러를 잡아 에러 페이지를 표시하는 ErrorBoundary.
 * React의 class component 기반 에러 바운더리로, 하위 컴포넌트에서 발생한 런타임 에러를 격리한다.
 */
import { Component } from 'react';
import ErrorPage from '../../pages/ErrorPage';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage code={500} message="화면을 표시하는 중 오류가 발생했습니다." />;
    }
    return this.props.children;
  }
}

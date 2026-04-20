/**
 * @fileoverview 관리자 대시보드 에러 화면.
 * 서버 호출 실패 + 폴백 데이터도 없을 때 전체 영역에 표시되는 재시도 블록.
 */
import { AlertCircle } from 'lucide-react';
import Button from '../common/Button';

/**
 * 중앙 정렬된 에러 메시지 + 재시도 버튼
 * @param {object} props
 * @param {string} props.message - 사용자에게 보여줄 에러 메시지
 * @param {() => void} props.onRetry - 재시도 핸들러
 */
export default function DashboardError({ message, onRetry }) {
  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle size={40} className="text-danger" />
      <p className="text-sm text-text-secondary text-center">
        {message || '대시보드를 불러오지 못했습니다'}
      </p>
      <Button variant="secondary" size="md" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}

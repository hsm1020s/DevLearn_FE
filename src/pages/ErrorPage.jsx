/**
 * @fileoverview 에러 페이지 — 404/500 등 HTTP 에러 상태를 표시하고 홈으로 복귀할 수 있게 한다.
 * @param {Object} props
 * @param {number} [props.code=404] - HTTP 상태 코드
 * @param {string} [props.message] - 사용자에게 보여줄 에러 메시지 (미지정 시 코드별 기본 메시지)
 */
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import Button from '../components/common/Button';

const ERROR_INFO = {
  404: { title: '페이지를 찾을 수 없습니다', description: '요청하신 페이지가 존재하지 않거나 이동되었습니다.' },
  500: { title: '서버 오류가 발생했습니다', description: '일시적인 문제입니다. 잠시 후 다시 시도해주세요.' },
  default: { title: '오류가 발생했습니다', description: '예상하지 못한 문제가 발생했습니다.' },
};

export default function ErrorPage({ code = 404, message }) {
  const navigate = useNavigate();
  const info = ERROR_INFO[code] || ERROR_INFO.default;

  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="text-center px-6 max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-danger/10">
            <AlertTriangle size={48} className="text-danger" />
          </div>
        </div>

        <p className="text-6xl font-bold text-text-primary mb-2">{code}</p>
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          {info.title}
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          {message || info.description}
        </p>

        <Button
          variant="primary"
          onClick={() => navigate('/', { replace: true })}
          className="inline-flex items-center gap-2"
        >
          <Home size={16} />
          처음 화면으로 이동
        </Button>
      </div>
    </div>
  );
}

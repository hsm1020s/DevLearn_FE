/**
 * @fileoverview 관리자 대시보드 문서 현황 테이블.
 * 서버가 반환한 문서 목록(id/fileName/status)을 공통 Badge로 상태를 표시한다.
 * status는 completed/processing/failed(=error 별칭) 3종을 한글·색상 매핑한다.
 */
import Badge from '../common/Badge';

/** 문서 status → Badge color + 한글 라벨 매핑. error는 failed의 별칭으로 취급 */
const STATUS_MAP = {
  completed: { color: 'green', label: '완료' },
  processing: { color: 'yellow', label: '처리중' },
  failed: { color: 'red', label: '실패' },
  error: { color: 'red', label: '실패' },
};

/**
 * 문서 목록 테이블 (리스트 스타일)
 * @param {object} props
 * @param {Array<{id:string,fileName:string,status:string}>} props.documents
 */
export default function DocumentTable({ documents }) {
  if (!documents || documents.length === 0) {
    return (
      <p className="text-sm text-text-tertiary text-center py-6">업로드된 문서가 없습니다</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {documents.map((doc) => {
        const meta = STATUS_MAP[doc.status] ?? { color: 'gray', label: doc.status ?? '알 수 없음' };
        return (
          <div
            key={doc.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-secondary"
          >
            <span className="text-sm text-text-primary truncate">{doc.fileName}</span>
            <Badge color={meta.color}>{meta.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @fileoverview 문서 업로드 모달 — 사이드바에서 PDF를 파인만 파이프라인으로 업로드한다.
 * FileDropZone으로 드래그앤드롭/클릭 업로드를 받아 feynmanApi.uploadPdf(file)을 호출하며,
 * 업로드된 문서의 파이프라인 실행(임베딩/청크)은 "파인만 → 파이프라인 관리" 탭에서 진행한다.
 * 모달 내부 상태로 현재 세션의 업로드 목록을 보여주고, 닫히면 목록은 사라진다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import FileDropZone from './FileDropZone';
import { useToastStore } from './Toast';
import { uploadPdf, getQuota } from '../../services/feynmanApi';
import useAuthStore from '../../stores/useAuthStore';

// BE(FeynmanService) 기준과 동일하게 유지 — 불일치 시 FE 통과 후 BE에서 거부되어 UX가 깨진다.
/** ADMIN 업로드 상한 (1GB) */
const ADMIN_MAX_BYTES = 1024 * 1024 * 1024;
/** 일반 USER 업로드 상한 (50MB) */
const USER_MAX_BYTES = 50 * 1024 * 1024;

/** 바이트를 사람이 읽기 쉬운 단위로 변환 */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 문서 상태별 시각적 뱃지 (아이콘 + 색상 + 라벨) */
function StatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 size={12} /> 업로드 완료
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-danger">
        <AlertCircle size={12} /> 실패
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-text-tertiary">
      <Loader2 size={12} className="animate-spin" /> 업로드 중
    </span>
  );
}

/**
 * 문서 업로드 모달
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 콜백
 * @param {React.RefObject} [anchorRef] - 팝오버 앵커 위치 참조
 */
export default function DocumentUploadModal({ isOpen, onClose, anchorRef }) {
  const addToast = useToastStore((s) => s.addToast);
  // 이번 세션에 올린 업로드만 보여주는 로컬 목록. 영속 상태는 파이프라인 관리 탭이 서버에서 직접 조회한다.
  const [items, setItems] = useState([]);

  // role 기반 업로드 한도 (BE FeynmanService와 동일 기준: ADMIN 1GB / USER 50MB)
  const role = useAuthStore((s) => s.user?.role);
  const { maxBytes, limitLabel } = useMemo(() => {
    const isAdmin = role === 'ADMIN';
    return {
      maxBytes: isAdmin ? ADMIN_MAX_BYTES : USER_MAX_BYTES,
      limitLabel: isAdmin ? '1GB' : '50MB',
    };
  }, [role]);

  // 보유 슬롯 정보 — 모달 open 시 1회 fetch, 업로드 성공 시 로컬 +1 (BE refetch 보다 가볍게).
  const [quota, setQuota] = useState(null);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const q = await getQuota();
        if (!cancelled) setQuota(q);
      } catch {
        if (!cancelled) setQuota(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);
  const slotFull = quota?.limit != null && quota.used >= quota.limit;

  const patchItem = useCallback((tempId, patch) => {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  }, []);

  // 파일 1개 업로드 — 로컬 아이템을 먼저 넣고 파인만 API 호출
  const uploadOne = useCallback(
    async (file) => {
      const tempId = `${Date.now()}-${file.name}`;
      setItems((prev) => [
        ...prev,
        { tempId, fileName: file.name, size: file.size, status: 'processing' },
      ]);
      try {
        const result = await uploadPdf(file);
        patchItem(tempId, { status: 'completed', serverId: result?.id });
        addToast(`${file.name} 업로드 완료 · 파이프라인 관리 탭에서 실행하세요.`, 'success');
        // 슬롯 카운트 로컬 갱신 (모달 open 직후 fetch 한 값에 +1)
        setQuota((q) => (q ? { ...q, used: q.used + 1 } : q));
      } catch (err) {
        patchItem(tempId, { status: 'error' });
        addToast(`${file.name} 업로드 실패: ${err?.message ?? '알 수 없는 오류'}`, 'error');
      }
    },
    [addToast, patchItem],
  );

  // 드롭존에서 받은 파일 배열을 필터링한 뒤 순차 업로드 (실패해도 나머지 계속).
  // 병렬 대신 순차로 가는 이유: 대용량 PDF 여러 개 동시 업로드 시 서버/네트워크 부담을 회피하기 위함.
  const handleFiles = useCallback(
    async (files) => {
      const sized = [];
      for (const f of files) {
        const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          addToast(`${f.name}: PDF 파일만 업로드할 수 있습니다.`, 'error');
          continue;
        }
        if (f.size > maxBytes) {
          addToast(`${f.name}: ${limitLabel} 이하 파일만 업로드할 수 있습니다.`, 'error');
          continue;
        }
        sized.push(f);
      }

      // 슬롯 한도 사전 차단 — ADMIN(limit=null) 은 skip. 업로드 중 누적으로 차오를 수 있어 매 파일마다 검사.
      let usedSnapshot = quota?.used ?? 0;
      const limit = quota?.limit ?? null;
      for (const f of sized) {
        if (limit != null && usedSnapshot >= limit) {
          addToast(`최대 ${limit}개까지 보유할 수 있어 ${f.name} 은(는) 제외했습니다.`, 'error');
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(f);
        usedSnapshot += 1;
      }
    },
    [uploadOne, addToast, maxBytes, limitLabel, quota],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="문서 업로드" anchorRef={anchorRef} offsetVh={0.15}>
      <div className="flex flex-col gap-4">
        {/* 보유 슬롯 안내 (USER 만 노출, ADMIN 은 limit=null 이라 표시 안 함) */}
        {quota?.limit != null && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs
            ${slotFull
              ? 'border-danger/40 bg-danger/10 text-danger'
              : 'border-border-light bg-bg-secondary text-text-secondary'}`}>
            <FileText size={14} className="shrink-0" />
            <span>
              보유 PDF <strong>{quota.used}/{quota.limit}</strong>
              {slotFull && ' · 기존 문서를 삭제 후 다시 시도하세요.'}
            </span>
          </div>
        )}

        <FileDropZone
          onFiles={handleFiles}
          accept=".pdf,application/pdf"
          multiple
          disabled={slotFull}
          label={slotFull
            ? `슬롯 가득 참 (${quota.used}/${quota.limit})`
            : `PDF 파일을 드래그하거나 클릭하여 업로드 (최대 ${limitLabel})`}
        />

        <p className="text-[11px] text-text-tertiary">
          업로드 후 <span className="font-medium">파인만 · 파이프라인 관리</span> 탭에서 파이프라인을 실행하면 학습에 사용할 수 있습니다.
        </p>

        {/* 이번 세션에 업로드한 문서 목록 */}
        {items.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              이번 업로드 ({items.length})
            </label>
            <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
              {items.map((it) => (
                <li
                  key={it.tempId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border-light bg-bg-primary"
                >
                  <FileText size={14} className="shrink-0 text-text-tertiary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-primary truncate" title={it.fileName}>
                        {it.fileName}
                      </span>
                      <StatusBadge status={it.status} />
                    </div>
                    <div className="text-[11px] text-text-tertiary truncate">
                      {formatSize(it.size)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** @fileoverview 기능개선 제안 모달 — 카테고리(멀티체크), 제목, 상세 내용을 입력받아 localStorage에 저장한다. */
import { useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useToastStore } from './Toast';
import { generateId } from '../../utils/helpers';

/** 제안 카테고리 선택지 목록 */
const CATEGORIES = [
  { value: 'ui', label: 'UI/UX' },
  { value: 'feature', label: '새 기능' },
  { value: 'bug', label: '버그 리포트' },
  { value: 'performance', label: '성능 개선' },
  { value: 'etc', label: '기타' },
];

/** localStorage 저장 키 — 추후 백엔드 연동 시 API 호출로 교체 */
const STORAGE_KEY = 'suggestions';

/** 폼 초기 상태 */
const initialForm = {
  categories: [],
  title: '',
  content: '',
};

/**
 * 기능개선 제안 모달 — 카테고리 복수 선택, 제목, 상세 내용 입력
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 핸들러
 * @param {React.RefObject} [anchorRef] - 팝오버 앵커 위치 참조
 */
export default function SuggestionModal({ isOpen, onClose, anchorRef }) {
  const [form, setForm] = useState(initialForm);
  const addToast = useToastStore((s) => s.addToast);

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleCategory = useCallback((value) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(value)
        ? prev.categories.filter((v) => v !== value)
        : [...prev.categories, value],
    }));
  }, []);

  // 제출 — 유효성 검증 후 localStorage에 제안 데이터 추가 저장
  const handleSubmit = useCallback(() => {
    if (form.categories.length === 0 || !form.title.trim() || !form.content.trim()) {
      addToast('카테고리, 제목, 상세 내용을 모두 입력해주세요.', 'error');
      return;
    }

    const suggestion = {
      ...form,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    // 기존 제안 목록 앞에 새 제안 추가 (최신순 정렬)
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([suggestion, ...existing]));

    addToast('제안이 등록되었습니다.', 'success');
    setForm(initialForm);
    onClose();
  }, [form, addToast, onClose]);

  const handleClose = useCallback(() => {
    setForm(initialForm);
    onClose();
  }, [onClose]);

  const isValid = form.categories.length > 0 && form.title.trim() && form.content.trim();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="기능개선 제안" anchorRef={anchorRef}>
      <div className="flex flex-col gap-4">
        {/* 카테고리 (멀티체크) */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">카테고리 (복수 선택 가능)</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const checked = form.categories.includes(c.value);
              return (
                <label
                  key={c.value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border cursor-pointer transition-colors
                    ${checked
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-light text-text-secondary hover:bg-bg-secondary'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(c.value)}
                    className="accent-primary"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">제목</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="제안 제목을 입력하세요"
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* 상세 내용 */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">상세 내용</label>
          <textarea
            value={form.content}
            onChange={(e) => updateField('content', e.target.value)}
            placeholder="구체적인 설명이나 재현 방법을 입력하세요"
            rows={5}
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            취소
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!isValid}>
            제출
          </Button>
        </div>
      </div>
    </Modal>
  );
}

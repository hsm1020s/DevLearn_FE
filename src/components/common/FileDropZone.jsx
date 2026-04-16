/**
 * @fileoverview 공통 파일 드래그앤드롭 업로드 영역 컴포넌트
 * PDF 파일을 드래그하거나 클릭하여 선택할 수 있는 재사용 가능한 드롭존을 제공한다.
 * PdfUploader, RagUploader, PdfUploadModal 등에서 공통으로 사용된다.
 */
import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';

/**
 * 파일 드래그앤드롭 + 클릭 업로드 영역
 * @param {Function} onFiles - 선택/드롭된 파일 배열을 받는 콜백 (File[])
 * @param {string} [accept='.pdf'] - 허용 파일 확장자
 * @param {boolean} [multiple=true] - 다중 파일 선택 허용 여부
 * @param {string} [label='PDF 파일을 드래그하거나 클릭하여 업로드'] - 안내 문구
 * @param {string} [className=''] - 추가 CSS 클래스
 */
export default function FileDropZone({
  onFiles,
  accept = '.pdf',
  multiple = true,
  label = 'PDF 파일을 드래그하거나 클릭하여 업로드',
  className = '',
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 드래그 진입 시 시각적 피드백 활성화
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  // 드래그 이탈 시 시각적 피드백 해제
  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  // 파일 드롭 시 콜백 호출
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files));
  }, [onFiles]);

  // 파일 선택 변경 시 콜백 호출 후 input 초기화
  const onFileChange = useCallback((e) => {
    if (e.target.files.length) {
      onFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }, [onFiles]);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 p-8
        border-2 border-dashed rounded-xl cursor-pointer transition-colors
        ${dragging ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/50'}
        ${className}
      `}
    >
      <Upload className="w-8 h-8 text-text-tertiary" />
      <p className="text-sm text-text-secondary text-center">{label}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

/**
 * @fileoverview 퀴즈 설정 컴포넌트
 * 교재, 문제 수, 난이도, 출제 범위, 문제 유형을 선택하여 퀴즈 생성을 요청한다.
 * 🎯 모의고사 프리셋 버튼과 🎚️ 적응형 출제 토글을 포함한다.
 */
import { useState } from 'react';
import { Settings, Play, Sparkles, Gauge } from 'lucide-react';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';
import useDocStore from '../../stores/useDocStore';
import useStudyStore from '../../stores/useStudyStore';
import { generateQuiz } from '../../services/studyApi';
import { QUIZ_COUNTS, QUIZ_DIFFICULTIES, QUIZ_TYPES } from '../../utils/constants';
import { showError } from '../../utils/errorHandler';
import { useActiveSubjectId, useActiveSubjectMeta } from '../../hooks/useActiveSubject';

const countOptions = QUIZ_COUNTS.map((n) => ({ value: String(n), label: `${n}문제` }));

const MOCK_CHAPTERS = [
  { value: 'ch1', label: '1장: 개요' },
  { value: 'ch2', label: '2장: 핵심 이론' },
  { value: 'ch3', label: '3장: 실무 적용' },
  { value: 'ch4', label: '4장: 사례 분석' },
  { value: 'ch5', label: '5장: 종합 문제' },
];

/** 퀴즈 생성 전 설정 폼. 교재/문제 수/난이도/범위/유형/적응형/모의고사 프리셋을 선택한다. */
export default function QuizSettings() {
  const docs = useDocStore((s) => s.docs);
  const setStudyStep = useStudyStore((s) => s.setStudyStep);
  const setQuiz = useStudyStore((s) => s.setQuiz);
  const activeSubject = useActiveSubjectId();
  const subjectMeta = useActiveSubjectMeta();
  // 과목별 모의고사 프리셋 (SQLP 90분/40문항, DAP 100분/50문항, …)
  const examPreset = subjectMeta.examPreset;

  const completedDocs = docs.filter((d) => d.status === 'completed');
  const docOptions = completedDocs.map((d) => ({ value: d.id, label: d.fileName }));

  const [settings, setSettings] = useState({
    docIds: completedDocs[0]?.id || '',
    count: String(QUIZ_COUNTS[0]),
    difficulty: QUIZ_DIFFICULTIES[1].value, // 기본 '혼합'
    types: [QUIZ_TYPES[0].value],
    chapters: [],
  });
  // 적응형 출제 토글 — on이면 난이도 드롭다운은 시각적으로 비활성화, 'mixed'로 전송
  const [adaptive, setAdaptive] = useState(false);
  // 모의고사 모드 여부 — on이면 타이머 30분 + 30문제 + 혼합
  const [examMode, setExamMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const toggleType = (typeValue) => {
    setSettings((prev) => {
      const exists = prev.types.includes(typeValue);
      const next = exists ? prev.types.filter((t) => t !== typeValue) : [...prev.types, typeValue];
      return { ...prev, types: next.length ? next : prev.types };
    });
  };

  const toggleChapter = (ch) => {
    setSettings((prev) => {
      const exists = prev.chapters.includes(ch);
      return { ...prev, chapters: exists ? prev.chapters.filter((c) => c !== ch) : [...prev.chapters, ch] };
    });
  };

  // 모의고사 프리셋 적용 — 활성 과목의 examPreset(시간/문항/난이도)을 세팅
  const applyExamPreset = () => {
    setExamMode(true);
    setAdaptive(false);
    setSettings((prev) => ({
      ...prev,
      count: String(examPreset.count),
      difficulty: examPreset.difficulty,
      // 모의고사는 전 범위 + 전 유형
      chapters: [],
      types: QUIZ_TYPES.map((t) => t.value),
    }));
  };

  const clearExamPreset = () => {
    setExamMode(false);
  };

  // 설정값으로 퀴즈 생성 API 호출 후 퀴즈 풀이 단계로 전환
  const handleGenerate = async () => {
    if (!settings.types.length) return;
    // 문서가 없어도 mock이 동작하므로 진행 허용 (백엔드 연결 전 UX 보존)
    setLoading(true);
    try {
      const result = await generateQuiz({
        subject: activeSubject,
        docIds: settings.docIds ? [settings.docIds] : [],
        chapters: settings.chapters.length ? settings.chapters : null,
        count: Number(settings.count),
        difficulty: adaptive ? 'mixed' : settings.difficulty,
        types: settings.types,
      });
      // 모의고사면 과목별 examPreset.timerSec 적용
      setQuiz(result, { timerSec: examMode ? examPreset.timerSec : null });
      setStudyStep('quiz');
    } catch {
      showError(null, '퀴즈 생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const disabledStart = loading || !settings.types.length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-primary">
          <Settings className="w-5 h-5" />
          <h2 className="text-lg font-semibold">퀴즈 설정</h2>
        </div>
        {/* 모의고사 프리셋 / 해제 */}
        {!examMode ? (
          <Button variant="secondary" size="sm" onClick={applyExamPreset}>
            <Sparkles className="w-4 h-4" />
            📋 모의고사 프리셋
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={clearExamPreset}>
            모의고사 해제
          </Button>
        )}
      </div>

      {examMode && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-text-secondary">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-text-primary font-medium">{subjectMeta.label} 모의고사</p>
            <p>{examPreset.count}문제 · 혼합 난이도 · 전체 범위 · 전체 유형 · {Math.floor(examPreset.timerSec / 60)}분 타이머</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Dropdown
          label="교재 선택"
          options={docOptions.length ? docOptions : [{ value: '', label: '업로드된 교재 없음 (사이드바 → 문서 업로드) · 데모 데이터로 시작' }]}
          value={settings.docIds}
          onChange={(v) => update('docIds', v)}
        />
        <Dropdown
          label="문제 수"
          options={countOptions}
          value={settings.count}
          onChange={(v) => update('count', v)}
        />

        {/* 난이도 + 적응형 */}
        <div className="flex flex-col gap-2">
          <Dropdown
            label="난이도"
            options={QUIZ_DIFFICULTIES}
            value={adaptive ? 'mixed' : settings.difficulty}
            onChange={(v) => update('difficulty', v)}
            disabled={adaptive}
          />
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => setAdaptive(e.target.checked)}
              className="w-4 h-4 rounded border-border-light accent-primary"
            />
            <Gauge className="w-3.5 h-3.5 text-primary" />
            🎚️ 적응형 출제 — 맞힐수록 난이도 상승
          </label>
        </div>

        {/* 출제 범위 Chip */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-secondary">출제 범위</label>
          <div className="flex flex-wrap gap-2">
            {MOCK_CHAPTERS.map((ch) => {
              const active = settings.chapters.includes(ch.value);
              return (
                <button
                  key={ch.value}
                  onClick={() => toggleChapter(ch.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                    ${active
                      ? 'bg-primary text-white'
                      : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}
                  `}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>
          {settings.chapters.length === 0 && (
            <p className="text-xs text-text-tertiary">선택하지 않으면 전체 범위에서 출제됩니다</p>
          )}
        </div>

        {/* 문제 유형 */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-secondary">문제 유형</label>
          <div className="flex flex-col gap-2">
            {QUIZ_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={settings.types.includes(type.value)}
                  onChange={() => toggleType(type.value)}
                  className="w-4 h-4 rounded border-border-light accent-primary"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleGenerate} disabled={disabledStart}>
          <Play className="w-4 h-4" />
          {loading ? '생성 중...' : examMode ? '모의고사 시작' : '퀴즈 시작'}
        </Button>
      </div>
    </div>
  );
}

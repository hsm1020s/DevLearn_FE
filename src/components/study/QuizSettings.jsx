/**
 * @fileoverview 퀴즈 설정 컴포넌트.
 * 본인이 파인만 파이프라인으로 올린 문서(rag_docs) 중 학습 가능 상태인 문서를 선택하고,
 * 해당 문서의 챕터(rag_chunks) 중 출제 범위를 고른 뒤 퀴즈 생성을 요청한다.
 * 🎯 모의고사 프리셋 버튼도 포함한다.
 *
 * 문제 유형은 SQLP/DAP 실제 시험 구성에 맞춰 4지선다만 지원하므로 UI 선택지
 * 없이 내부에서 `['multiple']`로 고정 전송한다(실기 서술형은 별도 태스크 대상).
 */
import { useState, useEffect, useCallback } from 'react';
import { Settings, Play, Sparkles, Loader2 } from 'lucide-react';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';
import useStudyStore from '../../stores/useStudyStore';
import { generateQuiz } from '../../services/studyApi';
import { fetchDocs, fetchTopics } from '../../services/feynmanApi';
import { QUIZ_COUNTS, QUIZ_DIFFICULTIES, QUIZ_TYPES } from '../../utils/constants';
import { showError } from '../../utils/errorHandler';
import { useActiveSubjectId, useActiveSubjectMeta } from '../../hooks/useActiveSubject';

const countOptions = QUIZ_COUNTS.map((n) => ({ value: String(n), label: `${n}문제` }));

/** 퀴즈 생성 전 설정 폼. 문서/챕터/문제 수/난이도/모의고사 프리셋을 선택한다. */
export default function QuizSettings() {
  const setStudyStep = useStudyStore((s) => s.setStudyStep);
  const setQuiz = useStudyStore((s) => s.setQuiz);
  const activeSubject = useActiveSubjectId();
  const subjectMeta = useActiveSubjectMeta();
  // 과목별 모의고사 프리셋 (SQLP 90분/40문항, DAP 100분/50문항, …)
  const examPreset = subjectMeta.examPreset;

  // 문제 유형은 현재 4지선다 하나로 고정 전송 (QUIZ_TYPES가 1개짜리).
  const FIXED_TYPES = QUIZ_TYPES.map((t) => t.value);

  // 문서/챕터 로딩 상태
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  const [settings, setSettings] = useState({
    docId: '',
    chapters: [],
    count: String(QUIZ_COUNTS[0]),
    difficulty: QUIZ_DIFFICULTIES[1].value, // 기본 '혼합'
  });

  // 모의고사 모드 여부 — on이면 과목별 프리셋(문항수·시간·난이도)을 자동 세팅
  const [examMode, setExamMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  // 최초 진입 시 본인 completed 문서 목록 로드. 하나만 있으면 자동 선택.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchDocs();
        if (cancelled) return;
        const items = list || [];
        setDocs(items);
        // native <select>는 value=''여도 첫 옵션이 화면상 선택된 것처럼 보이므로
        // state 도 첫 문서로 맞춰 챕터 목록까지 함께 로드되게 한다.
        if (items.length > 0) update('docId', items[0].id);
      } catch (err) {
        if (!cancelled) showError(err, '문서 목록을 불러오지 못했습니다');
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 선택된 docId 에 맞춰 챕터 목록 조회. 문서 변경 시 챕터 선택은 초기화.
  const loadTopics = useCallback(async (docId) => {
    if (!docId) {
      setTopics([]);
      return;
    }
    setTopicsLoading(true);
    try {
      const list = await fetchTopics(docId);
      setTopics(list || []);
    } catch (err) {
      showError(err, '챕터 목록을 불러오지 못했습니다');
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 문서가 바뀌면 기존 챕터 선택을 버리고 새로 로드
    setSettings((prev) => ({ ...prev, chapters: [] }));
    loadTopics(settings.docId);
  }, [settings.docId, loadTopics]);

  const toggleChapter = (ch) => {
    setSettings((prev) => {
      const exists = prev.chapters.includes(ch);
      return { ...prev, chapters: exists ? prev.chapters.filter((c) => c !== ch) : [...prev.chapters, ch] };
    });
  };

  // 모의고사 프리셋 적용 — 활성 과목의 examPreset(시간/문항/난이도)을 세팅
  const applyExamPreset = () => {
    setExamMode(true);
    setSettings((prev) => ({
      ...prev,
      count: String(examPreset.count),
      difficulty: examPreset.difficulty,
      // 모의고사는 전 범위
      chapters: [],
    }));
  };

  const clearExamPreset = () => {
    setExamMode(false);
  };

  // 설정값으로 퀴즈 생성 API 호출 후 퀴즈 풀이 단계로 전환
  const handleGenerate = async () => {
    if (!settings.docId) {
      showError(null, '문서를 선택해주세요');
      return;
    }
    setLoading(true);
    try {
      const result = await generateQuiz({
        subject: activeSubject,
        docIds: [settings.docId],
        chapters: settings.chapters.length ? settings.chapters : null,
        count: Number(settings.count),
        difficulty: settings.difficulty,
        types: FIXED_TYPES,
      });
      // 모의고사면 과목별 examPreset.timerSec 적용
      setQuiz(result, { timerSec: examMode ? examPreset.timerSec : null });
      setStudyStep('quiz');
    } catch (err) {
      showError(err, '퀴즈 생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const docOptions = docs.map((d) => ({ value: d.id, label: d.fileName }));
  const disabledStart = loading || !settings.docId;

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
          <div className="flex flex-col gap-1">
            <p className="text-text-primary font-medium">{subjectMeta.label} 모의고사</p>
            <p>{examPreset.count}문제 · 혼합 난이도 · 전체 범위 · 4지선다 · {Math.floor(examPreset.timerSec / 60)}분 타이머</p>
            {subjectMeta.passingCriteria && (
              <p>
                합격 기준 · 총점 {subjectMeta.passingCriteria.totalMin}점 이상 + 과목별{' '}
                {subjectMeta.passingCriteria.partMinPercent}% 이상
              </p>
            )}
            {subjectMeta.parts && (
              <p className="text-text-tertiary">
                과목별 출제: {subjectMeta.parts.map((p) => `${p.label}(${p.questionCount})`).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 문서 선택 */}
        {docsLoading ? (
          <div className="flex items-center gap-2 text-xs text-text-tertiary py-2">
            <Loader2 size={14} className="animate-spin" />
            문서 목록 불러오는 중…
          </div>
        ) : docs.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-border-light bg-bg-secondary text-xs text-text-secondary">
            아직 학습 가능한 문서가 없어요. 사이드바 <span className="font-medium">문서 파이프라인</span>에서 PDF를 업로드한 뒤 파이프라인을 실행해주세요.
          </div>
        ) : (
          <Dropdown
            label="문서 선택"
            options={docOptions}
            value={settings.docId}
            onChange={(v) => update('docId', v)}
            placeholder="출제할 문서를 선택"
          />
        )}

        <Dropdown
          label="문제 수"
          options={countOptions}
          value={settings.count}
          onChange={(v) => update('count', v)}
        />

        {/* 난이도 */}
        <Dropdown
          label="난이도"
          options={QUIZ_DIFFICULTIES}
          value={settings.difficulty}
          onChange={(v) => update('difficulty', v)}
        />

        {/* 출제 범위 Chip — 선택한 문서의 실제 챕터 */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-secondary">출제 범위 (챕터)</label>
          {!settings.docId ? (
            <p className="text-xs text-text-tertiary">먼저 문서를 선택하세요.</p>
          ) : topicsLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Loader2 size={14} className="animate-spin" />
              챕터 불러오는 중…
            </div>
          ) : topics.length === 0 ? (
            <p className="text-xs text-text-tertiary">이 문서에서 사용할 챕터가 없습니다. 파이프라인 완료 여부를 확인해주세요.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => {
                  const active = settings.chapters.includes(t.chapter);
                  return (
                    <button
                      key={t.chapter}
                      type="button"
                      onClick={() => toggleChapter(t.chapter)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                        ${active
                          ? 'bg-primary text-white'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}
                      `}
                    >
                      {t.chapter}
                      <span className="ml-1 text-[10px] opacity-70">· {t.chunkCount}</span>
                    </button>
                  );
                })}
              </div>
              {settings.chapters.length === 0 && (
                <p className="text-xs text-text-tertiary">선택하지 않으면 전체 범위에서 출제됩니다.</p>
              )}
            </>
          )}
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

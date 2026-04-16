/**
 * @fileoverview 퀴즈 설정 컴포넌트
 * 교재, 문제 수, 난이도, 출제 범위, 문제 유형을 선택하여
 * 퀴즈 생성 요청을 보내는 설정 폼을 제공한다.
 */
import { useState } from 'react';
import { Settings, ArrowLeft, Play } from 'lucide-react';
import Button from '../common/Button';
import Dropdown from '../common/Dropdown';
import useCertStore from '../../stores/useCertStore';
import { generateQuiz } from '../../services/certApi';
import { QUIZ_COUNTS, QUIZ_DIFFICULTIES, QUIZ_TYPES } from '../../utils/constants';
import { showError } from '../../utils/errorHandler';

const countOptions = QUIZ_COUNTS.map((n) => ({ value: String(n), label: `${n}문제` }));

const MOCK_CHAPTERS = [
  { value: 'ch1', label: '1장: 개요' },
  { value: 'ch2', label: '2장: 핵심 이론' },
  { value: 'ch3', label: '3장: 실무 적용' },
  { value: 'ch4', label: '4장: 사례 분석' },
  { value: 'ch5', label: '5장: 종합 문제' },
];

/** 퀴즈 생성 전 설정 폼. 교재/문제 수/난이도/범위/유형을 선택한다. */
export default function QuizSettings() {
  const certDocs = useCertStore((s) => s.certDocs);
  const setCertStep = useCertStore((s) => s.setCertStep);
  const setQuiz = useCertStore((s) => s.setQuiz);

  const completedDocs = certDocs.filter((d) => d.status === 'completed');
  const docOptions = completedDocs.map((d) => ({ value: d.id, label: d.fileName }));

  const [settings, setSettings] = useState({
    docIds: completedDocs[0]?.id || '',
    count: String(QUIZ_COUNTS[0]),
    difficulty: QUIZ_DIFFICULTIES[0].value,
    types: [QUIZ_TYPES[0].value],
    chapters: [],
  });
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  // 문제 유형 토글 (최소 1개는 유지)
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

  // 설정값으로 퀴즈 생성 API 호출 후 퀴즈 풀이 단계로 전환
  const handleGenerate = async () => {
    if (!settings.docIds || !settings.types.length) return;
    setLoading(true);
    try {
      const result = await generateQuiz({
        docIds: [settings.docIds],
        chapters: settings.chapters.length ? settings.chapters : null,
        count: Number(settings.count),
        difficulty: settings.difficulty,
        types: settings.types,
      });
      setQuiz(result);
      setCertStep('quiz');
    } catch {
      showError(null, '퀴즈 생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-text-primary">
        <Settings className="w-5 h-5" />
        <h2 className="text-lg font-semibold">퀴즈 설정</h2>
      </div>

      <div className="flex flex-col gap-4">
        <Dropdown label="교재 선택" options={docOptions} value={settings.docIds} onChange={(v) => update('docIds', v)} />
        <Dropdown label="문제 수" options={countOptions} value={settings.count} onChange={(v) => update('count', v)} />
        <Dropdown label="난이도" options={QUIZ_DIFFICULTIES} value={settings.difficulty} onChange={(v) => update('difficulty', v)} />

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

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCertStep('upload')}>
          <ArrowLeft className="w-4 h-4" /> 이전
        </Button>
        <Button onClick={handleGenerate} disabled={loading || !settings.types.length}>
          <Play className="w-4 h-4" /> {loading ? '생성 중...' : '퀴즈 생성하기'}
        </Button>
      </div>
    </div>
  );
}

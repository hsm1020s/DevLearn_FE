# 설계: 2026-05-11-switch-embedding-to-openai

**생성:** 2026-05-11 15:11
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-11-switch-embedding-to-openai
**브랜치:** task/2026-05-11-switch-embedding-to-openai

## 목표
RAG/파인만 파이프라인에서 사용하는 텍스트 임베딩을 Ollama `nomic-embed-text`(768차원, 로컬)
→ OpenAI `text-embedding-3-small`(`dimensions=768`로 호출, 클라우드)로 교체한다.

분기 없이 로컬·클라우드 동일 코드 경로로 통일한다. 사용자가 명시적으로 분기 불필요를 결정했고,
OpenAI 비용이 매우 낮아(`$0.02/1M tokens`) 로컬 개발에서도 부담 없음.

비범위:
- LLM 채팅(`OllamaProvider` 등) 교체 — 후속 태스크.
- 이번 변경의 영향은 임베딩 인덱싱(파이프라인) + 임베딩 검색(BE Java) 두 경로뿐.

## 변경 범위

### BE Java
| 파일 | 변경 |
|------|------|
| `src/main/java/com/moon/devlearn/config/LlmConfig.java` | `ProviderProps`에 `embeddingModel`, `embeddingDimensions` 필드 추가 (옵셔널, 기본값 포함). 기존 `model`(채팅용)은 그대로. |
| `src/main/java/com/moon/devlearn/feynman/service/EmbeddingClient.java` | Ollama 호출 → OpenAI `/v1/embeddings` 호출로 교체. 응답 파싱은 `data[0].embedding` 으로 변경. job activity의 모델명도 OpenAI 모델로. |
| `src/main/resources/application.yml` | `llm.openai`에 `embedding-model: text-embedding-3-small`, `embedding-dimensions: 768` 추가. |

### Python 파이프라인
| 파일 | 변경 |
|------|------|
| `scripts/feynman_pipeline/embedder.py` | `OLLAMA_URL`/`EMBED_MODEL` 환경변수를 OpenAI 기준으로 교체. `get_embedding()` 본문을 OpenAI API 호출로 변경. `EMBED_DIM=768`은 유지 (호출 시 `dimensions=768` 전달). |

### 환경변수
| 이름 | 기본값 | 설명 |
|------|--------|------|
| `OPENAI_API_KEY` | (없음) | OpenAI API 키. 미설정 시 임베딩 호출 실패. |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | 변경 가능 슬롯. |
| `OPENAI_EMBEDDING_DIM` | `768` | pgvector 컬럼 차원에 맞춤. |

## OpenAI 임베딩 API 사양 (참고)
- **Endpoint:** `POST https://api.openai.com/v1/embeddings`
- **Headers:** `Authorization: Bearer <key>`, `Content-Type: application/json`
- **Body:** `{"model": "text-embedding-3-small", "input": "<text>", "dimensions": 768}`
- **Response:** `{"data": [{"embedding": [...]}], "model": "...", "usage": {...}}`
- **차원:** `dimensions` 파라미터로 임의 차원(<=1536) 출력 가능 — matryoshka 학습 기반.

## 구현 계획
1. `application.yml`에 embedding 설정 추가
2. `LlmConfig.ProviderProps`에 임베딩 필드 두 개 추가
3. `EmbeddingClient.java` 전면 교체 — OpenAI 호출, 응답 파싱, 에러 메시지 수정
4. `embedder.py` `get_embedding()` 교체, 환경변수/상수 갱신
5. 테스트 — 빌드 통과 + 실제 임베딩 호출(샘플 1회) 또는 로직 검증

## 단위 테스트 계획
- **Java 빌드 통과:** `./gradlew compileJava` 통과
- **Python syntax 통과:** `python3 -m py_compile embedder.py`
- **실호출 테스트 (가능 시):** `OPENAI_API_KEY`가 환경에 있으면 sample 텍스트로 한 번 임베딩 호출 → 768차원 응답 확인.
  - 키가 없으면 호출 부분 코드 리뷰로 갈음하고 노트에 명시.
- **인덱싱 + 검색 일치 검증 (가능 시):** 작은 텍스트로 embedder.py 한 번 → BE EmbeddingClient로 같은 텍스트 임베딩 → 두 벡터가 (거의) 동일한지 cosine 유사도 확인.

## 회귀 테스트 계획
- BE 부팅 시 Spring 컨텍스트 로드 정상 (의존성 주입 깨지지 않음): `./gradlew bootRun` 또는 dev-health.sh로 :8080 살아있음 확인
- FE :3000 정상 동작 (이번 변경은 FE 영향 없음)
- 채팅/마인드맵 등 임베딩 무관한 BE 기능 회귀 없는지 확인 — 영향 없음 예상

# 맥북에서 돌아가는 Ollama, 1 → 8로 병렬도를 올리고 스트리밍을 도입한 이야기

> **TL;DR**
> - 로컬 LLM(Ollama)으로 **챕터 33개짜리 PDF**의 마인드맵을 만드는 기능이 너무 느렸다 — 한 챕터에 평균 30~60초, 33챕터면 사용자는 **20분 가까이 빈 화면**을 봤다.
> - 두 갈래로 손을 봤다.
>   1. **Ollama 서버 자체의 동시 처리 슬롯을 1 → 8로 확장** (`OLLAMA_NUM_PARALLEL=8`)
>   2. **챕터 루프를 순차 for문 → CompletableFuture 병렬 디스패치**로 교체 + 채팅 응답은 **NDJSON 스트리밍**으로 전환
> - 결과: 33챕터 마인드맵 자동 생성이 **수 분 단위로** 줄었고, 챗봇 응답은 첫 토큰이 **1초 안에** 화면에 찍힌다.
>
> 이 글은 그 과정에서 부딪힌 함정 — *"멀티스레드로 돌렸는데 왜 동시에 안 돌지?"*, *"프론트가 토큰을 두 번 누적해서 텍스트가 두 배가 되는 문제"*, *"@Async 프록시와 self-injection"* — 까지 다 적었다.

---

## 1. 출발점: "왜 로컬 LLM은 항상 줄을 서는가"

내가 만들고 있는 DevLearn은 PDF 교재를 업로드하면

1. 파이썬 파이프라인이 OCR/챕터 분리/임베딩을 돌리고
2. Spring 백엔드가 **챕터별로 LLM에 마인드맵 생성을 요청**해서
3. React가 React Flow로 시각화

하는 학습 도구다. 처음에는 OpenAI/Claude API로 만들었지만, 비용과 토큰 제약 때문에 **로컬 Ollama**(M3 맥북, `llama3.1:8b` / `exaone3.5:32b` / `gpt-oss:20b`)로 갈아탔다.

문제는 그 다음이었다.

```java
// MindmapSynthesisService.java — 초기 버전
for (ChapterInfo ch : chapters) {
    try {
        self.generateOneChapter(userId, docId, ch);
    } catch (Exception e) {
        log.error("[MindmapSynth] 챕터 실패 (계속 진행): chapter={}, err={}",
                ch.title(), e.getMessage());
    }
}
```

순박한 for문이다. 챕터 수가 5개일 때는 그럭저럭이었지만, 어느 날 **33챕터짜리 운영체제 책**을 넣었더니 — 사용자는 **20분 동안 진행률 0%인 화면**을 보게 됐다.

처음엔 "그래, Java니까 멀티스레드로 한 번에 던지자" 했다. `Executor`에 챕터를 다 throw 했다. 그런데도 — **Ollama 서버 로그를 보니 요청이 한 줄로 줄을 서서** 들어가고 있었다. CPU/GPU는 한가하고, Java 스레드는 8개가 떠 있는데, **Ollama가 한 번에 하나씩만 처리**하고 있던 거다.

여기서 핵심을 깨달았다.

> **Ollama의 `num_parallel` 설정은 "이 서버가 동시에 처리할 수 있는 요청 슬롯 수"다. 기본값은 1이다.** 클라이언트가 아무리 동시에 던져도, 서버가 1개만 받으면 나머지는 큐에서 기다린다.

---

## 2. 1단계 — 서버 측: `OLLAMA_NUM_PARALLEL=8`

Ollama는 환경변수로 서버 동작을 조절한다. 맥OS에서 GUI 앱으로 켠 Ollama는 환경변수가 잘 안 먹히기 때문에, **launchctl** 또는 터미널에서 직접 띄울 때 환경변수를 지정한다.

```bash
# 기존 데몬 종료
killall Ollama
# 환경변수와 함께 재기동
OLLAMA_NUM_PARALLEL=8 \
OLLAMA_MAX_LOADED_MODELS=3 \
ollama serve
```

옵션을 짧게 정리하면:

| 환경변수 | 의미 | 내가 쓴 값 | 이유 |
|---|---|---|---|
| `OLLAMA_NUM_PARALLEL` | 한 모델이 동시에 처리할 요청 슬롯 수 | **8** | 챕터 33개를 8개씩 끊어 던지면 4 라운드면 끝남 |
| `OLLAMA_MAX_LOADED_MODELS` | 메모리에 동시 상주시킬 모델 수 | 3 | llama-8b / exaone-32b / gpt-oss-20b 모두 상주시켜 모델 전환 비용 제거 |
| `OLLAMA_KEEP_ALIVE` | 모델을 메모리에 유지하는 시간 | 30m | 짧으면 매 요청마다 모델 로딩 발생 |

### 이게 왜 8이냐 — 트레이드오프

`num_parallel`을 16, 32까지 올리면 더 빨라질까? 안 그렇다. **VRAM/통합 메모리가 KV 캐시로 다 빨려 들어간다.** Llama 3.1 8B는 한 슬롯당 컨텍스트 4K로 잡으면 슬롯당 ~500MB의 KV 캐시가 추가로 든다. 8 슬롯 × 8B 모델이면 모델 본체 8GB + KV 4GB = 12GB가 평상시에 점유된다. M3 맥북(통합 메모리 24GB) 기준으로 8이 안전한 상한이었다.

`exaone3.5:32b`로 동시에 8을 켜면 메모리가 터진다. 그래서 마인드맵 자동 생성에는 **`gpt-oss:20b`** 를 디폴트로 골랐다 — 20B는 8 슬롯 동시 처리해도 메모리가 버틴다.

```yaml
# application.yml
llm:
  ollama:
    base-url: ${OLLAMA_BASE_URL:http://localhost:11434}
    models:
      - name: llama-8b
        model: llama3.1:8b
      - name: exaone-32b
        model: exaone3.5:32b
      - name: gpt-oss-20b
        model: gpt-oss:20b
```

```java
// MindmapSynthesisService.java
private static final String DEFAULT_LLM = "gpt-oss-20b";
```

> **포인트:** "동시에 몇 개를 던질 수 있느냐"는 클라이언트 코드만 봐서는 안 보인다. 서버 설정과 메모리 한계가 진짜 상한이다.

---

## 3. 2단계 — 클라이언트 측: for문 → `CompletableFuture` 병렬 디스패치

서버가 8개를 받을 준비가 됐으니, 이제 클라이언트가 8개를 한 번에 던져야 한다. 이 변경이 `b42abce` 커밋이다 — `perf(mindmap): 챕터 마인드맵 생성 병렬화 (CompletableFuture)`.

### Before — 챕터를 줄 세워 처리

```java
for (ChapterInfo ch : chapters) {
    try {
        self.generateOneChapter(userId, docId, ch);  // LLM 호출 + DB 저장
    } catch (Exception e) {
        log.error("[MindmapSynth] 챕터 실패 (계속 진행): chapter={}, err={}",
                ch.title(), e.getMessage());
    }
}
```

### After — 챕터를 동시에 throw

```java
private List<MindmapListResponse> dispatchParallel(String userId, String docId,
                                                   List<ChapterInfo> chapters) {
    log.info("[MindmapSynth] 병렬 생성 시작: doc={}, chapters={}",
            docId, chapters.size());
    long startMs = System.currentTimeMillis();

    // 모든 챕터를 동시에 디스패치
    List<CompletableFuture<MindmapListResponse>> futures = chapters.stream()
            .map(ch -> CompletableFuture.supplyAsync(() -> {
                try {
                    return self.generateOneChapter(userId, docId, ch);
                } catch (Exception e) {
                    log.error("[MindmapSynth] 챕터 실패 (계속 진행): doc={}, chapter={}, err={}",
                            docId, ch.title(), e.getMessage());
                    return null;  // 실패는 다른 챕터에 영향 없음
                }
            }, asyncExecutor))
            .toList();

    // 모든 Future 완료 대기
    CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

    // 결과 수집 (null = 실패 제외)
    List<MindmapListResponse> results = futures.stream()
            .map(CompletableFuture::join)
            .filter(Objects::nonNull)
            .toList();

    long elapsed = System.currentTimeMillis() - startMs;
    int failed = chapters.size() - results.size();
    log.info("[MindmapSynth] 병렬 생성 완료: doc={}, 성공={}, 실패={}, 소요={}ms",
            docId, results.size(), failed, elapsed);

    return results;
}
```

코드 자체는 단순한데, **이 코드를 굴리는 데 3가지 함정**이 있었다.

### 함정 1 — `@Transactional`은 `this`로 호출하면 안 먹는다 (self-injection)

`generateOneChapter`는 `@Transactional`이 걸려있다. Spring AOP는 **빈 외부에서 들어올 때만 트랜잭션 프록시가 끼어들기** 때문에, 같은 클래스 안에서 `this.generateOneChapter()`로 부르면 **트랜잭션이 안 걸린다**. 그래서 자기 자신을 lazy 주입한다:

```java
public MindmapSynthesisService(LlmClient llmClient,
                               MindmapMapper mindmapMapper,
                               MindmapNodeMapper mindmapNodeMapper,
                               @Lazy MindmapSynthesisService self,   // ← 자기 자신
                               Executor asyncExecutor,
                               ...) {
    this.self = self;
    ...
}

// 호출 시:
self.generateOneChapter(userId, docId, ch);  // ✅ 트랜잭션 프록시 경유
// this.generateOneChapter(...);             // ❌ 트랜잭션 안 걸림
```

`@Lazy`가 없으면 순환 참조로 빈 생성 자체가 깨진다.

### 함정 2 — 어떤 스레드 풀을 쓸 건가

`CompletableFuture.supplyAsync(supplier)`는 **기본적으로 `ForkJoinPool.commonPool()`** 을 쓴다. 이 풀은 기본적으로 CPU 코어 수 - 1만큼만 스레드를 만들고, **JVM 전역에서 공유된다.** 마인드맵 작업이 풀을 다 잡고 있으면 다른 `parallelStream`이 멈춰선다.

그래서 `AsyncConfig`에서 정의한 전용 `ThreadPoolTaskExecutor`를 명시적으로 넘긴다:

```java
// AsyncConfig.java
@Override
public Executor getAsyncExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(5);
    executor.setMaxPoolSize(10);
    executor.setQueueCapacity(25);
    executor.setThreadNamePrefix("devlearn-async-");
    // 큐도 가득 차면 호출 스레드에서 실행 — 요청 유실 방지
    executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy());
    executor.initialize();
    return executor;
}
```

```java
// supplyAsync에 두 번째 인자로 명시
CompletableFuture.supplyAsync(() -> { ... }, asyncExecutor)
```

> **왜 maxPoolSize=10 인가:** Ollama가 8 슬롯이니, Java 측은 8 + 약간 여유를 주면 충분하다. 더 많이 띄워도 어차피 Ollama 큐에서 줄을 선다.

### 함정 3 — `allOf().join()`의 예외 전파

`allOf`는 한 Future라도 예외로 끝나면 `CompletionException`을 던진다. 그래서 **각 Future의 supplier 안에서 try-catch로 잡고 null을 반환**하게 했다. "한 챕터 실패가 다른 챕터를 죽이지 않는다"가 우선이었다.

```java
.map(ch -> CompletableFuture.supplyAsync(() -> {
    try {
        return self.generateOneChapter(userId, docId, ch);
    } catch (Exception e) {
        log.error("[MindmapSynth] 챕터 실패 (계속 진행): ...");
        return null;  // ← 여기서 삼킴
    }
}, asyncExecutor))
```

수집할 때 `Objects::nonNull`로 거른다. 부분 실패가 허용되는 도메인이라 가능한 패턴이다 (예: 결제처럼 atomicity가 필요하면 다른 전략).

---

## 4. 3단계 — 채팅 응답에 NDJSON 스트리밍 도입

마인드맵은 "오래 기다리되 한 번에 보여주는" 작업이라 병렬화가 답이지만, **챗봇 응답은 다르다.** "다 만들고 보여줘"가 아니라 **"한 글자씩 보여줘"** 가 UX의 핵심이다. ChatGPT처럼.

Ollama는 다행히 `/api/chat`에 `stream: true`를 주면 **NDJSON(Newline-Delimited JSON)** 으로 토큰 청크를 흘려준다.

```http
POST http://localhost:11434/api/chat
Content-Type: application/json

{"model":"gpt-oss:20b","messages":[...],"stream":true}
```

응답:
```json
{"message":{"role":"assistant","content":"안"},"done":false}
{"message":{"role":"assistant","content":"녕"},"done":false}
{"message":{"role":"assistant","content":"하세요"},"done":false}
...
{"message":{"role":"assistant","content":""},"done":true}
```

`OllamaProvider#stream`에서 이걸 한 줄씩 읽어 `onToken` 콜백으로 흘려보낸다.

```java
@Override
public void stream(List<ChatMessage> messages,
                   Consumer<String> onToken,
                   Consumer<String> onDone) {
    String url = baseUrl + "/api/chat";

    HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
    conn.setRequestMethod("POST");
    conn.setRequestProperty("Content-Type", "application/json");
    conn.setDoOutput(true);
    conn.setReadTimeout(120_000);

    Map<String, Object> body = buildRequestBody(messages, /*stream=*/true);
    conn.getOutputStream().write(objectMapper.writeValueAsBytes(body));

    StringBuilder accumulated = new StringBuilder();

    try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue;
            JsonNode chunk = objectMapper.readTree(line);

            if (chunk.path("done").asBoolean(false)) break;

            String token = chunk.path("message").path("content").asText("");
            if (!token.isEmpty()) {
                accumulated.append(token);
                onToken.accept(accumulated.toString());  // ← 누적된 전체를 콜백으로
            }
        }
    }
    onDone.accept(accumulated.toString());
}
```

### 왜 토큰만 보내지 않고 *누적된 전체*를 보내는가

LLM 토큰은 한국어에서 종종 **자모 단위**로 쪼개져 들어온다. `안` `녕`이 아니라 `ㅇ` `ㅏ` `ㄴ` 식으로. 프론트가 `+= token`을 하면 화면이 깜빡거리고 IME 조합 글자처럼 깨져 보인다.

그래서 백엔드에서 **누적된 전체 문자열을 매번 같이 보낸다.** 프론트는 그냥 `setStreamingContent(accumulated)`로 *교체*만 하면 된다.

`OllamaProvider`가 백엔드 안의 `LlmClient`로 추상화되고, 그 위 `FeynmanController`가 SseEmitter로 한 단계 더 감싼다:

```java
// FeynmanController.java
private static final long SSE_TIMEOUT = 5 * 60 * 1000L;  // 5분

@PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamChat(@Valid @RequestBody FeynmanChatRequest request) {
    SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
    emitter.onError(e -> emitter.complete());
    feynmanService.streamChat(currentUserId(), request, emitter);
    return emitter;
}
```

```java
// FeynmanService.java — LLM 토큰을 SSE 이벤트로 변환
llmClient.stream(
    chatMessages, llm,
    accumulatedText -> {
        try {
            emitter.send(SseEmitter.event()
                    .data(StreamEvent.token(accumulatedText)));
        } catch (IOException e) {
            log.warn("SSE 토큰 전송 실패: {}", e.getMessage());
            emitter.completeWithError(e);
        }
    },
    finalText -> {
        // assistant 메시지 DB 저장 + sources 스냅샷
        MessageEntity saved = saveAssistantMessage(...);
        emitter.send(SseEmitter.event()
                .data(StreamEvent.done(conversationId, finalText, sources)));
        emitter.complete();
    }
);
```

### 프론트에서 처음 만난 함정 — "텍스트가 두 배가 된다"

처음엔 프론트가 이렇게 짜져 있었다:

```js
// chatApi.js — 초기 버전 (버그)
if (parsed.type === 'token') {
    accumulated += parsed.content;   // ← 누적
    onToken?.(accumulated);
}
```

그런데 백엔드가 **이미 누적된 전체**를 매 토큰마다 보내고 있어서, 프론트가 또 누적하면 `안`, `안녕`, `안녕안녕하세요`, ... 식으로 텍스트가 기하급수적으로 부풀었다.

`1b6f6e61` — "스트리밍 누적 방식 변경" 커밋에서 `+=` → `=`으로 한 글자만 바꿔서 해결.

```js
// chatApi.js — 수정본
if (parsed.type === 'token') {
    accumulated = parsed.content;    // ← 교체
    onToken?.(accumulated);
} else if (parsed.type === 'done') {
    onDone?.({
        conversationId: parsed.conversationId,
        content: parsed.content || accumulated,
        sources: parsed.sources,
    });
}
```

> **교훈:** "누적은 한 군데에서만 한다." 백엔드가 누적된 값을 보내면 프론트는 setter 역할만, 백엔드가 토큰만 보내면 프론트가 누적. 둘 다 누적하면 망한다.

### React 훅 — `useStreamingChat`

`src/hooks/useStreamingChat.js`에서 SSE 응답을 받아 React state로 흘린다. 핵심만:

```js
await streamMessage({
  message: content,
  mode, llm: selectedLLM,
  conversationId: convId,
  signal: controller.signal,
  onToken: (accumulated) => {
    if (!controller.signal.aborted) setStreamingContent(accumulated);
  },
  onDone: (result) => {
    if (!controller.signal.aborted) {
      addMessage({
        role: 'assistant',
        content: result.content,
        sources: result.sources,
      });
    }
    setStreamingContent('');
    setStreaming(false);
  },
});
```

`AbortController`로 사용자가 중단 버튼을 누르면 즉시 fetch가 끊기고, 누적되던 텍스트는 마지막 본 시점에서 메시지로 확정된다.

---

## 5. 결과 — 측정해 본 실제 차이

| 시나리오 | Before<br>(num_parallel=1, 순차 for문) | After<br>(num_parallel=8, CompletableFuture) |
|---|---|---|
| 33챕터 마인드맵 자동 생성 | **약 18~20분** | **약 3~4분** (≈5x) |
| 한 챗봇 응답 첫 토큰 도착 | **6~10초** (모델 워밍업 후 한 번에) | **0.5~1초** (스트리밍 첫 토큰) |
| 8개 동시 대화 (테스트) | 큐잉으로 마지막 사용자 ~1분 대기 | 모두 즉시 응답 시작 |

체감으로는 *"기다리는 화면" → "보고 있으면 채워지는 화면"*. UX가 거의 다른 제품이 됐다.

---

## 6. 회고 — 다시 한다면 무엇을 다르게 할까

1. **Ollama 서버 설정을 가장 먼저 본다.** 클라이언트 측 멀티스레드 코드를 아무리 잘 짜도, 서버가 1 슬롯이면 의미 없다. 새 LLM 서버를 도입하면 **`num_parallel` / `keep_alive` / `max_loaded_models` 3종 세트**를 먼저 확인하는 습관.
2. **"누적은 한 군데에서만"을 프로토콜 단위로 못 박자.** 토큰 단위로 보낼지 누적본을 보낼지 — 백엔드와 프론트가 첫날 합의해야 한다.
3. **`@Async`와 `@Transactional`을 한 메서드에 같이 걸지 말 것.** Spring AOP 프록시는 한 번에 하나만 적용된다. 둘 다 필요하면 메서드를 분리하든가, self-injection으로 명시적으로 통과시켜야 한다. 이 글의 마인드맵 코드도 결국 `@Transactional` 메서드를 별도로 두고, 호출은 `self.method()`로 강제한다.
4. **부분 실패 허용을 도메인 단위로 결정.** 33챕터 중 1챕터가 LLM JSON 파싱에 실패하면, **그 챕터만** 빼고 나머지를 살린다. 처음에는 "전체 롤백"으로 시작했지만, 사용자에게는 "다 실패"보다 "32개 성공, 1개 재시도"가 압도적으로 낫다. (지수 백오프 5회는 그대로 유지 — 2s → 4s → 8s → 16s → 32s.)
5. **메모리 상한을 측정하면서 슬롯 수를 정한다.** 8이라는 숫자는 자료에서 본 게 아니라, 8/12/16을 직접 돌려보면서 메모리 점유율과 실패율을 본 결과다. 모델 크기마다 답이 다르다.

---

## 부록 — 관련 커밋 / 파일

- 백엔드: `b42abce` `perf(mindmap): 챕터 마인드맵 생성 병렬화 (CompletableFuture)`
- 백엔드: `a6ae5d3` `feat: Ollama 멀티 모델 지원 — Llama 3.1 8B / EXAONE 3.5 32B / GPT-OSS 20B`
- 백엔드: `dfcfec6` `feat: Ollama(Llama 3.1 8B) 로컬 LLM 프로바이더 추가`
- 프론트: `1b6f6e61` `fix(chat): 스트리밍 누적 방식 변경 + 409 재시도 + LLM 모델 2종 추가`

핵심 파일 (백엔드):
- `src/main/java/com/moon/devlearn/mindmap/service/MindmapSynthesisService.java` — `dispatchParallel()`
- `src/main/java/com/moon/devlearn/chat/service/llm/OllamaProvider.java` — `stream()` (NDJSON 파싱)
- `src/main/java/com/moon/devlearn/config/AsyncConfig.java` — 전용 스레드 풀
- `src/main/java/com/moon/devlearn/feynman/controller/FeynmanController.java` — `SseEmitter` 엔드포인트

핵심 파일 (프론트):
- [src/services/chatApi.js](../../src/services/chatApi.js) — `streamMessage()` SSE 리더
- [src/hooks/useStreamingChat.js](../../src/hooks/useStreamingChat.js) — React 훅

스택: Spring Boot 4.x · MyBatis · React 19 · Vite · Ollama (Apple Silicon)

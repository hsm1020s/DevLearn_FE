# 설계: 2026-05-13-visitor-counter

**생성:** 2026-05-13 18:28
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-visitor-counter
**브랜치:** task/2026-05-13-visitor-counter

## 목표
사이드바 좌상단의 "DevLearn" 로고 영역에 **사이트 누적 방문자수**를 표시한다.

카운팅 규칙:
- **브라우저 세션당 1회**만 +1 (`sessionStorage` 플래그로 클라이언트 1차 가드)
- 새로고침 / SPA 라우팅 / 같은 탭 내 재진입 → 카운트 안 함
- 탭 완전히 닫았다가 다시 진입 → 새 세션 → +1
- 서버측 2차 가드: 동일 IP 해시는 **24시간 이내 중복 카운트 안 함** (sessionStorage를 우회하는 케이스 방어)
- 봇 트래픽(User-Agent: `bot|crawler|spider|spider|slurp|bingpreview` 등) 제외

비목표(이번 태스크에서 안 하는 것):
- 일별/주별 방문자 분석 차트 (테이블은 row-per-visit으로 두어 나중 확장 가능)
- 어드민 대시보드 표시 (로고 옆 단일 숫자만)
- 로그인 유저 식별 / 재방문자 트래킹

---

## 변경 범위

### 백엔드 (`/Users/moon/IdeaProjects/DevLearn_BE`)

| 파일 | 변경 | 비고 |
|------|------|------|
| `src/main/resources/schema.sql` | **추가** — `site_visits` 테이블 정의 | 파일 끝(`suggestions` 다음)에 append |
| `src/main/java/com/moon/devlearn/visitor/controller/VisitorController.java` | **신규** | `POST /api/public/visits/hit`, `GET /api/public/visits/count` |
| `src/main/java/com/moon/devlearn/visitor/service/VisitorService.java` | **신규** | hit 처리(IP 24h 가드 + 봇 필터) / count 조회 |
| `src/main/java/com/moon/devlearn/visitor/mapper/VisitorMapper.java` | **신규** | MyBatis 인터페이스 (`insertVisit`, `countTotal`, `existsRecentIp`) |
| `src/main/resources/mapper/visitor/VisitorMapper.xml` | **신규** | SQL 매퍼 |
| `src/main/java/com/moon/devlearn/visitor/dto/VisitCountResponse.java` | **신규** | `{ totalCount: long }` |
| `src/main/java/com/moon/devlearn/config/SecurityConfig.java` | **수정** — `PUBLIC_PATHS`에 `/api/public/**` 추가 | 미로그인 진입에서도 호출 가능해야 함 |

### 프론트엔드 (`/Users/moon/DevLearn_FE`)

| 파일 | 변경 | 비고 |
|------|------|------|
| `src/services/visitorApi.js` | **신규** | `hitVisit()`, `getVisitCount()` |
| `src/components/layout/Sidebar.jsx` | **수정** — 로고 아래 "누적 방문 N" 캡션 추가 | 라인 370-393 헤더 블록 |
| `src/App.jsx` | **수정** — 최초 마운트 시 hit 호출 + sessionStorage 가드 | 결과를 전역 상태(또는 props/context)로 전달 |
| `src/stores/useAppStore.js` | **수정 (선택)** — `visitorCount` 상태와 setter 추가 | Sidebar에서 구독 |

> Sidebar가 이미 `useAppStore`를 쓰고 있는지 확인 후, 이미 쓰면 그쪽으로, 안 쓰면 가벼운 별도 `useVisitorStore` 또는 단순 React state로 처리. 1차 구현은 `useAppStore` 확장 우선.

---

## 구현 계획

### 1단계 — DB 스키마

```sql
CREATE TABLE IF NOT EXISTS site_visits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visited_at  TIMESTAMP NOT NULL DEFAULT now(),
    ip_hash     VARCHAR(64),       -- SHA-256(IP + salt), nullable
    user_agent  VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_site_visits_visited_at ON site_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_ip_recent  ON site_visits(ip_hash, visited_at DESC);
```

- `ip_hash`: 원본 IP 직접 저장 회피(개인정보). SHA-256 + 서버 사이드 솔트.
- COUNT(*) 가 메인 쿼리이고 데이터량이 작아 별도 캐싱 없음. 트래픽이 늘면 Redis 캐싱으로 후속 개선.

### 2단계 — 백엔드 엔드포인트

#### `POST /api/public/visits/hit`
1. `HttpServletRequest`에서 client IP 추출 (`X-Forwarded-For` 우선, 없으면 `getRemoteAddr()`)
2. User-Agent 추출 → 봇 패턴 매칭 시 **카운트 안 하고** `getVisitCount()` 결과만 반환
3. IP 해시 계산 (SHA-256 + 환경변수 솔트 `VISITOR_IP_SALT`)
4. `existsRecentIp(hash, now() - INTERVAL '24 hours')` 확인 → 있으면 카운트 안 함
5. 없으면 `insertVisit(hash, userAgent)`
6. 최신 `countTotal()` 반환

응답: `{ "data": { "totalCount": 1234 } }`

#### `GET /api/public/visits/count`
- 단순히 `countTotal()` 결과 반환. 봇/IP 가드 없음 (조회만).

#### SecurityConfig
```java
private static final String[] PUBLIC_PATHS = {
        "/api/auth/**",
        "/api/public/**",   // 추가
        "/error/**"
};
```

### 3단계 — 프론트엔드 호출

`src/App.jsx` (최초 마운트):

```js
useEffect(() => {
  let cancelled = false;
  const visited = sessionStorage.getItem('dl_visited');

  const run = async () => {
    try {
      const { totalCount } = visited
        ? await getVisitCount()
        : await hitVisit();
      if (!visited) sessionStorage.setItem('dl_visited', '1');
      if (!cancelled) useAppStore.getState().setVisitorCount(totalCount);
    } catch (err) {
      console.warn('[visitor] count fetch failed', err);
    }
  };
  run();
  return () => { cancelled = true; };
}, []);
```

- 실패해도 앱 동작에 영향 없음 (silent fail). 카운트는 그냥 표시 안 함.
- 인증 토큰 없이도 동작해야 하므로 `visitorApi.js`는 axios 인스턴스 사용 시 인터셉터의 401 리다이렉트가 걸리지 않도록 별도 axios 인스턴스 또는 `skipAuthRedirect` 플래그 검토. (api.js 패턴 확인 후 결정)

### 4단계 — 사이드바 표시

[src/components/layout/Sidebar.jsx:370-393](src/components/layout/Sidebar.jsx#L370-L393) 헤더 블록 수정:

```jsx
{!collapsed && (
  <button ...>
    <BookOpen size={20} ... />
    <div className="flex flex-col items-start leading-tight">
      <span className="text-sm font-bold text-text-primary">DevLearn</span>
      {visitorCount != null && (
        <span className="text-[10px] text-text-tertiary">
          누적 방문 {visitorCount.toLocaleString()}
        </span>
      )}
    </div>
  </button>
)}
```

- `collapsed` 상태에서는 숨김 (가로 폭 부족).
- `visitorCount`는 `useAppStore`에서 구독.
- `.toLocaleString()`로 천 단위 콤마.
- `text-text-tertiary`는 globals.css에 정의된 색상 토큰 확인 후 없으면 `text-text-secondary` 사용.

---

## 단위 테스트 계획

(결과는 `.claude/state/evidence/2026-05-13-visitor-counter/unit/notes.md`에 기록)

### 백엔드
- [ ] `VisitorService.hit()` — 새 IP 진입 시 row 1개 insert, count +1
- [ ] `VisitorService.hit()` — 동일 IP 24시간 이내 재호출 시 insert 안 함, count 그대로
- [ ] `VisitorService.hit()` — User-Agent에 `bot` 포함 시 insert 안 함
- [ ] `GET /api/public/visits/count` — 인증 토큰 없이 200 OK
- [ ] `POST /api/public/visits/hit` — 인증 토큰 없이 200 OK
- [ ] IP 해시 — 동일 IP에 대해 결정적, 다른 IP에 대해 다른 값

### 프론트엔드
- [ ] 첫 진입(시크릿창) — Network에서 `POST /api/public/visits/hit` 1회 호출 확인 → 사이드바에 숫자 표시 → `sessionStorage.dl_visited === '1'`
- [ ] 새로고침(같은 탭) — `POST hit` 호출 안 됨, `GET /api/public/visits/count`만 호출 → 숫자 그대로
- [ ] SPA 라우팅(채팅 → 마인드맵) — 추가 호출 없음
- [ ] 사이드바 collapse — 숫자 숨김
- [ ] 봇 User-Agent로 호출 시뮬레이션 — 숫자 증가 안 함 (curl로 검증)
- [ ] 백엔드 다운 상황 — 사이드바에 숫자만 안 보이고 앱은 정상 동작

---

## 회귀 테스트 계획

(결과는 `.claude/state/evidence/2026-05-13-visitor-counter/regression/notes.md`에 기록)

이번 변경이 건드리는 영역(인증 미들웨어 통과 경로 / 사이드바 헤더 / App 마운트 훅) 주변의 주요 기능을 1회씩 실제 사용해 확인:

- [ ] **로그인/로그아웃** — `/api/auth/**` 라우팅이 `PUBLIC_PATHS` 변경으로 인해 망가지지 않는지
- [ ] **채팅 (한국어 IME 포함)** — 메시지 1개 송수신
- [ ] **마인드맵** — 노드 1개 추가/이동
- [ ] **사이드바** — 모드 전환, collapse/expand, 사용량 바 정상 표시
- [ ] **사용자 메뉴(우상단)** — 클릭/메뉴 열림/로그아웃

---

## 결정/메모

- **단일 카운터 row vs row-per-visit:** row-per-visit 채택. COUNT(*)가 메인 쿼리이고 인덱스로 빠르며, 추후 일별 분석 확장 시 마이그레이션 없이 GROUP BY로 끝남. 단일 row UPDATE는 동시성 핫스팟이 될 수 있음.
- **표시 위치:** 로고 옆 인라인 대신 **로고 아래 작은 캡션**. 로고 자체 가독성을 해치지 않기 위함. collapsed 시 숨김.
- **IP 솔트:** 환경변수 `VISITOR_IP_SALT` (없으면 앱 시작 시 경고 로그 + 임시 솔트). 운영 환경에서 누락 시 매 재시작마다 같은 IP가 새 IP로 인식되는 문제 있으니 배포 체크리스트에 추가.
- **카운트 시작값:** 0부터 자연 누적. 과거 방문 보정 없음.

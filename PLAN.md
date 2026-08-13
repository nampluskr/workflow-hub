# 워크플로우 허브 (workflow-hub)

**Capstone 트랙**: 트랙 B — 자동화 Agent · Workflow
**구현에 쓸 수 있는 시간**: 코칭 전후·저녁 + 다음 날 발표 전까지 (실질 6~8시간)

## ① 문제 정의 — 지금 무엇이 불편한가
- 누가 / 언제 / 어떤 일에서: 부서원 4명 중 **원 담당자가 아닌 사람**이, 기존 프로그램에 추가·수정 요청이 들어왔는데 원 담당자가 부재(휴가·퇴사)이거나 긴급 업무로 대응 불가할 때, 그 코드와 매뉴얼을 파악해 직접 수정해야 하는 상황
- 줄이는 비용 (반복 / 대기 / 검증 중 하나): 대기 — 원 담당자의 설명을 기다리거나, 담당자 없이 코드를 처음부터 읽어내는 동안 요청 처리가 멈춰 있음
- 지금 걸리는 시간·횟수: 담당자 부재 월 1~2회 + 긴급 업무로 대응 불가 월 1~2회 = **월 2~4회**. 매번 대체 담당자가 남의 코드·매뉴얼을 파악하는 데 **반나절** 소요

## ② AI 에이전트에게 맡길 부분
> 아래는 **6~8시간 구현 기간 중**의 역할 분담이다 (완성된 도구의 운영 방식이 아니라).

- 에이전트가 대신할 일:
  1. 스킬 파일(`.claude/skills/*.md`)·서브에이전트 정의(`.claude/agents/*.md`)·`CLAUDE.md` 초안 작성
  2. 테스트용 샘플 코드·매뉴얼·요청 3~5건 생성 (사내 실물 대신 쓸 소재)
  3. 각 Phase 완료 조건을 실행해 결과를 수집
  4. Phase 간 중복·불일치 점검 (등록 스킬이 쓰는 형식과 조회 스킬이 읽는 형식이 같은지)
- 사람이 계속 할 일:
  1. **Phase 완료 최종 판정 및 승인** — Claude가 자기 결과를 스스로 통과시키지 않는다. Claude 실행 → **Codex 적대적 교차 검증** → 그 결과를 사람에게 보고하고 승인 요청 → 사람이 승인해야 다음 Phase로 넘어간다
  2. 스킬 이름·이력 파일 형식·필수 메타데이터 항목 결정 (Claude가 정하면 부서 실정과 어긋남)
  3. 샘플의 소재 선정 — 실제 부서 업무 맥락은 Claude가 모름
  4. 브리핑 결과가 "반나절을 줄여주는가" 판단
- 쓸 도구 (서브에이전트·MCP·스킬·hook·병렬 중 필요한 것만):
  - **서브에이전트** — 인수인계 브리핑은 코드를 통째로 읽어야 해서 메인 컨텍스트를 오염시킴. 별도로 돌린다
  - **스킬** — Phase 1·2의 산출물 자체가 스킬이라, 스킬 작성 형식을 그대로 쓴다
  - **backlog MCP (이 프로젝트 전용으로 재구성)** — day2 `backlog-cli-lab`과의 연관성을 끊고, 이 폴더 안에 서버와 `backlog.json`을 두어 인자 없이 호출해도 이 프로젝트를 보게 만든다. 현재 user 스코프에 등록된 day2 서버는 기본 경로가 day2를 가리켜, `file` 인자를 빠뜨리면 조용히 남의 백로그를 읽는다 — 이걸 없앤다
    - 확인된 제약: 노출 도구가 `backlog_list`·`backlog_validate` **읽기 전용** 둘뿐이다. 등록·상태 변경 도구는 없다 (쓰기 도구를 만들지 여부는 아직 안 정함)
    - 용도: **구현 중 남은 Phase 추적 전용**이다 (③에서 백로그는 제품 기능에서 뺐다). 편집 후 `backlog_validate`로 스키마가 깨졌는지 판정하는 검증 게이트로도 쓴다
  - **Codex 적대적 교차 검증** — Claude가 만든 것을 Claude가 판정하면 같은 착각을 반복한다. 다른 모델이 반박한 뒤 사람에게 올린다
    - 호출: `codex exec --sandbox read-only "<프롬프트>"` — 읽기 전용이라 검증 대상 파일을 고칠 수 없다. 이어 물을 때는 `codex exec resume --last "<추가 질문>"`
    - **설치 확인됨**: `codex-cli 0.147.0`
    - 임무는 승인이 아니라 **반박**이다. ① 1차 결론과 근거를 **위치(파일 경로·줄 번호·실행한 명령)**로 정리해 넘기고 ② 읽기 전용으로 반박시키고 ③ **두 결론이 갈리는 지점만** 사람이 판단한다
    - 출처: `vibe-coding-edu-notion/docs-v2/day-04-headless-security-review-and-coaching.md`
  - **hook** — day1·day2에서 만든 것을 확인해 아래 둘을 채택한다. 직접 편집이라는 우회로를 기계가 막는다
    1. **backlog-json-guard** (day2 재사용, PreToolUse `Read|Edit|Write|MultiEdit`) — `backlog.json`은 SSOT이므로 직접 편집을 deny하고 쓰기는 CLI(`tools/backlog.mjs add|update`)로만 통하게 한다. MCP가 읽기 전용인 것은 결함이 아니라 이 설계의 일부다
    2. **version-history-guard** (신규) — 위와 같은 패턴을 **버전 이력 파일**에 적용한다. ①의 문제가 이력 보존이라 이력 파일이 이 프로젝트의 SSOT이고, 덮어쓰기로 쌓인 이력이 날아가는 것을 막는다
    3. **test-verify-check** (day2 재사용, Stop) — **Phase 1부터** 붙인다. ④의 완료 조건을 전부 `npm test`로 옮기므로 Phase 1에서 이미 돌 것이 생긴다
    4. **destructive-command-guard** (day2 재사용, PreToolUse `Bash`) — `rm -rf`·`git reset --hard`·`push --force` 등을 실행 전 차단한다. 되돌리기를 사람 승인에 맡기지 않고 기계가 막는다
  - **테스트 (A안)** — ④의 Phase 완료 조건을 그대로 `node --test` 파일로 옮긴다. day2 테스트 재사용(B안)은 백로그 CLI·MCP가 제품에서 빠져 대상이 사라졌으므로 성립하지 않는다
  - (뺀 것: 병렬 — Phase가 앞뒤로 의존함, 1의 형식이 정해져야 2가 읽음)

> ⚠️ **Stop hook 주의 두 가지**
> 1. `test-verify-check.mjs`는 `git status`·`git diff-tree HEAD`로 변경을 감지한다. **이 폴더는 아직 git 저장소가 아니라** 두 명령이 실패해 stdout이 비고, 정규식이 안 맞아 `exit 0`으로 **조용히 통과한다**. 넣어두고 도는 줄 알지만 한 번도 안 도는 상태가 된다 — `git init` + 첫 커밋이 선행 조건이다.
> 2. (해소됨) A안으로 바꿔 ④의 완료 조건을 전부 테스트로 옮기므로, Phase 1부터 검사 대상이 있다.

## ③ 범위 — 반드시 / 되면 좋은 / 안 하는 것
> 기준: ①이 고른 비용은 **대기 — 남의 코드 파악에 반나절**이다. 그걸 직접 줄이는 것만 「반드시」에 둔다.

- 반드시 (이게 안 되면 실패): **담당자 없이도 남의 코드를 반나절 대신 몇 분에 파악하는 경로 하나를 끝까지 뚫는다.**
  1. `CLAUDE.md` — 4명이 코드·매뉴얼·버전을 **같은 형식**으로 남기게 하는 작성 규칙. **(2026-08-13 추가) `CODE_ANALYSIS.md` 필수화** — `MANUAL.md`(사용법)와 별개로, 코드 작성 담당자가 "왜 이렇게 구현했는지"를 설명하는 문서. 핵심 함수는 발췌해도 되지만 발췌마다 이유를 텍스트로 설명해야 한다(주석만 붙이고 끝내는 건 불허). 인수인계 브리핑(Phase 3)이 가장 깊이 참고할 자료
  2. 버전 등록 스킬 + 이력 파일(SSOT) + `version-history-guard` hook — **버전별 개별 보관**이다. 새 버전을 등록해도 기존 버전을 덮어쓰지 않고, 각 버전에 **누가 작업했는지**가 남는다 (A가 `aaa v1.0` → B가 받아 `aaa v2.0`으로 수정해도 v1.0이 그대로 남는다). **(2026-08-13 추가) 버전 번호는 담당자 기준 메이저.마이너** — 같은 담당자가 이어 고치면 마이너(`v1.0`→`v1.1`), 담당자가 바뀌면 메이저(`v1.x`→`v2.0`). CLAUDE.md §4 참고
  3. 인수인계 브리핑 서브에이전트 — 남의 코드+매뉴얼+이력을 읽어 브리핑 생성. **여기가 반나절을 줄이는 자리**
  4. 샘플 프로젝트 2개 — "남이 짠 코드" 역할. 이게 없으면 3번을 돌려볼 수 없다. **Claude가 생성한 뒤 사람 확인을 기다린다** (Phase 1 승인 지점)
  5. **대시보드 — 정적 HTML 리포트** (2026-08-13, Phase 1 승인 후 「되면 좋은」에서 승격). 명령 한 번으로 `index.html`을 생성해 브라우저로 연다 (서버·빌드 없음). 담당자 4명(A/B/C/D)과 샘플별 버전 이력(`v1.0(A)` / `v2.0(B)` 등)을 한 화면에서 확인하는 용도. **Phase 2 완료 조건에 포함**(아래 ④ 참고)
- 되면 좋은:
  - **개발 코드·매뉴얼에 대한 LLM wiki 구성** (REQUEST.md 최종 목표 중 하나). **(2026-08-13 진행 중, 같은 날 `Phase 4`로 정식 번호 부여 — 아래 ④ Phase 4 참고)** 산출물 방향 확정: 대화형 응답이 아니라 `samples/<name>/wiki/`에 저장되는 **정적 위키 페이지**(NAVIGATION.md 행 1개 = 페이지 1개). `NAVIGATION.md`(Phase 3 재정의 참고)·report.md만 근거로 삼고, 코드/보고서 전체를 옮겨 적지 않는다. `NAVIGATION.md` 생성까지가 Phase 3 범위였고, 위키 페이지 생성이 Phase 4다.
  - 버전 이력 **조회 스킬** — 3번 브리핑과 기능이 겹쳐서 내림
  - 코드/플랫폼 선택지 데모 — **2개까지만**
- 이번엔 안 하는 것:
  - **백로그를 제품 기능으로 만드는 것** (요청 리스트 관리 — 리스트/진행중/완료). 백로그는 **구현 과정에서 Phase 추적 도구로만** 쓰고, 완성된 도구에는 넣지 않는다. 완성 후의 관리 단위는 **버전별 개별 저장**이다
  - 부서 전체 공유 서버·배포·인증 — 로컬 폴더에서만 돈다
  - 실제 사내 코드·매뉴얼 투입 — 형식만 같은 샘플로만 한다
  - 4명 동시 사용·권한·충돌 처리 — 1인 로컬 기준
  - **서버를 띄우는 웹앱** — 트랙 B다. 「되면 좋은」의 대시보드는 정적 HTML 파일 생성까지이고 서버·빌드·프레임워크는 쓰지 않는다
  - **담당자별 업무 코드 개수 통계 처리** — 버전별 개별 보관을 해두면 나중에 셀 수 있다. 집계 기능 자체는 **이후 구현**으로 미룬다
  - 실제 코드 개발 업무 수행 자체

## ④ Phase 분할과 각 Phase 완료 기준
> 앞 Phase의 산출물이 뒤 Phase의 **검사 재료**가 되게 배치했다. 완료 조건은 전부 `npm test`(= `node --test`) 파일로 옮긴다 — **A안**(day2 테스트 재사용은 대상이 사라져 성립하지 않는다).

**Phase 0 — 되돌아갈 지점** (30분 미만, 선행 조건)
`git init` + 첫 커밋, 그리고 이 프로젝트 전용 backlog MCP 구성(구현 중 Phase 추적용).
**day2의 구현 코드(`mcp/server.mjs`, `src/`, `tools/backlog.mjs`)를 그대로 복사해 쓰되, 서버는 이 프로젝트 소유로 독립 등록한다** — day2 파일은 수정하지 않는다.
- 완료: `git log`에 커밋이 1건 이상 있고, **`file` 인자 없이** `backlog_validate`를 호출했을 때 day2가 아니라 **이 프로젝트의 `backlog.json`**이 `filePath`로 반환되며 `valid: true`가 나온다

**Phase 1 — 형식 확정 + 샘플 2개** (1.5~2시간)
`CLAUDE.md`에 코드·매뉴얼·버전 작성 규칙을 정하고, 그 형식대로 샘플 프로젝트 2개를 만든다.
- 완료: `npm test` 실행 시, 샘플 2개가 각각 규정된 경로에 **코드 파일 + `MANUAL.md`**를 갖고 있는지 검사해 **2/2 통과**한다

**Phase 2 — 버전 등록 스킬 + 이력 SSOT + `version-history-guard` hook + 대시보드** (2026-08-13, 대시보드 반영으로 시간 재추정 3~3.5시간)
부서원 4명(A/B/C/D) 기준: `display-defect-rate`는 v1.0(A, 원작성) → v2.0(B, 수정), `display-image-inspection`은 v1.0(C, 원작성) → v2.0(D, 수정)로 등록한다.
- 완료: 위 두 샘플을 각각 v1.0→v2.0으로 등록했을 때 `npm test`가 아래 넷을 전부 통과한다
  1. **각 샘플의 v1.0 스냅샷이 그대로 존재한다** (덮어쓰지 않음)
  2. 각 샘플 이력에 **2건**이 있고 작업자가 각각 원작성자·수정자로 기록돼 있다 (`display-defect-rate`: A/B, `display-image-inspection`: C/D). 담당자가 바뀌었으므로 버전은 `v1.0`→`v2.0`(메이저 증가)
  3. 이력 파일을 `Edit`로 직접 수정하려 하면 **deny**되고, 등록 스킬 경유는 통과한다
  4. **대시보드 생성 스크립트**를 실행하면 `dashboard/index.html`이 생성되고, 그 안에 두 샘플 이름과 각 버전(v1.0/v2.0)·담당자(A/B/C/D)가 모두 텍스트로 포함된다

**Phase 2 addendum 1 — `CODE_ANALYSIS.md` (2026-08-13)**
`MANUAL.md`는 사용법만 다뤄 README에 가깝다는 지적에 따라, "왜 이렇게 구현했는지"를 담당자가 직접 설명하는 `CODE_ANALYSIS.md`를 필수 문서로 추가(위 ③·`CLAUDE.md` §3 참고). 이미 등록된 `v1.0`/`v2.0` 스냅샷은 이력 불변 원칙대로 손대지 않고, 현재 작업 사본에 `CODE_ANALYSIS.md`를 추가해 새 버전으로 등록한다(`display-defect-rate`: v2.0을 쓴 B가 다시 등록, `display-image-inspection`은 v2.0을 쓴 D가 다시 등록 — 직전 코드를 쓴 담당자가 자기 구현을 설명). 같은 담당자의 연속 등록이므로 마이너 버전이 오른다: `v2.0`→`v2.1`.
- 완료: `npm test`가 아래 셋을 추가로 통과한다
  1. 두 샘플의 `v2.1` 스냅샷에 `CODE_ANALYSIS.md`가 있고, 필수 섹션(구현 개요/핵심 로직 설명/이번 버전에서 바뀐 점과 이유/알려진 제약)을 이 순서로 포함한다. `v1.0`/`v2.0` 스냅샷에는 **없어야 정상**(소급 적용 금지)
  2. 각 샘플 이력이 **3건**으로 늘고 작업자가 정확히 기록된다
  3. 대시보드에 `v2.1` 행에만 "분석" 링크가 뜨고, `v1.0`/`v2.0` 행에는 뜨지 않는다

**Phase 2 addendum 2 — 버전 번호를 담당자 기준 메이저.마이너로 (2026-08-13)**
기존엔 등록할 때마다 `v1`, `v2`, `v3`처럼 그냥 1씩 늘렸다. 담당자가 바뀌었는지 여부가 버전 번호만 봐도 드러나도록, **직전 등록자와 이번 담당자가 같으면 마이너 증가, 다르면 메이저 증가(마이너는 0으로 리셋)**로 바꿨다. `tools/version.mjs`가 `history.json`의 마지막 항목 작업자와 비교해 자동으로 계산한다 — 사람이 번호를 입력하지 않는다. 기존에 등록해둔 `v1`/`v2`/`v3`는 내용은 그대로 두고 디렉터리명·`history.json`의 `version` 필드만 새 규칙에 맞게 `v1.0`/`v2.0`/`v2.1`로 다시 붙였다(`display-defect-rate`: A→B에서 메이저, B→B에서 마이너; `display-image-inspection`도 동일 패턴).
- 완료: `npm test`가 위 Phase 2·addendum 1의 모든 기준을 새 버전 번호(`v1.0`/`v2.0`/`v2.1`)로 통과하고, 별도로 스크래치 프로젝트에 register를 3번(같은 담당자 2번+다른 담당자 1번) 실행해 `v1.0`→`v1.1`→`v2.0`으로 정확히 증가하는지 확인한다.
- "소스코드를 그대로 반영하지 말 것"의 정의(사용자 확인): 핵심 함수 발췌 자체는 허용·권장되며, 발췌마다 구현 의도를 텍스트로 설명해야 한다는 뜻이다. 코드 블록 유무를 기계로 금지하는 게이트는 두지 않는다 — 설명의 질은 ⑤의 "사람이 눈으로 보는 것"과 Codex 반박 검증에 맡긴다.

**Phase 2 addendum 3 — 샘플이 개별 레포가 될 구조로 재정리 (2026-08-13)**
사용자가 "각 샘플은 최종적으로 개별 GitHub 레포가 되어야 한다"고 확정했다. 레포 루트의 `README.md`는 GitHub이 자동 렌더링하고 `src/`를 열면 코드가 바로 보이므로, 대시보드에 "코드"·"매뉴얼" 링크를 따로 둘 필요가 없어졌다(자동 렌더링되지 않는 분석 문서만 링크가 필요). 지금 실제로 레포를 분리하진 않는다(`gh` CLI 미설치, 수동 생성 필요) — 이번엔 "레포가 됐을 때의 구조"만 로컬에 맞춘다. 버전 관리 방식(SSOT 스냅샷)은 그대로 유지.
- 새 구조: `samples/<name>/README.md`(구 `MANUAL.md`) + `src/main.py`(구 루트의 `main.py`) + `docs/report.md`(구 `CODE_ANALYSIS.md`).
- 두 샘플 모두 직전 등록자와 같은 담당자로 재등록 → 마이너 증가(`v2.1`→`v2.2`). 기존 `v1.0`/`v2.0`/`v2.1` 스냅샷은 옛 구조 그대로 둔다(소급 적용 금지 원칙 재적용).
- 완료: `npm test`가 아래를 추가로 통과한다
  1. `v2.2` 스냅샷에 `README.md`/`src/main.py`/`docs/report.md`가 있고, `v2.1`은 여전히 옛 구조(`main.py`/`MANUAL.md`/`CODE_ANALYSIS.md`가 루트)를 유지한다
  2. 대시보드가 더 이상 "코드"·"매뉴얼" 링크를 만들지 않고, "분석"(있는 버전만) · "깃헙" 두 링크만 만든다 — `v2.1`처럼 옛 이름(`CODE_ANALYSIS.md`)으로 분석 문서를 가진 버전도 분석 링크가 정상적으로 뜬다(경로만 다르게 찾음)
  3. 각 샘플 이력이 **4건**으로 늘고 작업자가 정확히 기록된다

**Phase 3 — 인수인계 브리핑 서브에이전트** (2시간)
- 완료: 샘플 2개 각각에 브리핑을 생성했을 때, 브리핑에 **네 항목**(프로그램 용도 / 입출력 / 수정 시 건드릴 파일 / 최근 버전 이력)이 모두 있는지 검사해 **2/2 통과**한다
- **완료 기록 (2026-08-13, 사람 승인 완료, 커밋 `5e11253`)**
  - `.claude/agents/handoff-briefing.md` 서브에이전트를 신설: `README.md` → `docs/report.md`(구버전은 `CODE_ANALYSIS.md`) → `history.json` → (있으면) `REQUEST.md` 순으로 읽고 `samples/<프로젝트명>/BRIEFING.md`를 생성한다. `CLAUDE.md` §1·§6에 `BRIEFING.md` 형식(네 섹션 고정 제목·순서)을 문서화했다.
  - `test/phase3-briefing.test.mjs`로 완료 조건을 옮겼다 — 두 샘플 각각 네 섹션이 이 순서로 존재하고 **네 섹션 모두 내용이 비어있지 않은지**까지 검사(총 6 tests). `npm test` 24/24 통과.
  - 두 샘플의 `BRIEFING.md`를 실제로 생성해 사람이 직접 읽고 확인 — README 재진술에 그치지 않고 `docs/report.md`의 "왜"를 반영했음을 확인.
  - Codex(`codex exec --sandbox read-only`) 반박 검증: 브리핑 내용에 확인 가능한 환각 없음, 서브에이전트 정의가 CLAUDE.md §6과 일치. 지적된 문제 하나("수정 시 건드릴 파일" 섹션만 비어있음 검사, 나머지 세 섹션은 미검사)는 즉시 테스트를 고쳐 해소.
  - **대시보드에는 `BRIEFING.md`를 연동하지 않기로 결정**: `docs/report.md`(권위 있는 기록)와 달리 `BRIEFING.md`는 에이전트가 만든 파생 문서라 재생성하지 않으면 낡는다 — 대시보드(개요/탐색 도구)에 고정 링크를 걸면 낡은 정보를 최신처럼 노출할 위험이 있다고 판단했다. 점검은 별도 도구 없이 필요할 때 파일을 직접 읽는다.
  - `node tools/backlog.mjs update LB-004 --status done` 반영, `backlog.json` `VALID 4 task(s)`.

**Phase 3 재정의 (2026-08-13, 같은 날 이어진 대화에서 착수)**

Phase 3 완료·승인 이후, 「되면 좋은」 LLM wiki(③) 착수를 논의하는 과정에서 사용자가 Phase 3 자체의 역할을 다시 정의했다. 위 "완료 기록"은 지우지 않고 그대로 둔다 — 이 프로젝트의 "이력 불변" 원칙을 계획 문서에도 적용한다.

- **트리거 시점 변경**: 후임자가 인수받을 때 호출 → **작성자 본인이 그 버전 작업을 끝내고 `register-version`으로 등록하기 직전**에 자동으로 호출. 항상 그 버전 시점에 만들어지므로, 기존 `BRIEFING.md`의 "낡는다" 문제가 구조적으로 해소된다.
- **역할 전환**: 요약·설명 문서(`BRIEFING.md`, 4섹션) → **네비게이션 인덱스**(`NAVIGATION.md`) — "이 기능/주제가 어느 버전 report.md 절에 설명돼 있고 지금 코드의 어디에 있는지"를 표로 연결한다. 현재 버전뿐 아니라 과거 모든 버전 스냅샷의 report.md까지 훑는 누적 인덱스다.
- **3-에이전트 구조로 분리**: `code-analyzer`(코드에서 함수 위치 탐색) + `report-history-analyzer`(전체 버전의 report.md에서 설명 위치 탐색) + `version-navigator`(위 둘을 직접 호출해 결과를 조인, `NAVIGATION.md` 작성). `handoff-briefing.md`는 `version-navigator.md`로 대체됐다.
- **LLM wiki와의 관계 확정**: 나중에 만들 LLM wiki(대화형 Q&A, 프로젝트별 서브에이전트로 방향만 정함 — 구현은 이번 범위 아님)는 **`NAVIGATION.md`만 읽고** 거기서 가리키는 report.md 절·코드 위치로 점프하며, 특정 버전의 report.md 전체나 코드 전체를 다시 읽지 않는다. 그래서 `NAVIGATION.md`의 각 행은 구체적인 절 제목·줄 번호까지 가리켜야 한다.
- `register-version` 스킬 절차에 "`tools/version.mjs register` 호출 전에 `version-navigator`를 먼저 호출" 단계를 추가했다(순서가 바뀌면 `NAVIGATION.md`가 그 버전 스냅샷에 포함되지 않는다).
- `test/phase3-briefing.test.mjs`는 `test/phase3-navigation.test.mjs`로 교체했다. 미등록 산출물이었던 `BRIEFING.md` 두 파일은 삭제.

**Phase 3 재정의 실행 기록 (2026-08-13, 세션 재시작 후)**

- `version-navigator`가 실제로 하위 두 에이전트(`code-analyzer`, `report-history-analyzer`)를 이름으로 호출하는 중첩 구조가 **작동 확인됨.** 다만 첫 시도에서 하위 호출을 백그라운드로 보내고 기다리지 않은 채 자기 턴을 끝내는 버그가 있어, `version-navigator.md`에 "하위 호출은 동기적으로 기다린 뒤 `NAVIGATION.md`를 쓴 후에만 턴을 끝낸다"를 명시해 해결했다.
- 두 샘플 모두 `NAVIGATION.md`를 생성해 `npm test`를 통과시키고 `v2.3`으로 등록했다(defect-rate: B, image-inspection: D — 직전과 같은 담당자라 마이너 증가).
- **Codex 반박 검증에서 실제 문제 3건이 나왔다**: ①`display-image-inspection`이 report.md "핵심 로직 설명" 절 밖의 이름(`load_pgm`/`analyze_image`/`main`/`defect_sizes`)까지 행에 포함, ②`display-defect-rate`가 대표 버전을 최신이 아닌 더 오래된 버전으로 표기, ③`defect_sizes` 행이 코드 위치를 여러 줄로 병기. 지어낸 내용은 없었다(코드 위치·보고서 인용 자체는 전부 정확) — 계약 준수(§6 규칙) 문제였다.
- `report-history-analyzer.md`/`version-navigator.md`에 규칙을 더 명시적으로 강화하고, 두 샘플의 `NAVIGATION.md`를 고쳐 `v2.4`로 재등록했다(v2.3 스냅샷은 결함 있는 상태 그대로 보존 — 이력 불변 원칙). `test/phase2-versioning.test.mjs`에 v2.3/v2.4 관련 회귀 테스트를 추가해 이 수정이 실제로 반영됐는지 기계로 확인한다.
- **재검증에서 하나 더 나왔다**: `NAVIGATION.md`가 인용하는 "설명된 버전"이 항상 실제 최신 버전보다 한 단계 뒤처진다(v2.4를 등록하며 만든 문서가 v2.3까지만 인용). Codex는 이를 다시 반박했지만, **구조적으로 해소 불가능한 문제**라고 판단해 받아들이지 않았다 — `NAVIGATION.md`는 자신이 속할 버전이 등록되기 *전에* 만들어지므로 그 버전 번호를 아직 알 수 없다(무한 회귀). 이 특성을 CLAUDE.md §6과 `report-history-analyzer.md`에 명시적으로 문서화하는 것으로 마무리했다 — 사람에게 확인받은 결정이다.
- `npm test` 30/30, `node tools/backlog.mjs validate` `VALID 4 task(s)`.

**Phase 4 — LLM wiki: 프로젝트별 위키 페이지 생성 (2026-08-13, 정식 번호 부여 → 같은 날 이어진 대화에서 산출물 방향 확정, 착수 전)**

③의 "되면 좋은" 항목이던 LLM wiki를 정식 Phase로 승격한다. 「반드시」로 다시 승격하는 것은 아니다 — 범위는 그대로 선택 사항이지만, 번호를 붙여 다른 Phase와 같은 방식(완료 기준·백로그 항목)으로 추적한다.

- **방향 확정 경위**: 처음엔 "대화형 Q&A 서브에이전트"(답변을 파일로 남기지 않고 세션 안에서만 응답)로 스코프를 잡았으나, 논의 중 안드레 카파시/DeepWiki류가 말하는 "LLM wiki"(코드베이스를 읽고 **브라우징 가능한 정적 위키 페이지**를 생성해두는 것)와는 다르다는 게 확인됐고, 사용자가 **별도의 위키 페이지 산출물**을 원한다고 확정했다. 그래서 Phase 4는 대화형 응답이 아니라 **파일로 저장되는 위키 페이지 생성**으로 다시 스코프를 잡는다.
- **저장 구조 (확정)**:
  ```
  samples/<프로젝트명>/
    wiki/
      index.md            전체 목차 — NAVIGATION.md 표를 페이지 링크로 재구성
      <기능/주제>.md        NAVIGATION.md 행 1개 = wiki 페이지 1개 (예: aggregate.md, print_table.md)
  ```
  - 위치는 `README.md`/`src/`/`docs/`와 같은 레벨(`samples/<name>/wiki/`) — 나중에 샘플이 개별 GitHub 레포가 됐을 때 폴더째로 그대로 브라우징된다.
  - 페이지 내용은 그 행이 가리키는 report.md 절 인용 + "왜 이렇게 짰는지" 설명 + 코드 위치만 담는다. NAVIGATION.md·report.md에 없는 내용은 지어내지 않는다.
  - 생성 시점은 `NAVIGATION.md`와 같다 — **`register-version` 직전**(사용자 확인, 2026-08-13)에 생성해 그 버전 스냅샷에 함께 얼어붙는다(Phase 3에서 `BRIEFING.md`가 낡던 문제를 해소한 방식을 그대로 재사용).
- **에이전트 구조 (확정)**: 기존 Phase 3의 3개 서브에이전트(`code-analyzer`/`report-history-analyzer`/`version-navigator`)는 **기능을 재정의하지 않는다** — 지금도 위치만 반환하고 내용을 옮겨 적지 않으므로(`report-history-analyzer`는 "v2.3 report.md 핵심 로직 설명"처럼 위치 한 줄만 반환, 파일도 안 씀) 그대로 재사용 가능하다. 대신 **4번째 서브에이전트 `wiki-writer`를 신설**한다.
  - 입력: 방금 `version-navigator`가 쓴 `NAVIGATION.md`
  - 동작: 각 행이 가리키는 report.md 절·코드 위치를 **그 지점만** 다시 읽어(이 프로젝트가 이미 쓰는 "정확한 위치만 알면 그 지점만 읽는다" 원칙 재사용) `samples/<name>/wiki/<주제>.md` + `index.md`를 쓴다
  - 호출 순서: `register-version` 절차 안에서 `version-navigator`(NAVIGATION.md 작성) **바로 다음, `tools/version.mjs register` 실행 직전**에 호출 — NAVIGATION.md와 동일한 타이밍 규칙을 그대로 적용
  - `register-version` 스킬 절차·`CLAUDE.md` §6에도 이 4번째 단계를 반영해야 한다(착수 시 실제 반영)
- **검증용 예상 질문 세트 (확정, 샘플당 3개)** — 완료 기준에서 위키 페이지가 이 질문에 정확히 답하는 내용을 담고 있는지 확인하는 재료로 쓴다. "함정" 질문은 NAVIGATION.md/report.md "핵심 로직 설명" 절 밖의 이름을 물어, 위키가 지어내지 않고 근거 없음을 인정하는지 본다.
  - `display-defect-rate`: ① `aggregate`가 설비별·모델별 집계를 같은 함수 하나로 처리하는 이유(→ `aggregate` 행) ② `print_table`/`write_report`를 나눈 이유(→ 해당 행) ③ [함정] `load_rows`의 CSV 컬럼 누락 처리(→ NAVIGATION.md에 행 없음, "없다"가 정답)
  - `display-image-inspection`: ① `estimate_background`가 평균 대신 중앙값을 쓴 이유(→ 해당 행) ② `find_defect_clusters`가 재귀 대신 스택을 쓴 이유(→ 해당 행) ③ [함정] `main`의 전체 흐름 제어(→ NAVIGATION.md "핵심 로직 설명" 밖, "없다"가 정답)
- 완료 기준(초안, 착수 시 재확인 필요 — 아직 사람 승인 전):
  1. 두 샘플 모두 `samples/<name>/wiki/index.md`가 있고, `NAVIGATION.md` 행 개수만큼 페이지가 존재한다(`display-defect-rate` 3개, `display-image-inspection` 4개)
  2. `index.md`가 모든 페이지로의 링크를 포함한다
  3. 위 예상 질문 세트 6개에 대해 해당 페이지 내용이 올바르게 답하는지, 함정 질문(각 샘플 ③번)에서 근거 없는 내용을 지어내지 않았는지 **Codex 반박 검증**을 통과한다
  4. 각 페이지가 report.md 절 제목·코드 위치를 실제와 일치하게 인용한다 — 사람이 눈으로 최종 확인(⑤의 "사람이 눈으로 보는 것")
- 아직 정하지 않은 것: `wiki-writer.md` 서브에이전트 정의의 세부 프롬프트(페이지 템플릿 문구 등), `npm test`로 옮길 수 있는 기계 판정 범위(페이지 존재·링크 여부는 가능, 내용 정확성은 Codex/사람 몫으로 남을 가능성 높음).

**Phase 4 실행 기록 (2026-08-13, 세션 재시작 후)**

- `.claude/agents/wiki-writer.md`를 신설하고, `register-version` 스킬 절차(3단계로 `version-navigator` 다음에 삽입)와 `CLAUDE.md` §7에 반영했다.
- 두 샘플 모두 `version-navigator` → `wiki-writer` 순으로 실제 실행해 `wiki/index.md` + 기능별 페이지를 생성했다(`display-defect-rate` 3개, `display-image-inspection` 4개 — 완료 기준 1·2 충족).
- **Codex 반박 검증에서 문제 1건**: `estimate_background.md`가 "핵심 로직 설명" 절이 아닌 "알려진 제약" 절 내용까지 섞어 인용해, 페이지 상단 표기("설명된 버전: … 핵심 로직 설명")와 실제 내용이 어긋났다. 해당 문단을 제거해 고치고, `wiki-writer.md`에 "다른 절 내용을 섞지 않는다"는 규칙을 명시적으로 강화했다(완료 기준 3 충족, 재검증 통과).
- 검증용 질문 세트 6개 중 함정 질문 2개(`load_rows`, `main`)는 해당 페이지가 애초에 생성되지 않아 "인덱스에 없음" 조건을 만족했고, 정상 질문들은 페이지 내용이 report.md 근거를 그대로 담고 있음을 확인했다.
- `test/phase4-wiki.test.mjs` 신설(10 tests) — wiki/index.md 존재, NAVIGATION.md 행 수와 페이지 수 일치, 함정 이름의 페이지 미생성, 각 페이지의 버전·코드 위치 인용, index.md 링크 존재를 기계로 검증한다. `npm test` 40/40.
- `register-version`으로 두 샘플 모두 **v2.5**를 등록했다(직전과 같은 담당자: `display-defect-rate` B, `display-image-inspection` D → 마이너 증가). `test/phase2-versioning.test.mjs`의 CASES에 v2.5 항목을 추가해 이력 건수 회귀 테스트를 최신화했다.
- **완료 기준 4("사람이 눈으로 최종 확인")는 아직 남아 있다** — 위 자동 검증까지 통과한 상태이며, 사람의 최종 확인·승인을 기다린다.

**Phase 4 재정의 — NAVIGATION.md 폐지, wiki/로 통합 (2026-08-13, 같은 날 이어진 대화)**

사람의 최종 확인을 받는 과정에서, `NAVIGATION.md`(에이전트 간 인계용 표)와 `wiki/index.md`(사람이 읽는 진입점)가 **같은 정보(이름·설명된 버전·코드 위치)를 중복해서 담고 있다**는 지적이 나왔다. `wiki/index.md`가 이미 그 표를 포함하므로, `NAVIGATION.md`는 사람에게는 무의미한 중간 산출물이었다.

- **결정**: `NAVIGATION.md`와 `version-navigator` 서브에이전트를 폐지한다. `wiki-writer`가 `code-analyzer`·`report-history-analyzer`를 **직접** 호출하는 오케스트레이터로 재정의되고, `wiki/index.md`에 "설명된 버전 (report.md 절)"·"현재 코드 위치" 열을 추가해 옛 NAVIGATION.md 표를 흡수했다.
- `.claude/agents/version-navigator.md` 삭제, `code-analyzer.md`/`report-history-analyzer.md`의 호출자 설명을 `wiki-writer`로 갱신.
- `register-version` 스킬 절차에서 "`version-navigator` 호출" 단계를 제거하고 "`wiki-writer` 호출"만 남겼다.
- `CLAUDE.md` §6·§7을 하나로 병합(§6 "wiki/ 형식")하고, 이력 각주로 이 폐지 경위를 남겼다.
- `samples/<name>/NAVIGATION.md`(작업 사본)를 삭제했다. **`v2.3`~`v2.5` 버전 스냅샷의 `NAVIGATION.md`는 그대로 둔다**(이력 불변 원칙 — 소급 삭제하지 않음). v2.6부터 등록되는 스냅샷에는 없다.
- `test/phase3-navigation.test.mjs` 삭제(NAVIGATION.md 전용 검증이라 더 이상 의미 없음), `test/phase4-wiki.test.mjs`를 `NAVIGATION.md`가 아니라 `wiki/`만 근거로 검증하도록 다시 작성.
- 두 샘플의 `wiki/`를 새 오케스트레이터로 재생성(누락됐던 `display-image-inspection`의 `DEVIATION_THRESHOLD`/`MIN_CLUSTER_SIZE` 페이지, 코드 위치 상대경로 형식을 바로잡음). `npm test` 34/34.
- Codex 반박 검증(2차) — 인용 정확성·코드 위치 일치·금지 페이지 미생성·"설명된 버전"이 최고 등록 버전(v2.5)과 일치함을 확인, 문제 없음.
- 이 변경 자체는 아직 새 버전으로 등록하지 않았다(작업 사본에만 반영) — 등록 여부는 사람 확인 후 진행한다.

**Phase 4 완료 승인 (2026-08-13, 사람 확인 완료)**

- 사람이 `samples/display-defect-rate/wiki/`, `samples/display-image-inspection/wiki/`를 직접 확인 — 완료 기준 4 충족.
- `register-version`으로 두 샘플 모두 **v2.6**을 등록했다(직전과 같은 담당자: `display-defect-rate` B, `display-image-inspection` D → 마이너 증가). `v2.6` 스냅샷부터는 `NAVIGATION.md`가 없고 `wiki/`만 있다(예고한 대로).
- `test/phase2-versioning.test.mjs`의 CASES에 v2.6 항목을 추가해 이력 건수 회귀 테스트를 최신화했다. `npm test` 34/34.
- **Phase 4 완료.** `backlog.json` LB-005를 `done`으로 전환.

## ⑤ 완료를 판정할 방법 (검증 게이트)
- 기계가 판정하는 것:
  - **`npm test`** (`node --test`) — ④ Phase 0~3의 완료 조건 전부 (샘플 2/2, v1.0 잔존, 샘플별 이력 4건과 작업자 A·B·B·B / C·D·D·D, 대시보드 HTML에 버전·담당자·분석 링크 포함, 브리핑 네 항목 2/2)
  - **`version-history-guard`** hook — 이력 파일 직접 `Edit` 시도를 deny. 등록 스킬 경유만 통과
  - **`backlog-json-guard`** hook — `backlog.json` 직접 편집을 deny
  - **`test-verify-check`** hook (Stop) — Claude가 턴을 끝내려 할 때 `npm test` 강제, 실패 시 `exit 2`로 되돌려 보냄
  - **`destructive-command-guard`** hook — `rm -rf`, `git reset --hard`, `push --force` 등 되돌리기 어려운 명령을 실행 전 차단
  - **`backlog_validate`** (MCP) — 백로그 스키마·enum·참조 무결성
- 사람이 눈으로 보는 것:
  - **버전 메타데이터 정확성** — 작성자·날짜·변경 요약이 실제 작업과 맞는지
  - **브리핑이 정말 반나절을 몇 분으로 줄이는가** — 샘플 하나를 직접 읽어보고 판단. ①의 성패가 여기서 갈린다
  - **`CLAUDE.md` 규칙이 4명이 따를 만한 형식인가** — 혼자 쓸 때만 말이 되는 규칙이면 실패
- 내가 직접 승인할 지점:
  - **매 Phase 종료 시 단 한 번.** Claude가 완료 조건을 실행 → **`codex exec --sandbox read-only`로 반박 검증** → **통과했을 때만** 사람에게 보고하고 승인 요청 → 사람이 승인해야 다음 Phase로 넘어간다. Codex 지적에서 걸리면 사람에게 올리지 않고 Claude가 먼저 고친다. 두 모델이 갈리는 지점만 사람에게 올린다
  - 별도 승인 지점을 더 두지 않는다. 샘플 소재 확인은 **Phase 1 승인**에, 「되면 좋은」 착수 여부는 **Phase 3 승인**에 각각 흡수된다
  - 되돌리기 작업은 승인이 아니라 **`destructive-command-guard` hook이 기계적으로 차단**한다

## GitHub 저장소 URL

https://github.com/nampluskr/workflow-hub

## 1:1 코칭에서 가장 묻고 싶은 것

- **구성요소**
  - 이 과제의 구성요소를 무엇으로 잡아야 하나 — 스킬·서브에이전트·hook·MCP 중 실제로 필요한 최소 조합은
  - 6~8시간에 넷(`CLAUDE.md` / 등록 스킬 / 브리핑 서브에이전트 / 샘플)이 적정한 개수인가
- **대시보드** (2026-08-13 결론: 「반드시」로 승격, Phase 2 완료 조건에 포함 — 위 ③·④ 참고)
  - 정적 HTML 리포트 생성이 트랙 B에서 적절한 선택인가
  - 생성 방식 — 스킬로 뽑을지, 별도 스크립트로 뽑을지
- **깃헙 연계**
  - `https://github.com/nampluskr/workflow-hub` 와 어느 수준까지 엮어야 하나
  - 버전 개별 보관을 **git 태그·브랜치로 할지, 파일 디렉터리로 할지** (2026-08-13 결론: 지금은 폴더 스냅샷 유지. 브랜치는 여러 버전을 동시에 파일시스템에서 읽어야 하는 대시보드·Phase 3 브리핑 전제와 안 맞고, 과거 버전 불변을 강제하는 hook도 다시 만들어야 함. 브랜치 방식은 나중에 이미지 등 바이너리로 작업 트리 용량이 실제로 문제될 때 재검토)
  - git 이력과 자체 이력 파일(SSOT)이 **중복**되지 않나 — 둘 중 하나로 줄일 수 있나 (2026-08-13: 중복은 맞지만 git이 blob 단위로 동일 파일을 중복 저장하지 않아 `.git` 용량 문제는 아니고, 작업 트리 checkout 용량만 버전 수만큼 늘어남. 지금 규모(샘플 2개)에선 무시할 수준이라 보류)
- **문서 종류 (매뉴얼 체계)**
  - 아래 다섯을 다 만들어야 하나, 줄여야 하나
    - 계획서
    - 요청처(요청 출처·요청자 정보)
    - AI 해석 내용(에이전트가 코드를 읽고 정리한 것)
    - 매뉴얼(사용 설명)
    - 결과 보고서
  - 각 문서를 **사람이 쓰는지 에이전트가 쓰는지**의 경계
  - 어느 문서가 인수인계에 실제로 쓰이나 — 나머지는 뺄 수 있나
- **버전 관리 방법**
  - 덮어쓰지 않는 개별 보관의 **디렉터리·명명 규칙**을 어떻게 잡나 (`aaa/v1/`, `aaa/v2/` 형태?)
  - 버전이 늘었을 때 브리핑이 **어디까지 읽어야 하나** (최근 N건?)
  - 코드와 매뉴얼의 버전을 **묶어서** 올리나, 따로 올리나
- **툴 · 언어 리스트**
  - 구현 언어를 무엇으로 하나 (day1·day2가 Node/`.mjs`인데 그대로 갈지)
  - 부서 실제 업무 코드의 언어와 달라도 되나 — 브리핑 서브에이전트가 그 언어를 읽어야 한다
  - 외부 패키지를 쓸 수 있나 (day2는 SPEC에서 금지했었다)

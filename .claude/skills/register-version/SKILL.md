---
name: register-version
description: samples/<프로젝트명>/의 현재 코드+매뉴얼 상태를 새 버전으로 등록한다 (스냅샷 보관 + 이력 SSOT 기록). "버전 등록해줘", "v2로 올려줘", "누가 작업했는지 기록해줘"처럼 워크플로우 허브의 샘플/실무 코드를 버전 이력에 남길 때 사용한다.
---

# 버전 등록

`samples/<프로젝트명>/`의 현재 상태(코드 + 문서, CLAUDE.md §1의 `README.md`/`src/`/`docs/` 구조)를 새 버전으로 얼려서 보관하고, 이력 SSOT(`.claude/version-history/<프로젝트명>/history.json`)에 작업자·날짜·변경 요약을 기록한다.

## 절차

1. 대상 프로젝트명, 작업자(A/B/C/D 등 부서에서 통일한 식별자), 이번 변경 요약을 사람에게 확인한다.
2. **`tools/version.mjs register`를 부르기 전에, `version-navigator` 서브에이전트를 먼저 호출해 `samples/<프로젝트명>/NAVIGATION.md`를 최신화한다** (CLAUDE.md §6). 이 순서가 바뀌면 안 된다 — 등록 스크립트가 `samples/<프로젝트명>/`를 그대로 스냅샷에 복사하므로, `NAVIGATION.md`가 그 시점에 이미 있어야 이번 버전 스냅샷에 포함된다.
3. **`.claude/version-history/` 아래 파일을 `Edit`나 `Write`로 직접 건드리지 않는다** — `version-history-guard` hook이 막는다. 반드시 아래 CLI를 Bash로 실행한다:

```bash
node tools/version.mjs register --project <프로젝트명> --author <작업자> --summary "<변경 요약>"
```

4. 실행 결과로 `Registered <프로젝트명> v<메이저.마이너> (<작업자>)`가 출력되면 성공이다. CLI가 알아서:
   - 다음 버전 번호를 계산하고 — **직전 등록자와 이번 작업자가 같으면 마이너 증가**(`v1.0`→`v1.1`), **다르면 메이저 증가하고 마이너는 0으로**(`v1.x`→`v2.0`). 최초 등록은 항상 `v1.0`. (CLAUDE.md §4 참고 — 사람이 번호를 직접 정하지 않는다)
   - `samples/<프로젝트명>/`의 현재 상태를 `.claude/version-history/<프로젝트명>/v<메이저.마이너>/`에 스냅샷으로 복사하고 (기존 버전 스냅샷은 건드리지 않음)
   - `history.json`에 `{version, author, date, summary}` 항목을 추가한다
5. 등록 후 `node tools/backlog.mjs validate`나 `npm test`로 다른 것이 깨지지 않았는지 확인할 필요는 없다 — 버전 이력은 백로그와 별개의 SSOT다. 다만 Phase 2 완료 조건을 확인하려면 `npm test`를 돌린다.

## 주의

- 같은 버전 번호를 두 번 등록하려 하면(스냅샷 폴더가 이미 있으면) CLI가 에러로 거부한다 — 실수로 이력을 덮어쓰는 것을 막기 위함이다.
- `--project`는 `samples/` 아래 실제 존재하는 폴더명이어야 한다.
- 이 스킬은 **등록만** 한다(2단계의 `version-navigator` 호출 포함). 이력 조회는 별도 스킬 없이 `history.json`을 직접 읽으면 된다.

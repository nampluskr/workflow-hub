// PreToolUse(Read|Edit|Write|MultiEdit) hook:
// backlog.json 직접 열람·수정을 실행 전에 차단(deny).
//
// 왜 필요한가: backlog.json은 이 프로젝트의 작업 SSOT이며 오직
// tools/backlog.mjs(validate/list/show/add/update)를 통해서만 읽고 써야
// 한다. Read/Edit/Write 도구로 직접 열람·수정하면 SPEC.md §6의 안전한
// 저장 프로토콜(사전/사후 검증, 원자적 rename)을 건너뛰어 포맷 불일치나
// 검증 누락으로 파일이 손상될 수 있다.
//
// 알려진 한계(의도됨): Bash 도구 경유 열람(cat, node -e 등)은 이 hook이
// 못 막는다 — 정당한 접근 경로(node tools/backlog.mjs ...)는 전부 Bash
// 경유라 이 hook의 영향을 받지 않는다.
//
// fail-closed: PreToolUse 입력 JSON을 파싱하지 못하면 차단 여부를 판단할
// 수 없다는 뜻이다 — 조용히 허용(exit 0)하지 않고 exit 2로 도구 호출
// 자체를 막는다.
//
// bash+jq 버전을 Node로 포팅한 크로스 플랫폼 구현 — Windows에서 bash·jq
// 없이 동작한다(실행 환경은 이 프로젝트가 이미 요구하는 Node 22뿐).
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let event;
try {
  event = JSON.parse(raw);
} catch {
  console.error('backlog-json-guard: PreToolUse 입력 JSON을 파싱하지 못했습니다 — 안전을 위해 이 도구 호출을 차단합니다(fail-closed).');
  process.exit(2);
}

const requested = event?.tool_input?.file_path;
if (typeof requested !== 'string' || requested.length === 0) {
  process.exit(0);
}

const projectDir = event?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const target = path.resolve(projectDir, 'backlog.json');
const candidate = path.resolve(projectDir, requested);

// Windows(NTFS)·macOS(APFS) 모두 기본 대소문자 비구분 — 비교도 소문자로 통일.
// path.resolve가 구분자(\ vs /)와 상대 경로 정규화까지 처리한다.
if (candidate.toLowerCase() === target.toLowerCase()) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'backlog.json은 직접 열람·수정 금지입니다. node tools/backlog.mjs validate|list|show|add|update 로만 접근하세요 (SPEC.md §6 안전한 저장 프로토콜을 우회하지 않기 위함).',
    },
  }));
}
process.exit(0);

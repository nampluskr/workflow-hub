// PreToolUse(Edit|Write|MultiEdit) hook:
// .claude/version-history/ 아래(이력 SSOT + 버전 스냅샷) 직접 수정을 실행 전에
// 차단(deny)한다. Read는 막지 않는다 — 인수인계 브리핑 서브에이전트가 이력을
// 직접 읽어야 하기 때문이다 (별도 조회 도구를 두지 않기로 함, PLAN.md ③).
//
// 왜 필요한가: history.json은 버전 이력의 SSOT이고 버전 스냅샷(v1/v2/...)은
// "덮어쓰지 않는 개별 보관"이 핵심 요구사항이다. Edit/Write 도구로 직접
// 손대면 이 두 불변식이 깨질 수 있다 — 오직 tools/version.mjs register만
// 통해서 쓰도록 강제한다.
//
// 알려진 한계(의도됨): Bash 도구 경유(cat, node -e 등)는 이 hook이 못 막는다
// — 정당한 접근 경로(node tools/version.mjs register)는 전부 Bash 경유라
// 이 hook의 영향을 받지 않는다. (backlog-json-guard와 동일한 한계.)
//
// fail-closed: PreToolUse 입력 JSON을 파싱하지 못하면 exit 2로 도구 호출
// 자체를 막는다.
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let event;
try {
  event = JSON.parse(raw);
} catch {
  console.error('version-history-guard: PreToolUse 입력 JSON을 파싱하지 못했습니다 — 안전을 위해 이 도구 호출을 차단합니다(fail-closed).');
  process.exit(2);
}

const requested = event?.tool_input?.file_path;
if (typeof requested !== 'string' || requested.length === 0) {
  process.exit(0);
}

const projectDir = event?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const guardedRoot = path.resolve(projectDir, '.claude', 'version-history');
const candidate = path.resolve(projectDir, requested);

// Windows(NTFS)·macOS(APFS) 모두 기본 대소문자 비구분 — 비교도 소문자로 통일.
const candidateLower = candidate.toLowerCase();
const guardedRootLower = guardedRoot.toLowerCase();

if (candidateLower === guardedRootLower || candidateLower.startsWith(guardedRootLower + path.sep)) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        '.claude/version-history/ 아래는 직접 수정 금지입니다. node tools/version.mjs register --project <name> --author <A> --summary <text> 로만 새 버전을 등록하세요 (기존 버전 스냅샷과 이력 SSOT를 보존하기 위함).',
    },
  }));
}
process.exit(0);

// PreToolUse(Bash) hook: 되돌리기 어려운 파괴적 명령을 실행 전에 차단(deny).
//
// 왜 필요한가: rm -rf, git reset --hard, git clean -f*, git checkout ./
// restore ., git push --force, git branch -D는 미커밋 작업이나 원격
// 히스토리를 되돌릴 수 없이 날린다. 시스템 프롬프트 차원의 판단만으로는
// 100% 막지 못하므로 도구 호출 단계에서 기술적으로 한 번 더 차단한다.
//
// 알려진 한계(의도됨): 문자열 매칭이므로 변수 조립·alias·파이프로 명령을
// 숨기는 의도적 우회는 못 잡는다. 이 훅은 실수를 막는 안전망이지 보안
// 경계가 아니다. --force-with-lease(더 안전한 force push)는 허용한다.
//
// bash+jq 버전을 Node로 포팅한 크로스 플랫폼 구현 — Windows에서 bash·jq
// 없이 동작한다.

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let event;
try {
  event = JSON.parse(raw);
} catch {
  // 명령 문자열을 알 수 없으면 판단 불가 — 이 hook은 실수 방지 안전망이므로
  // bash 원본과 동일하게 통과시킨다(backlog-json-guard와 달리 fail-open).
  process.exit(0);
}

const cmd = event?.tool_input?.command;
if (typeof cmd !== 'string' || cmd.length === 0) {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// ---- rm -rf (및 -fr, -Rf, --recursive --force 등 조합) ----
// rm 호출 구간만 떼어내(다음 ;/&/| 전까지) 그 구간 안에서 recursive와
// force 플래그가 함께 있는지 확인한다.
const rmSegments = cmd.match(/(?:^|[;&|]+)\s*rm(?:\s+[^;&|]*)?/g) ?? [];
for (const seg of rmSegments) {
  const hasRecursive = /-[a-zA-Z]*[rR][a-zA-Z]*|--recursive/.test(seg);
  const hasForce = /-[a-zA-Z]*f[a-zA-Z]*|--force/.test(seg);
  if (hasRecursive && hasForce) {
    deny('rm -rf류(재귀+강제 삭제) 명령은 금지입니다. 되돌릴 수 없는 삭제이니 정말 필요하면 사용자에게 직접 실행을 요청하세요.');
  }
}

// ---- git reset --hard ----
if (/(^|[^a-zA-Z])git\s+reset\s+[^;&|]*--hard/.test(cmd)) {
  deny('git reset --hard는 미커밋 변경을 되돌릴 수 없이 버립니다. 필요하면 git stash 등으로 먼저 보존하고 사용자 승인을 받으세요.');
}

// ---- git checkout . / restore . (미커밋 변경 전체 되돌리기) ----
if (/(^|[^a-zA-Z])git\s+(checkout|restore)(\s+--)?\s+\.(\s|$)/.test(cmd)) {
  deny('git checkout .·restore .는 미커밋 변경 전체를 되돌릴 수 없이 버립니다. 사용자 승인 후에만 실행하세요.');
}

// ---- git clean -f (git clean은 -f 없이는 기본적으로 아무것도 안 지운다) ----
if (/(^|[^a-zA-Z])git\s+clean\b/.test(cmd)) {
  if (/-[a-zA-Z]*f[a-zA-Z]*(\s|$)|--force/.test(cmd)) {
    deny('git clean -f는 추적되지 않는 파일을 되돌릴 수 없이 삭제합니다. 사용자 승인 후에만 실행하세요.');
  }
}

// ---- git push --force / -f (--force-with-lease는 허용) ----
if (/(^|[^a-zA-Z])git\s[^;&|]*push/.test(cmd)) {
  if (!/--force-with-lease/.test(cmd)) {
    if (/--force([^-]|$)|(^|\s)-f(\s|$)/.test(cmd)) {
      deny('git push --force/-f는 원격 히스토리를 덮어씁니다. 필요하면 사용자에게 직접 요청하세요(--force-with-lease는 허용).');
    }
  }
}

// ---- git branch -D (미병합 커밋도 확인 없이 삭제) ----
if (/(^|[^a-zA-Z])git\s+branch\s+[^;&|]*-D(\b|\s)/.test(cmd)) {
  deny('git branch -D는 병합되지 않은 커밋도 확인 없이 삭제합니다. 사용자 승인 후에만 실행하세요.');
}

process.exit(0);

// Stop hook: 코드/fixture 파일 변경이 있으면 npm test(= npm run verify)를
// 강제한다. 실패 시 exit 2로 에이전트를 다시 깨워 수정을 요청한다
// ("코드 완료 = 테스트 통과" 규칙). 이 프로젝트는 SPEC.md §2/§8이 외부
// npm 패키지를 금지해 별도 lint/build 스크립트가 없다 — npm test/verify가
// 유일한 검증 게이트다(CLAUDE.md).
//
// bash 버전을 Node로 포팅한 크로스 플랫폼 구현 — Windows에서 bash 없이
// 동작한다(npm은 shell 경유로 실행해 npm.cmd 문제를 피한다).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let event = {};
try {
  event = JSON.parse(raw);
} catch {
  // 이벤트를 못 읽어도 검사 자체는 프로젝트 상태 기준으로 진행 가능
}

const projectDir = event?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(path.join(projectDir, 'package.json'))) {
  process.exit(0);
}

const CODE_FILE_REGEX = /\.(mjs|json)$/m;

function run(command, args) {
  return spawnSync(command, args, { cwd: projectDir, encoding: 'utf8' });
}

// 미커밋 변경뿐 아니라 이 턴에 이미 커밋된 변경(HEAD)도 검사 대상에 포함 —
// "검증 전에 커밋해서 clean 트리로 검사를 건너뛰는" 구멍을 막는다.
const statusOut = run('git', ['status', '--porcelain']).stdout ?? '';
const headOut = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).stdout ?? '';
if (!CODE_FILE_REGEX.test(statusOut + '\n' + headOut)) {
  process.exit(0);
}

// npm은 Windows에서 npm.cmd라 shell 경유가 필요하다. shell:true일 때 첫
// 인자는 명령 문자열 전체로 전달한다.
const result = spawnSync('npm test', {
  cwd: projectDir,
  encoding: 'utf8',
  shell: true,
});

if (result.status !== 0) {
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const tail = out.split('\n').slice(-60).join('\n');
  console.log('npm test 실패. 다음 에러를 수정하세요:');
  console.log(tail);
  process.exit(2);
}
process.exit(0);

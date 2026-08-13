# display-image-inspection — 네비게이션 인덱스

| 기능/주제 | 설명된 버전 (report.md 절) | 현재 코드 위치 |
|---|---|---|
| load_pgm | v2.2 report.md "구현 개요" (v2.1 CODE_ANALYSIS.md "구현 개요"에도 동일 언급) | src/main.py:22 |
| estimate_background | v2.2 report.md "핵심 로직 설명" (v2.1 CODE_ANALYSIS.md "핵심 로직 설명"에도 동일 코드 발췌) | src/main.py:33 |
| find_defect_clusters | v2.2 report.md "핵심 로직 설명" (v2.1 CODE_ANALYSIS.md "핵심 로직 설명"에도 동일) | src/main.py:39 |
| analyze_image | v2.2 report.md "구현 개요" (v2.1 CODE_ANALYSIS.md "구현 개요"에도 언급; 핵심 로직 절에는 별도 발췌 없음) | src/main.py:70 |
| main | v2.2 report.md "구현 개요" 및 "이번 버전에서 바뀐 점과 이유"(v2 항목) (v2.1 CODE_ANALYSIS.md에도 동일) | src/main.py:77 |
| DEVIATION_THRESHOLD | v2.2 report.md "핵심 로직 설명" (find_defect_clusters 발췌·튜닝 지점 설명 안에서 언급) | src/main.py:17 (값: 25) |
| MIN_CLUSTER_SIZE | v2.2 report.md "핵심 로직 설명" (튜닝 지점 설명 안에서 언급) | src/main.py:19 (값: 4) |
| defect_sizes | v2.2 report.md "이번 버전에서 바뀐 점과 이유" (v2 항목: "`main`에서 `defect_sizes` 리스트에 크기를 모아뒀다가...") | src/main.py:87 (초기화), 98 (append), 110~112 (평균 계산) |

## 비고
- v1.0, v2.0 스냅샷에는 `docs/report.md`/`CODE_ANALYSIS.md`가 없다(당시는 루트 `main.py`/`MANUAL.md` 구조, report.md 요구사항은 2026-08-13 도입이라 소급 적용 대상 아님).
- v2.1의 `CODE_ANALYSIS.md`와 v2.2(현재)의 `docs/report.md`는 파일 위치·이름만 다를 뿐 내용은 동일하다.
- report.md 본문 내 "v1 (C, 최초 구현)"/"v2 (D, 이번 등록)" 표기는 담당자가 서술한 내부 구현 단계 구분이며, 버전 레지스트리 상의 `v1.0`~`v2.2`와는 별개의 이름이다.

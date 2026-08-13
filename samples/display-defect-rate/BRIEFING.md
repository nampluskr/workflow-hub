# display-defect-rate — 인수인계 브리핑

## 용도
스마트폰 디스플레이 생산 라인에서 나오는 설비별·모델별 생산량·불량 수량 데이터를 읽어, 설비 5개(EQ-01~05)와 디스플레이 모델 10종(DISP-01~10) 각각의 불량율을 집계한다. 특정 설비나 특정 모델에서 불량율이 튀는지 한눈에 보기 위한 도구다.

## 입출력
- 입력: `data/production.csv` — 열은 `facility_id, model_id, produced_qty, defect_qty`. 한 행 = 설비 하나 × 모델 하나의 생산 실적.
- 출력: 콘솔에 설비별/모델별 불량율 표와 전체 평균 불량율을 출력하고, `data/report.csv`에 설비·모델별 내용을 `scope, id, produced_qty, defect_qty, defect_rate` 열로 저장한다.
- 실행: `python samples/display-defect-rate/src/main.py` (입출력 경로를 바꾸려면 `python samples/display-defect-rate/src/main.py <입력.csv> <출력.csv>`)

## 수정 시 건드릴 파일
- `src/main.py` — 전체 로직. `load_rows`(CSV 읽기) → `aggregate`(설비/모델별 합산 및 불량율 계산) → `print_table`/`write_report`(출력) → `overall_defect_rate`(전체 평균, v2에서 추가) 순서로 구성.
  - `aggregate`는 `key`("facility_id" 또는 "model_id")를 파라미터로 받는 단일 함수다. 설비용·모델용을 따로 만들지 않고 인자만 바꿔 두 번 호출하는 구조라, 집계 로직 자체를 고치면 설비/모델 양쪽에 동시에 영향이 간다 — 한쪽만 고치고 싶어도 분리되어 있지 않다.
  - 집계 기준을 하나 더 늘리려면(예: 교대조별) `aggregate(rows, "새키")` 호출만 추가하면 되지만, `print_table`/`write_report` 호출도 반드시 같이 늘려야 한다 — 이 셋이 항상 짝으로 늘어난다는 걸 놓치기 쉽다(report.md 명시).
  - `print_table`과 `write_report`는 의도적으로 분리되어 있다: 화면 출력은 열 너비 서식이 필요하고, `report.csv`는 다른 프로그램이 다시 읽을 데이터라 서식 없이 소수 4자리 고정값을 쓴다. 둘을 합치면 CSV 포맷을 바꿀 때 화면 출력까지 같이 깨지기 쉬우므로, CSV 포맷만 바꾸고 싶을 때도 `write_report`만 건드리고 `print_table`은 그대로 둬야 한다.
  - `overall_defect_rate`는 `aggregate`를 재사용하지 않고 별도 함수다. 전체 평균은 그룹 키가 없는 단일 값이라 `aggregate`의 반환 구조(그룹명 → 집계)에 억지로 끼워 맞추면 호출부가 복잡해지기 때문 — 전체 평균 계산 방식을 바꿀 때 `aggregate` 쪽은 건드릴 필요 없다.
  - `load_rows`는 컬럼명이 정확히 `facility_id, model_id, produced_qty, defect_qty`라고 가정하고 입력 검증이 없다(수동 실행 소규모 도구라는 전제). 자동 파이프라인에 편입한다면 이 부분에 명시적 검증을 추가해야 한다.
- `data/production.csv` — 샘플 입력 데이터. 실제 데이터로 교체 시 열 이름(`facility_id, model_id, produced_qty, defect_qty`)을 유지해야 한다. 생산량 0인 행이 섞여도 `aggregate`가 0으로 나누지 않고 불량율 0%로 처리하므로 죽지 않는다(의도된 처리).

## 최근 버전 이력
- v2.2 (B, 2026-08-13) — 디렉터리 구조 재정리 - README.md/src/docs (개별 레포 전환 대비)
- v2.1 (B, 2026-08-13) — 상세 코드 분석 문서(CODE_ANALYSIS.md) 추가
- v2.0 (B, 2026-08-13) — 전체 평균 불량율 출력 추가

# display-defect-rate — 코드 분석

## 구현 개요
`main.py` 하나로 끝나는 파이프라인이다: CSV 한 줄(설비 하나 × 모델 하나의 생산 실적)을 파이썬 딕셔너리로 바꾸는 `load_rows`, 그 딕셔너리들을 설비 기준·모델 기준으로 각각 합산해 불량율을 계산하는 `aggregate`, 그 결과를 사람이 읽을 표와 파일로 내보내는 `print_table`/`write_report`로 나뉜다. 데이터가 "CSV → 딕셔너리 리스트 → 집계 딕셔너리 → 표/CSV" 순서로 한 방향으로만 흐르고, 중간에 전역 상태를 두지 않는다. 그래서 `aggregate`를 설비 기준으로 한 번, 모델 기준으로 한 번 — 같은 함수를 인자만 바꿔 두 번 호출하는 식으로 재사용할 수 있었다.

## 핵심 로직 설명

집계의 핵심은 `aggregate` 하나다:

```python
def aggregate(rows, key):
    totals = {}
    for row in rows:
        bucket = totals.setdefault(row[key], {"produced_qty": 0, "defect_qty": 0})
        bucket["produced_qty"] += row["produced_qty"]
        bucket["defect_qty"] += row["defect_qty"]
    return {
        name: {**counts, "defect_rate": counts["defect_qty"] / counts["produced_qty"] if counts["produced_qty"] else 0.0}
        for name, counts in totals.items()
    }
```

`key`를 `"facility_id"`로 주면 설비별, `"model_id"`로 주면 모델별 집계가 나온다 — 설비 5개·모델 10종을 각각 다른 함수로 짜지 않고 "무엇을 기준으로 묶을지"만 파라미터화했다. `setdefault`로 버킷을 만드는 이유는, 어떤 설비·모델이 데이터에 몇 번 나오는지 미리 알 필요 없이 한 번의 순회로 끝내기 위해서다(딕셔너리에 없으면 만들고, 있으면 그냥 더한다). 불량율 계산에서 `if counts["produced_qty"] else 0.0`을 넣은 이유는 실무 데이터에 "생산량 0인데 행만 있는" 이상 케이스가 섞여 들어올 수 있어서다 — 0으로 나누다 프로그램이 죽는 것보다는 불량율 0%로 표시하고 넘어가는 게, 이 리포트의 목적(불량율이 튀는 곳을 찾는 것)에 더 맞는다고 판단했다.

`print_table`과 `write_report`를 굳이 나눈 이유: 화면 출력은 사람이 바로 보라고 있는 것이고 열 너비를 맞추는 서식(`:<10`, `:>10` 같은)이 필요하지만, `report.csv`는 다른 프로그램이 다시 읽을 수도 있는 데이터라 서식 없이 숫자 그대로(`defect_rate`도 반올림된 문자열이 아니라 소수 4자리 고정)를 넣는다. 화면용 서식과 데이터용 값을 같은 함수에서 만들면 나중에 CSV 포맷을 바꿀 때 화면 출력까지 같이 깨지기 쉬워서 분리했다.

## 이번 버전에서 바뀐 점과 이유
- **v1 (A, 최초 구현)**: 설비별·모델별 집계와 CSV 리포트까지가 요구사항의 전부였다. `aggregate`를 파라미터화한 것도 이 시점 결정 — 설비용/모델용 집계 함수를 따로 만들면 로직이 갈라져 유지보수가 두 배가 될 거라 판단했다.
- **v2 (B, 이번 등록)**: 설비별 표만 보면 "이 정도면 괜찮은 건가"를 판단하기 애매하다는 현장 피드백이 있어 `overall_defect_rate`(전체 평균 불량율)를 추가했다. 기존 `aggregate`를 재사용하지 않고 별도 함수로 뺀 이유는, 전체 평균은 "설비"나 "모델" 같은 그룹 키가 없는 단일 값이라 `aggregate`가 반환하는 딕셔너리 구조(그룹명 → 집계)에 억지로 끼워 맞추면 오히려 호출부가 복잡해지기 때문이다.

## 알려진 제약 · 다음에 볼 사람이 알아야 할 것
- `load_rows`는 CSV 컬럼 이름이 정확히 `facility_id, model_id, produced_qty, defect_qty`라고 가정한다. 컬럼이 하나라도 빠지면 `KeyError`로 죽는다 — 입력 검증을 따로 두지 않은 건, 이 스크립트가 사람이 수동으로 CSV를 만들어 돌리는 소규모 도구라 실패가 바로 눈에 띄기 때문이다. 자동 파이프라인에 넣는다면 이 부분에 명시적 검증을 추가해야 한다.
- 집계 기준을 설비·모델 외에 하나 더 늘리려면(예: 생산 라인 교대조별) `aggregate(rows, "shift_id")`처럼 호출만 추가하면 되지만, `print_table`/`write_report` 호출도 같이 늘려야 한다 — 이 셋이 항상 짝으로 늘어난다는 걸 놓치기 쉽다.

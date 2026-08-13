# aggregate

**설명된 버전**: v2.5 report.md "핵심 로직 설명"
**코드 위치**: src/main.py:26

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

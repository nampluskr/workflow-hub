# display-defect-rate

## 용도
스마트폰 디스플레이 생산 라인에서 나오는 설비별·모델별 생산량·불량 수량 데이터를 읽어, 설비 5개(EQ-01~05)와 디스플레이 모델 10종(DISP-01~10) 각각의 불량율을 집계한다. 특정 설비나 특정 모델에서 불량율이 튀는지 한눈에 보기 위한 도구다.

## 입출력
- 입력: `data/production.csv` — 열은 `facility_id, model_id, produced_qty, defect_qty`. 한 행 = 설비 하나 × 모델 하나의 생산 실적.
- 출력: 콘솔에 설비별/모델별 불량율 표와 전체 평균 불량율을 출력하고, `data/report.csv`에 설비·모델별 내용을 `scope, id, produced_qty, defect_qty, defect_rate` 열로 저장한다.

## 실행 방법
```
python samples/display-defect-rate/main.py
```
입력·출력 경로를 바꾸려면:
```
python samples/display-defect-rate/main.py <입력.csv> <출력.csv>
```

## 수정 시 참고
- `main.py` — 전체 로직. `load_rows`(CSV 읽기) → `aggregate`(설비/모델별 합산 및 불량율 계산) → `print_table`/`write_report`(출력) → `overall_defect_rate`(전체 평균, v2에서 추가) 순서로 구성.
- `data/production.csv` — 샘플 입력 데이터. 실제 데이터로 교체 시 열 이름(`facility_id, model_id, produced_qty, defect_qty`)을 유지해야 한다.
- 집계 기준(설비/모델)을 늘리려면 `aggregate` 호출을 추가하고 `print_table`/`write_report`에 대응하는 출력을 더한다.

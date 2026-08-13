# DEVIATION_THRESHOLD

**설명된 버전**: v2.4 report.md "핵심 로직 설명"
**코드 위치**: src/main.py:17

`find_defect_clusters`의 `is_anomalous` 판정 기준이다:

```python
is_anomalous = lambda x, y: abs(pixels[y][x] - background) >= DEVIATION_THRESHOLD
```

배경과 `DEVIATION_THRESHOLD` 이상 차이나는 픽셀 하나를 찾으면, 거기서 상하좌우로 계속 뻗어가며 "붙어있는 이상 픽셀"을 전부 하나의 불량으로 묶는다. `DEVIATION_THRESHOLD`와 `MIN_CLUSTER_SIZE` 두 상수가 사실상 이 알고리즘의 유일한 튜닝 지점이다.

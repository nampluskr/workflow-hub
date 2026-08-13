# DEVIATION_THRESHOLD

**설명된 버전**: v2.5 report.md "핵심 로직 설명"
**코드 위치**: src/main.py:17

군집화는 4방향 flood-fill이다:

```python
def find_defect_clusters(width, height, pixels, background):
    visited = [[False] * width for _ in range(height)]
    is_anomalous = lambda x, y: abs(pixels[y][x] - background) >= DEVIATION_THRESHOLD
    ...
```

배경과 `DEVIATION_THRESHOLD` 이상 차이나는 픽셀 하나를 찾으면, 거기서 상하좌우로 계속 뻗어가며 "붙어있는 이상 픽셀"을 전부 하나의 불량으로 묶는다. `MIN_CLUSTER_SIZE` 미만인 군집을 버리는 건, 픽셀 노이즈 한두 개가 우연히 임계값을 넘는 걸 진짜 불량과 구분하기 위해서다 — 이 두 상수(`DEVIATION_THRESHOLD`, `MIN_CLUSTER_SIZE`)가 사실상 이 알고리즘의 유일한 튜닝 지점이다.

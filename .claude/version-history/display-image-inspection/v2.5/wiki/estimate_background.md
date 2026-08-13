# estimate_background

**설명된 버전**: v2.4 report.md "핵심 로직 설명"
**코드 위치**: src/main.py:33

불량 판정에서 가장 중요한 결정은 "정상 밝기를 어떻게 정할 것인가"다:

```python
def estimate_background(pixels):
    all_values = sorted(v for row in pixels for v in row)
    mid = len(all_values) // 2
    return all_values[mid]
```

평균이 아니라 **중앙값**을 썼다. 디스플레이 검사 이미지는 정상 영역이 화면 대부분을 차지하고 불량은 일부 픽셀에만 있으므로, 불량 픽셀 몇 개가 평균을 끌어당기는 걸 피하려면 중앙값이 이상치에 훨씬 강하다. 이미지 전체가 거의 균일한 배경이라는 전제가 있어서 가능한 단순화이고, 배경 자체가 불균일한 이미지(예: 화면에 원래 무늬가 있는 경우)에는 안 맞는다.

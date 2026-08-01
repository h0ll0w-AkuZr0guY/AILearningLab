"""vllm-01-07 SLO 与 goodput：分位数契约与达标判定（离线合同实验）。

复刻 vllm bench serve --goodput ttft:tpot:e2el 的判定逻辑与
per-request metrics 的口径：平均值稀释、goodput 占比、tokens/s 含 prefill、
max-concurrency 截断样本。
运行：python 07_slo_goodput.py
"""


def quantile_from_histogram(percentile: float,
                            buckets: dict[float, int]) -> float:
    """从累计桶计数近似分位数（桶内线性插值）。"""
    total = sum(buckets.values())
    target = percentile * total
    acc = 0
    prev_bound, prev_acc = 0.0, 0
    for bound, count in sorted(buckets.items()):
        acc += count
        if acc >= target:
            frac = (target - prev_acc) / (acc - prev_acc) if count else 0
            return prev_bound + frac * (bound - prev_bound)
        prev_bound, prev_acc = bound, acc
    return prev_bound


def goodput_ratio(requests: list[dict[str, float]],
                  ttft_ms: float, tpot_ms: float, e2el_ms: float) -> float:
    """统计同时满足三个 SLO 的请求占比。"""
    passed = 0
    for r in requests:
        ok = (r["ttft_ms"] <= ttft_ms and r["tpot_ms"] <= tpot_ms
              and r["e2el_ms"] <= e2el_ms)
        passed += int(ok)
    return passed / len(requests)


def synthetic_ttft(n_fast=90, n_slow=10, fast_ms=100, slow_ms=20000):
    """90 个 100ms + 10 个 20s（10% 尾部），复现平均值稀释长尾。"""
    return [fast_ms] * n_fast + [slow_ms] * n_slow


def reported_vs_true(request_rate: float, capacity: float,
                     concurrency: int) -> dict[str, float]:
    """request_rate 高于 capacity 时，实际速率被并发上限截断。"""
    admitted = min(request_rate, capacity)
    dropped = max(request_rate - admitted, 0.0)
    return {"admitted": admitted, "dropped": dropped,
            "loss_ratio": dropped / request_rate if request_rate else 0.0}


def main() -> None:
    # 断言 1：平均值 vs p95 的稀释效应（90 快 + 10 慢 → p95 暴露长尾）
    samples = synthetic_ttft()
    mean = sum(samples) / len(samples)
    buckets: dict[float, int] = {}
    for s in samples:
        b = (s // 1000 + 1) * 1000.0
        buckets[b] = buckets.get(b, 0) + 1
    p95 = quantile_from_histogram(0.95, buckets)
    assert mean < 3000, f"平均被稀释到 {mean:.0f}ms"
    assert p95 > 10000, f"p95 应接近 20s，实际 {p95:.0f}ms"
    assert p95 > 3 * mean

    # 断言 2：goodput 判定（三个 SLO 同时达标）
    reqs = [
        {"ttft_ms": 100, "tpot_ms": 30, "e2el_ms": 3000},
        {"ttft_ms": 900, "tpot_ms": 30, "e2el_ms": 3000},   # TTFT 超标
        {"ttft_ms": 100, "tpot_ms": 90, "e2el_ms": 3000},   # TPOT 超标
        {"ttft_ms": 100, "tpot_ms": 30, "e2el_ms": 26000},  # E2EL 超标
        {"ttft_ms": 100, "tpot_ms": 30, "e2el_ms": 3000},
    ]
    ratio = goodput_ratio(reqs, ttft_ms=800, tpot_ms=80, e2el_ms=25000)
    assert abs(ratio - 0.4) < 1e-9

    # 断言 3：全部达标时 goodput = 1
    all_ok = [{"ttft_ms": 50, "tpot_ms": 20, "e2el_ms": 2000}] * 100
    assert goodput_ratio(all_ok, 800, 80, 25000) == 1.0

    # 断言 4：tokens_per_second 含 prefill（口径验证）
    tps_with_prefill = 256 / 2.5    # 含 2s prefill + 0.5s decode
    tps_decode_only = 256 / 0.5
    assert tps_with_prefill < tps_decode_only

    # 断言 5：max-concurrency 截断样本
    r = reported_vs_true(request_rate=10.0, capacity=4.0, concurrency=16)
    assert r["admitted"] == 4.0 and r["loss_ratio"] == 0.6

    print("vllm-01-07 SLO/goodput: 全部断言通过")


if __name__ == "__main__":
    main()

"""vllm-01-09 吞吐与延迟指标：Counter/直方图/区间换算（离线合同实验）。

复刻 vllm/v1/metrics/stats.py v0.26.0 的 IterationStats 核心换算：
- rate() 语义：Counter 累计值必须求变化率
- 五区间：queued/prefill/decode/inference/e2e 由事件时间戳之差得到
- mean_tpot = decode / (generation_tokens - 1)，单 token 响应为 0
- 首次 SCHEDULED 不因抢占覆盖
运行：python 09_throughput_metrics.py
"""


def rate(counter: list[float], window_seconds: float) -> float:
    """Counter 的变化率：rate() 语义。"""
    return (counter[-1] - counter[0]) / window_seconds


def quantile_from_histogram(percentile: float,
                            buckets: dict[float, int]) -> float:
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


def intervals(t: dict[str, float], num_generation_tokens: int) -> dict[str, float]:
    """复刻 update_from_finished_request 的五区间 + TPOT 均值。"""
    out = {
        "queued": t["scheduled"] - t["queued"],
        "prefill": t["first_token"] - t["scheduled"],
        "decode": t["last_token"] - t["first_token"],
        "inference": t["last_token"] - t["scheduled"],
        "e2e": t["finished"] - t["arrival"],
    }
    out["mean_tpot"] = (
        out["decode"] / (num_generation_tokens - 1)
        if num_generation_tokens - 1 > 0 else 0.0
    )
    return out


def update_scheduled(scheduled_ts: float, event_ts: float) -> float:
    """首次 SCHEDULED 才写入；抢占不覆盖。"""
    return scheduled_ts if scheduled_ts != 0.0 else event_ts


def main() -> None:
    # 断言 1：累计值不是速率
    generation_counter = [1_000_000, 1_100_000, 1_200_000, 1_300_000]
    assert rate(generation_counter, 300.0) == 1000.0
    assert generation_counter[-1] != rate(generation_counter, 300.0)

    # 断言 2：五区间计算
    t = {"arrival": 100.0, "queued": 101.0, "scheduled": 105.0,
         "first_token": 106.0, "last_token": 116.0, "finished": 117.0}
    iv = intervals(t, num_generation_tokens=101)
    assert iv["queued"] == 4.0
    assert iv["prefill"] == 1.0
    assert iv["decode"] == 10.0
    assert iv["inference"] == 11.0
    assert abs(iv["e2e"] - 17.0) < 1e-9
    assert abs(iv["mean_tpot"] - 0.1) < 1e-9

    # 断言 3：单 token 响应 TPOT 为 0（per-request 字段 null 语义）
    iv1 = intervals(t, num_generation_tokens=1)
    assert iv1["mean_tpot"] == 0.0

    # 断言 4：分位数 vs 均值（90 快 + 10 慢 → p95 暴露长尾）
    ttft_samples = [100] * 90 + [20000] * 10
    buckets: dict[float, int] = {}
    for s in ttft_samples:
        b = (s // 1000 + 1) * 1000.0
        buckets[b] = buckets.get(b, 0) + 1
    p95 = quantile_from_histogram(0.95, buckets)
    mean = sum(ttft_samples) / len(ttft_samples)
    assert p95 > 10000 and mean < 3000

    # 断言 5：抢占不覆盖 scheduled_ts
    sched = 0.0
    sched = update_scheduled(sched, 105.0)
    sched = update_scheduled(sched, 130.0)
    assert sched == 105.0

    # 断言 6：prompt/generation 拆分
    prompt_total, generation_total = 400_000, 900_000
    assert prompt_total + generation_total == 1_300_000

    print("vllm-01-09 throughput metrics: 全部断言通过")


if __name__ == "__main__":
    main()

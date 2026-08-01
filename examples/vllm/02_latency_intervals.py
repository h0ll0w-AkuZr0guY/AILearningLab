"""TTFT/TPOT 四段区间：从事件时间戳复刻 stats.py 的区间公式。

对应课程 vllm-01-02。无第三方依赖，纯标准库。
"""


class FinishedRequestStats:
    """复刻 stats.py 的 FinishedRequestStats 字段。"""

    def __init__(self, **kw: float) -> None:
        for k, v in kw.items():
            setattr(self, k, v)


def finish_request(
    arrival_ts: float, queued_ts: float, scheduled_ts: float,
    first_token_ts: float, last_token_ts: float, num_generation_tokens: int,
) -> FinishedRequestStats:
    """按 stats.py 的公式从事件时间戳计算全部区间与 TPOT。"""
    e2e = last_token_ts - arrival_ts
    queued_time = scheduled_ts - queued_ts
    prefill_time = first_token_ts - scheduled_ts
    decode_time = last_token_ts - first_token_ts
    inference_time = last_token_ts - scheduled_ts
    tpot = (decode_time / (num_generation_tokens - 1)
            if num_generation_tokens - 1 > 0 else 0.0)
    return FinishedRequestStats(
        e2e_latency=e2e, queued_time=queued_time, prefill_time=prefill_time,
        decode_time=decode_time, inference_time=inference_time,
        mean_time_per_output_token=tpot,
        num_generation_tokens=num_generation_tokens,
    )


# 时间轴：到达 0ms，排队 10ms，调度 20ms 后出首 token，随后每 30ms 一个 token
s = finish_request(
    arrival_ts=0.0, queued_ts=0.5, scheduled_ts=10.5,
    first_token_ts=30.5, last_token_ts=150.5, num_generation_tokens=5,
)
assert s.queued_time == 10.0                 # scheduled - queued
assert s.prefill_time == 20.0                # first_token - scheduled
assert s.decode_time == 120.0                # last_token - first_token
assert s.inference_time == 140.0             # last_token - scheduled
assert s.e2e_latency == 150.5                # last_token - arrival
assert s.prefill_time + s.decode_time == s.inference_time   # 守恒

# TPOT 分母是 N-1 = 4，而不是 5
assert abs(s.mean_time_per_output_token - 30.0) < 1e-9
wrong = s.decode_time / s.num_generation_tokens
assert wrong == 24.0 and wrong < 30.0        # 用 N 做分母会低估 20%

# 单 token 响应：分母保护，TPOT 记 0
one = finish_request(0.0, 0.5, 10.5, 30.5, 30.5, 1)
assert one.decode_time == 0.0 and one.mean_time_per_output_token == 0.0

# 两种 TTFT 口径：相差一个排队时长
ttft_arrival = s.prefill_time + s.queued_time      # arrival 口径
ttft_scheduled = s.prefill_time                    # scheduled 口径
assert ttft_arrival == 30.0 and ttft_scheduled == 20.0
assert ttft_arrival - ttft_scheduled == s.queued_time

# 抢占落入所属区间：prefill 中插入 5ms 停顿，prefill_time 变大
preempted = finish_request(0.0, 0.5, 10.5, 35.5, 150.5, 5)
assert preempted.prefill_time == 25.0              # 20ms 计算 + 5ms 抢占停顿

print("vllm-01-02 latency intervals: ALL PASS")

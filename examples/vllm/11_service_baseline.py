"""vllm-01-11 服务基线：bench serve 指标聚合与 goodput 判定（离线合同实验）。

复刻 vllm/benchmarks/serve.py v0.26.0 的 calculate_metrics 核心：
- request_throughput = completed / dur_s
- total_token_throughput = (total_input + actual_output) / dur_s
- goodput：声明的 ttft/tpot/e2el SLO 全部满足才算达标请求
- 失败请求计入 failed、不进延迟样本
运行：python 11_service_baseline.py
"""

from dataclasses import dataclass


@dataclass
class ReqOutput:
    """单个请求的 bench 输出（对应 serve.py 的 RequestFuncOutput）。"""
    success: bool
    ttft_s: float = 0.0
    itl_s: list[float] | None = None      # 相邻 token 间隔（不含首 token）
    e2el_s: float = 0.0
    output_tokens: int = 0


def calculate_metrics(outputs: list[ReqOutput], dur_s: float,
                      goodput_ms: dict[str, float] | None = None) -> dict:
    """复刻 serve.py calculate_metrics 的核心聚合（L556-735）。"""
    completed = failed = total_input = 0
    total_output = sum(o.output_tokens for o in outputs)
    ttfts: list[float] = []
    e2els: list[float] = []
    all_tpots: list[float] = []
    good_completed = 0
    for o in outputs:
        if o.success:
            completed += 1
            ttfts.append(o.ttft_s)
            e2els.append(o.e2el_s)
            if o.itl_s:
                all_tpots.extend(o.itl_s)
        else:
            failed += 1

    if goodput_ms:
        slo_values, valid_metrics = [], []
        if "ttft" in goodput_ms:
            valid_metrics.append(ttfts)
            slo_values.append(goodput_ms["ttft"] / 1000.0)
        if "tpot" in goodput_ms:
            valid_metrics.append(all_tpots)
            slo_values.append(goodput_ms["tpot"] / 1000.0)
        if "e2el" in goodput_ms:
            valid_metrics.append(e2els)
            slo_values.append(goodput_ms["e2el"] / 1000.0)
        if valid_metrics:
            for req_metric in zip(*valid_metrics):
                if all(s >= r for s, r in zip(slo_values, req_metric)):
                    good_completed += 1

    result = {
        "completed": completed,
        "failed": failed,
        "request_throughput": completed / dur_s if dur_s else 0.0,
        "total_token_throughput": (total_input + total_output) / dur_s if dur_s else 0.0,
        "request_goodput": good_completed / dur_s if dur_s else 0.0,
    }
    if completed:
        result["mean_ttft_ms"] = sum(ttfts) / len(ttfts) * 1000
        result["p99_ttft_ms"] = sorted(ttfts)[int(0.99 * (len(ttfts) - 1))] * 1000
        result["mean_tpot_ms"] = (sum(all_tpots) / len(all_tpots) * 1000
                                  if all_tpots else 0.0)
    return result


def main() -> None:
    # 断言 1：吞吐 = completed / dur_s
    outputs = [
        ReqOutput(success=True, ttft_s=0.05, itl_s=[0.01, 0.01], e2el_s=0.2, output_tokens=64),
        ReqOutput(success=True, ttft_s=0.08, itl_s=[0.02], e2el_s=0.3, output_tokens=48),
        ReqOutput(success=True, ttft_s=0.07, itl_s=[0.01, 0.02], e2el_s=0.25, output_tokens=72),
    ]
    r1 = calculate_metrics(outputs, dur_s=1.5)
    assert r1["completed"] == 3 and r1["failed"] == 0
    assert abs(r1["request_throughput"] - 3 / 1.5) < 1e-9
    assert abs(r1["total_token_throughput"] - 184 / 1.5) < 1e-9

    # 断言 2：失败请求计入 failed、不进延迟样本
    mixed = outputs + [ReqOutput(success=False, e2el_s=9.9)]
    r2 = calculate_metrics(mixed, dur_s=2.0)
    assert r2["failed"] == 1 and r2["completed"] == 3
    assert r2["request_throughput"] == 3 / 2.0

    # 断言 3：goodput 只在声明指标上判定
    slow = [
        ReqOutput(success=True, ttft_s=0.1, itl_s=[0.05, 0.05], e2el_s=30.0, output_tokens=64),
        ReqOutput(success=True, ttft_s=0.2, itl_s=[0.05, 0.05], e2el_s=31.0, output_tokens=64),
    ]
    rg_all = calculate_metrics(slow, 1.0, goodput_ms={"ttft": 800, "tpot": 80, "e2el": 25000})
    rg_ttft_only = calculate_metrics(slow, 1.0, goodput_ms={"ttft": 800})
    assert rg_all["request_goodput"] == 0.0
    assert rg_ttft_only["request_goodput"] == 2.0

    # 断言 4：p99 与 mean 分离（长尾）
    tail = [ReqOutput(success=True, ttft_s=0.05, itl_s=[0.01], e2el_s=0.2, output_tokens=8) for _ in range(90)]
    tail += [ReqOutput(success=True, ttft_s=10.0, itl_s=[0.01], e2el_s=11.0, output_tokens=8) for _ in range(10)]
    rt = calculate_metrics(tail, 5.0)
    assert rt["mean_ttft_ms"] < 1500
    assert rt["p99_ttft_ms"] > 9000

    # 断言 5：all_tpots 聚合多 token 间隔
    multi = [ReqOutput(success=True, ttft_s=0.05, itl_s=[0.01, 0.02, 0.03], e2el_s=0.2, output_tokens=4)]
    rm = calculate_metrics(multi, 0.5)
    assert abs(rm["mean_tpot_ms"] - 20.0) < 1e-9

    print("vllm-01-11 service baseline: 全部断言通过")


if __name__ == "__main__":
    main()

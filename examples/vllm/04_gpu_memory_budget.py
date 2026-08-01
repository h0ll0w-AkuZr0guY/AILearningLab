"""gpu_memory_utilization 基数：复刻 request_memory 与 KV 余量/块数公式。

对应课程 vllm-01-04。无第三方依赖，纯标准库。
"""

import math


def request_memory(total_memory: int, gpu_memory_utilization: float,
                   free_memory: int) -> int:
    """复刻 worker/utils.py 的 request_memory：基数是总显存。"""
    requested = math.ceil(total_memory * gpu_memory_utilization)
    if free_memory < requested:
        raise ValueError(
            f"Free memory {free_memory} < requested {requested}: "
            "decrease gpu_memory_utilization"
        )
    return requested


def available_kv_bytes(requested: int, non_kv: int, cudagraph: int) -> int:
    """复刻 gpu_worker.py 的 available_kv_cache_memory_bytes。"""
    return requested - non_kv - cudagraph


def num_blocks(kv_bytes: int, bytes_per_block: int) -> int:
    return kv_bytes // bytes_per_block   # kv_cache_utils.py：available // bytes_per_block


# 80GB 卡、util 0.92、权重 16GB、激活峰值 1.2GB、graph 1.0GB
total = 80 * 1024**3
free = 78 * 1024**3                      # 同卡已用 2GB（例如别的进程）
requested = request_memory(total, 0.92, free)
assert requested == math.ceil(total * 0.92)
non_kv = 16 * 1024**3 + int(1.2 * 1024**3) + int(0.8 * 1024**3)
graph = int(1.0 * 1024**3)
kv = available_kv_bytes(requested, non_kv, graph)
# 58GiB 量级：权重与运行时开销从预算内扣除，KV 是余量
assert kv < 0.92 * total and kv < total - 16 * 1024**3

# 块数：block_size=16、每 token KV 0.4KB
bytes_per_block = 16 * int(0.4 * 1024)
blocks = num_blocks(kv, bytes_per_block)
assert blocks == kv // bytes_per_block

# 同卡多实例：util 之和超过 1 时后启动者报错（空闲 8GB < 申请 73.6GB）
try:
    request_memory(80 * 1024**3, 0.92, int(8 * 1024**3))
    raise AssertionError("must fail: free < requested")
except ValueError:
    pass

# 手工模式：忽略 util，直接用字节数
kv_manual = 40 * 1024**3
assert kv_manual != available_kv_bytes(requested, non_kv, graph)

# max_model_len 变大 -> 激活峰值升高 -> KV 余量变小（反直觉现象）
kv_small_act = available_kv_bytes(requested, non_kv + int(2 * 1024**3), graph)
assert kv_small_act < kv

print("vllm-01-04 gpu memory budget: ALL PASS")

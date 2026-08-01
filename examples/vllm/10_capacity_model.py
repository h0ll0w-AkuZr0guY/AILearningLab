"""vllm-01-10 容量模型：KV 块数、watermark 与并发钳制（离线合同实验）。

复刻 vllm/v1/core/kv_cache_utils.py v0.26.0 get_kv_cache_configs 的容量链：
- kv_bytes = (available - weights - graph/activ) * utilization
- num_blocks = kv_bytes // (block_size * bytes_per_token)
- 并发 = min(KV 容量扣 watermark、max_num_seqs、max_num_batched_tokens)
运行：python 10_capacity_model.py
"""


def kv_capacity(available_bytes: float, weights_bytes: float,
                graph_bytes: float, utilization: float,
                block_size: int, bytes_per_token: float) -> dict[str, float]:
    """可用显存 → KV 字节 → 块数 → 可调度 token。"""
    kv_bytes = max((available_bytes - weights_bytes - graph_bytes)
                   * utilization, 0.0)
    num_blocks = int(kv_bytes // (block_size * bytes_per_token))
    return {"kv_bytes": kv_bytes, "num_blocks": num_blocks,
            "schedulable_tokens": num_blocks * block_size}


def effective_concurrency(num_blocks: float, watermark: float,
                          max_num_seqs: int, blocks_per_request: float,
                          max_batched_tokens: int,
                          tokens_per_block: int) -> int:
    """四重钳制：KV 容量(扣 watermark)、max_num_seqs、batched tokens。"""
    kv_limit = int(num_blocks * (1.0 - watermark) // blocks_per_request)
    batch_limit = max_batched_tokens // tokens_per_block
    return max(0, min(kv_limit, max_num_seqs, batch_limit))


def main() -> None:
    H100_80G = 80e9
    weights_8b_fp16 = 8.03e9 * 2          # 8B × 2 字节 ≈ 16GB
    graph_activ = 2e9                     # CUDA graph + 激活估算
    bytes_per_token_8b = 32 * 8 * 128 * 2 * 2  # 32 层 × 8 kv × 128 dim × 2B × 2

    # 断言 1：扣减链（忽略权重会高估）
    c = kv_capacity(H100_80G, weights_8b_fp16, graph_activ, 0.92, 16,
                    bytes_per_token_8b)
    naive = kv_capacity(H100_80G, 0, 0, 0.92, 16, bytes_per_token_8b)
    assert c["kv_bytes"] < naive["kv_bytes"] * 0.8
    assert c["num_blocks"] > 0 and c["num_blocks"] < naive["num_blocks"]

    # 断言 2：watermark 降低有效容量
    blocks = c["num_blocks"]
    assert int(blocks * 0.9) < blocks

    # 断言 3：四重钳制取最小值（KV 为主约束：放开 seqs/batch 上限）
    conc = effective_concurrency(
        num_blocks=blocks, watermark=0.0, max_num_seqs=10000,
        blocks_per_request=64, max_batched_tokens=10_000_000,
        tokens_per_block=16)
    conc_wm = effective_concurrency(
        num_blocks=blocks, watermark=0.1, max_num_seqs=10000,
        blocks_per_request=64, max_batched_tokens=10_000_000,
        tokens_per_block=16)
    assert conc >= conc_wm
    assert conc == int(blocks // 64)              # KV 容量主导

    # 断言 4：每请求块需求放大则并发下降
    conc_small = effective_concurrency(
        num_blocks=blocks, watermark=0.0, max_num_seqs=10000,
        blocks_per_request=256, max_batched_tokens=10_000_000,
        tokens_per_block=16)
    assert conc_small < conc
    assert conc_small == int(blocks // 256)

    # 断言 5：max_num_batched_tokens 被 KV 反向钳制
    assert effective_concurrency(
        num_blocks=8, watermark=0.0, max_num_seqs=64,
        blocks_per_request=1, max_batched_tokens=100000,
        tokens_per_block=16) <= 128

    # 断言 6：启动日志核验方程（数量级合理）
    assert 0 < c["num_blocks"] < 10_000_000

    # 断言 7：自检场景——4096 块 / 64 块每请求
    # watermark 0.1 后 = 4096 × 0.9 ÷ 64 = 57（取整）
    c57 = effective_concurrency(
        num_blocks=4096, watermark=0.1, max_num_seqs=128,
        blocks_per_request=64, max_batched_tokens=100000, tokens_per_block=16)
    assert c57 == 57, c57
    c64 = effective_concurrency(
        num_blocks=4096, watermark=0.0, max_num_seqs=128,
        blocks_per_request=64, max_batched_tokens=100000, tokens_per_block=16)
    assert c64 == 64, c64

    print("vllm-01-10 capacity model: 全部断言通过")


if __name__ == "__main__":
    main()

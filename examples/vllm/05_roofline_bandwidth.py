"""decode 带宽受限：按 perf.py 的 FLOPs/字节公式做 roofline 判断。

对应课程 vllm-01-05。无第三方依赖，纯标准库。
"""


def roofline_classify(peak_flops: float, peak_bw: float,
                      num_params: int, bytes_per_param: float,
                      tokens: int, kv_bytes_per_token: float = 0.0,
                      context_len: int = 0) -> dict[str, float]:
    """按 perf.py 的结构估算 AI 并判断受限边。FLOPs≈2N·T，字节=权重+KV。"""
    flops = 2.0 * num_params * tokens
    bytes_read = (num_params * bytes_per_param
                  + kv_bytes_per_token * context_len * tokens)
    ai = flops / bytes_read
    ridge = peak_flops / peak_bw
    bound = "compute" if ai >= ridge else "memory"
    limit = (peak_flops / flops if bound == "compute"
             else peak_bw / bytes_read)
    return {"flops": flops, "bytes": bytes_read, "ai": ai,
            "ridge": ridge, "bound": bound, "limit": limit}


H100_FLOPS = 989e12        # FP16 dense Tensor Core
H100_BW = 3.35e12          # HBM3
LLAMA8B = 8.03e9
FP16 = 2.0
KV_BYTES_PER_TOKEN = 128e3  # Llama-3-8B 量级：32 层 x 8 kv heads x 128 dim x 2B x 2

# decode：T=1，AI 远低于 ridge，带宽受限
d = roofline_classify(H100_FLOPS, H100_BW, LLAMA8B, FP16, tokens=1)
assert d["ai"] < d["ridge"] and d["bound"] == "memory"
assert abs(d["limit"] - H100_BW / (LLAMA8B * FP16)) < 1e3  # 约 209 token/s

# prefill：T=2048，AI 高于 ridge，算力受限
p = roofline_classify(H100_FLOPS, H100_BW, LLAMA8B, FP16, tokens=2048)
assert p["ai"] > p["ridge"] and p["bound"] == "compute"

# 长上下文：KV 读使 decode 上限进一步下降
d_4k = roofline_classify(H100_FLOPS, H100_BW, LLAMA8B, FP16, 1,
                         KV_BYTES_PER_TOKEN, 4096)
d_128k = roofline_classify(H100_FLOPS, H100_BW, LLAMA8B, FP16, 1,
                           KV_BYTES_PER_TOKEN, 131072)
assert d_4k["limit"] < d["limit"] and d_128k["limit"] < d_4k["limit"]

# 低精度：权重字节减半，带宽上限约翻倍
d_fp8 = roofline_classify(H100_FLOPS, H100_BW, LLAMA8B, 1.0, tokens=1)
assert d_fp8["limit"] > 1.9 * d["limit"]          # fp16 -> fp8 接近两倍

# 加算力不加带宽：decode 上限几乎不变（带宽受限的推论）
d_b200_flops = roofline_classify(2 * H100_FLOPS, H100_BW, LLAMA8B, FP16, tokens=1)
assert d_b200_flops["limit"] == d["limit"]        # 算力翻倍无收益

# KV 字节与权重字节对比：131K context 时 KV 读约等于权重
kv_bytes_131k = KV_BYTES_PER_TOKEN * 131072
assert 0.8 < kv_bytes_131k / (LLAMA8B * FP16) < 1.2

print("vllm-01-05 roofline bandwidth: ALL PASS")

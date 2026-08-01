"""V1 统一 token 预算：复刻 scheduler.py schedule() 的两轮调度与 chunked prefill。

对应课程 vllm-01-01。无第三方依赖，纯标准库。
"""


class Request:
    """模拟 vllm/v1/request.py 的计数器：computed 追平 total。"""

    def __init__(self, rid: str, prompt: int, max_tokens: int = 8) -> None:
        self.id = rid
        self.num_prompt_tokens = prompt
        self.max_tokens = max_tokens
        self.num_computed_tokens = 0   # 已完成 forward 的 token 数
        self.num_output_tokens = 0     # 已生成的输出 token 数（prefill 结束时为 1）
        self.is_prefill_chunk = False

    def owed(self) -> int:
        # 与 Request.num_tokens_with_spec - num_computed_tokens 等价（无 spec 时）
        return (self.num_prompt_tokens + self.num_output_tokens
                ) - self.num_computed_tokens


def schedule_step(running: list[Request], waiting: list[Request],
                  budget: int, chunked: bool = True) -> dict[str, int]:
    """复刻 schedule() 的两轮结构：running 优先，waiting 消耗剩余预算。"""
    out: dict[str, int] = {}
    for req in list(running):
        if budget <= 0:
            break
        n = min(req.owed(), budget)
        if n > 0:
            out[req.id] = n
            budget -= n
    for req in list(waiting):
        if budget <= 0:
            break
        n = min(req.owed(), budget)
        if n == 0:
            continue
        if not chunked and n < req.owed():
            break   # 关闭 chunked：剩余预算装不下整个 prompt，整批停止接纳
        out[req.id] = n
        budget -= n
    return out


def step(running: list[Request], waiting: list[Request],
         budget: int = 32, chunked: bool = True) -> dict[str, int]:
    """执行一步调度并推进计数器。"""
    assigned = schedule_step(running, waiting, budget, chunked)
    for rid, n in assigned.items():
        req = next(r for r in running + waiting if r.id == rid)
        req.num_computed_tokens += n
        if req in running:
            if req.num_computed_tokens >= req.num_prompt_tokens:
                # 只有 prefill 已完成的请求才是 decode：每步采样 1 个输出 token
                req.num_output_tokens += 1
                if req.num_output_tokens >= req.max_tokens:
                    running.remove(req)     # 达到 max_tokens，收尾
        else:
            waiting.remove(req)
            if req.num_computed_tokens < req.num_prompt_tokens:
                req.is_prefill_chunk = True     # 欠账未还完，切块留在 running
            else:
                req.is_prefill_chunk = False    # prefill 完成，同时得到首个输出 token
                req.num_output_tokens = 1
            running.append(req)
    return assigned


d1 = Request("d1", prompt=4, max_tokens=6)
d1.num_computed_tokens = 4
d1.num_output_tokens = 1                        # 首个 token 已在 prefill 收尾步采样
d2 = Request("d2", prompt=4, max_tokens=6)
d2.num_computed_tokens = 4
d2.num_output_tokens = 1
long_prefill = Request("p1", prompt=200, max_tokens=1)

# 一个长 prefill 与两个 decode 在同一预算内共存（chunked 开启）
r, w = [d1, d2], [long_prefill]
first = step(r, w, budget=32)
assert first["d1"] == 1 and first["d2"] == 1    # decode 每步仍只补 1 个 token
assert first["p1"] == 30                        # 其余预算全部给了 prefill 第一块
assert d1.num_computed_tokens == 5 and long_prefill.num_computed_tokens == 30
assert long_prefill.is_prefill_chunk is True    # 没还完，留在 running

# 累计多步：prefill 被切块逐步追平，decode 全程不被饿死
steps = [first]
for _ in range(6):
    steps.append(step(r, [], budget=32))
assert long_prefill.num_computed_tokens == 200  # 欠账全部追平
assert d1 not in r and d2 not in r              # 两个 decode 都已收尾
assert all(s["d1"] == 1 for s in steps[1:4])    # decode 每步 1 token，从未间断

# 关闭 chunked：预算不足时新 prefill 整批被拒，剩余预算被浪费
d3 = Request("d3", prompt=4, max_tokens=3)
d3.num_computed_tokens = 4
d3.num_output_tokens = 1
p2 = Request("p2", prompt=40, max_tokens=1)
assign = schedule_step([d3], [p2], budget=16, chunked=False)
assert assign == {"d3": 1}                      # p2 未被接纳，budget 只给了 decode
assert p2.num_computed_tokens == 0              # p2 仍在等待队列

print("vllm-01-01 unified token budget: ALL PASS")

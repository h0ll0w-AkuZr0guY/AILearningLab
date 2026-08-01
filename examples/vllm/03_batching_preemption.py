"""batching 权衡与抢占：复刻 scheduler.py 的 running 轮抢占与 waiting 轮门禁。

对应课程 vllm-01-03。无第三方依赖，纯标准库。
"""


class Request:
    def __init__(self, rid: str, prompt: int, priority: int = 0,
                 arrival: int = 0, computed: int = 0) -> None:
        self.id = rid
        self.num_prompt_tokens = prompt
        self.num_computed_tokens = computed
        self.priority = priority
        self.arrival_time = arrival
        self.num_preemptions = 0


def select_victim(running: list[Request], policy: str) -> Request:
    """复刻抢占选择：PRIORITY 取 (priority, arrival) 最大者，FCFS 取队尾。"""
    if policy == "priority":
        victim = max(running, key=lambda r: (r.priority, r.arrival_time))
        running.remove(victim)
        return victim
    return running.pop()


def schedule_step(running: list[Request], waiting: list[Request],
                  budget: int, max_seqs: int, blocks_free: int,
                  policy: str = "fcfs") -> dict[str, int]:
    """复刻 schedule()：running 轮块不足触发抢占；有抢占则该步跳过 waiting 轮。"""
    out: dict[str, int] = {}
    preempted = False
    req_index = 0
    while req_index < len(running) and budget > 0:
        req = running[req_index]
        if blocks_free >= 1:
            out[req.id] = 1                  # decode 每步 1 token
            budget -= 1
            blocks_free -= 1
            req.num_computed_tokens += 1
            req_index += 1
            continue
        # KV 块耗尽：抢占直到块够或抢占到自己（真实代码为 while True 循环）
        preempted_self = False
        while blocks_free < 1 and running:
            victim = select_victim(running, policy)
            blocks_free += victim.num_computed_tokens   # 释放其 KV 块
            victim.num_computed_tokens = 0              # 进度清零
            victim.num_preemptions += 1
            waiting.insert(0, victim)                   # 回队首
            preempted = True
            if victim.id in out:                        # 本步已调度过：回收预算
                budget += out.pop(victim.id)
                req_index -= 1                          # 真实代码：补偿列表位移
            if victim is req:
                preempted_self = True
                break                                   # 抢占到自己：本步放弃
        if preempted_self:
            break
        if blocks_free < 1:
            break
        out[req.id] = 1
        budget -= 1
        blocks_free -= 1
        req.num_computed_tokens += 1
        req_index += 1

    if preempted:
        return out                       # 本步有抢占：waiting 轮整体跳过
    for req in list(waiting):
        if budget <= 0 or len(running) >= max_seqs:
            break                        # token 或序列预算耗尽
        n = min(req.num_prompt_tokens, budget)
        if blocks_free < n:
            break                        # 块不足：直接拒绝，不触发抢占
        out[req.id] = n
        budget -= n
        blocks_free -= n
        req.num_computed_tokens = n
        running.append(req)
        waiting.remove(req)
    return out


# PRIORITY：低优先级但已投入最多的 low 被挤掉，high/mid 保住
low = Request("low", 100, priority=5, arrival=10, computed=50)
mid = Request("mid", 100, priority=3, arrival=15, computed=50)
high = Request("high", 100, priority=1, arrival=20, computed=50)
newbig = Request("new", prompt=200)
r = [low, mid, high]
waiting = [newbig]
assign = schedule_step(r, waiting, budget=300, max_seqs=4, blocks_free=1,
                       policy="priority")
assert low.num_preemptions == 1 and low.num_computed_tokens == 0
assert high.num_preemptions == 0 and mid.num_preemptions == 0
assert "low" not in assign and "high" in assign and "mid" in assign
assert "new" not in assign                      # 本步有抢占，waiting 轮被跳过
assert low in waiting                           # 被抢占者回到 waiting 队首

# FCFS：队尾（最近进 running 的 c）被挤掉
a = Request("a", 50, computed=50)
b = Request("b", 50, computed=50)
c = Request("c", 50, computed=50)
w = [Request("new2", prompt=200)]
assign2 = schedule_step([a, b, c], w, budget=300, max_seqs=4,
                        blocks_free=1, policy="fcfs")
assert c.num_preemptions == 1 and c.num_computed_tokens == 0
assert "a" in assign2 and "b" in assign2 and "c" not in assign2
assert "new2" not in assign2                    # waiting 轮被跳过
assert c in w                                   # c 回到 waiting 队首

# 无抢占时 waiting 轮正常接纳；序列上限独立生效
a2 = Request("a2", 50, computed=50)
b2 = Request("b2", 50, computed=50)
small = Request("small", prompt=10)
assign3 = schedule_step([a2, b2], [small], budget=300, max_seqs=2,
                        blocks_free=100, policy="fcfs")
assert "small" not in assign3                   # max_seqs=2 已满，座位预算拦住

big = Request("big", prompt=100)
assign4 = schedule_step([], [big], budget=200, max_seqs=4, blocks_free=100,
                        policy="fcfs")
assert assign4 == {"big": 100}                  # 预算充足时整个 prompt 一次给完

print("vllm-01-03 batching preemption: ALL PASS")

import io

import torch


base = torch.arange(8, dtype=torch.int64)
left, right = base[:4], base[4:]

assert left.untyped_storage().data_ptr() == right.untyped_storage().data_ptr()
assert left.data_ptr() != right.data_ptr()

# 序列化会保存共享 storage 关系，而非把两个 view 无条件拆成两份。
buffer = io.BytesIO()
torch.save({"left": left, "right": right}, buffer)
buffer.seek(0)
loaded = torch.load(buffer, weights_only=True)

assert loaded["left"].untyped_storage().data_ptr() == loaded["right"].untyped_storage().data_ptr()
loaded["left"][0] = 99
assert loaded["right"][0].item() == 4

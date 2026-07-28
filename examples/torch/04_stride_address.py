import torch


def storage_index(tensor: torch.Tensor, index: tuple[int, ...]) -> int:
    return tensor.storage_offset() + sum(i * s for i, s in zip(index, tensor.stride()))


base = torch.arange(24).reshape(2, 3, 4)
permuted = base.permute(0, 2, 1)

assert base.stride() == (12, 4, 1)
assert permuted.stride() == (12, 1, 4)
assert storage_index(permuted, (1, 2, 1)) == 18
assert permuted[1, 2, 1].item() == 18
assert not permuted.is_contiguous()

channels_last = torch.empty((2, 3, 4, 5)).contiguous(memory_format=torch.channels_last)
assert channels_last.is_contiguous(memory_format=torch.channels_last)
assert not channels_last.is_contiguous()

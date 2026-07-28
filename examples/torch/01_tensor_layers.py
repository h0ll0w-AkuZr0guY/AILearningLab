import torch


def describe(tensor: torch.Tensor) -> dict[str, object]:
    """把值解释层和字节所有权层分开观察。"""
    return {
        "shape": tuple(tensor.shape),
        "stride": tensor.stride(),
        "offset": tensor.storage_offset(),
        "dtype": tensor.dtype,
        "device": tensor.device.type,
        "storage_ptr": tensor.untyped_storage().data_ptr(),
        "data_ptr": tensor.data_ptr(),
    }


base = torch.arange(12, dtype=torch.float32).reshape(3, 4)
view = base[:, 1:3]
base_info, view_info = describe(base), describe(view)

assert base_info["storage_ptr"] == view_info["storage_ptr"]
assert base_info["data_ptr"] != view_info["data_ptr"]
assert view_info["offset"] == 1
view[0, 0] = -7
assert base[0, 1].item() == -7

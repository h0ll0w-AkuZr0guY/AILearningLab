import torch
from torch.utils._python_dispatch import TorchDispatchMode

plain = torch.ones(2)
grad_on = torch.ones(2, requires_grad=True)
assert str(torch._C._dispatch_key_set(plain)) == str(
    torch._C._dispatch_key_set(grad_on)
)
assert 'CPU' in str(torch._C._dispatch_key_set(plain))
assert 'SparseCPU' in str(torch._C._dispatch_key_set(torch.zeros(2).to_sparse()))
assert 'Meta' in str(torch._C._dispatch_key_set(torch.ones(2, device='meta')))

default_include = str(torch._C._dispatch_tls_local_include_set())
default_exclude = str(torch._C._dispatch_tls_local_exclude_set())
assert 'BackendSelect' in default_include and 'ADInplaceOrView' in default_include
assert 'AutocastCPU' in default_exclude and 'Autograd' not in default_exclude

with torch.no_grad():
    assert str(torch._C._dispatch_tls_local_exclude_set()) == default_exclude

with torch.inference_mode():
    inference_keys = str(torch._C._dispatch_key_set(torch.ones(2)))
    assert 'AutogradCPU' not in inference_keys
    assert 'ADInplaceOrView' not in inference_keys
    assert 'AutogradOther' in str(torch._C._dispatch_tls_local_exclude_set())
    assert str(torch._C._dispatch_tls_local_include_set()) != default_include

has = torch._C._dispatch_has_kernel_for_dispatch_key
assert has('aten::add.Tensor', 'CPU') is True
assert has('aten::add.Tensor', 'Autograd') is True
assert has('aten::add.Tensor', 'AutogradCPU') is False
assert has('aten::add_.Tensor', 'ADInplaceOrView') is True
assert has('aten::add.Tensor', 'ADInplaceOrView') is False
assert has('aten::add_.Tensor', 'BackendSelect') is False


class Trace(TorchDispatchMode):
    def __init__(self):
        self.ops = []

    def __torch_dispatch__(self, func, types, args=(), kwargs=None):
        self.ops.append(str(func))
        return func(*args, **(kwargs or {}))


forward = Trace()
with forward:
    (grad_on + 1).sum()
assert forward.ops == ['aten.add.Tensor', 'aten.sum.default']

both = Trace()
with both:
    (torch.ones(2, requires_grad=True) * 2).sum().backward()
assert 'aten.ones_like.default' in both.ops
assert 'aten.expand.default' in both.ops
assert both.ops.count('aten.mul.Tensor') == 2

with torch.inference_mode():
    leaked = torch.ones(2)
assert leaked.is_inference() is True

try:
    (leaked * grad_on).sum().backward()
except RuntimeError as error:
    assert 'Inference tensors cannot be saved for backward' in str(error)
else:
    raise AssertionError('inference tensors must not enter an autograd graph')

try:
    leaked.requires_grad_(True)
except RuntimeError as error:
    assert 'inference tensor outside InferenceMode' in str(error)
else:
    raise AssertionError('inference tensors must reject requires_grad_ outside the mode')

---
id: "transformer-01-01"
track: "transformer"
title: "标量向量矩阵"
depth: "foundation"
exampleLanguage: "python"
---

## 真实源码

repo: "pytorch/pytorch"
file: "教学版实现，对应 torch.matmul / aten::matmul"
symbol: "线性代数核心函数组"
language: "python"
url: "https://docs.pytorch.org/docs/stable/generated/torch.matmul.html"

### 逐段讲解

- scalar_mul 只做逐元素缩放，是后续线性组合的最小积木。
- vector_dot 把两个同长度向量压缩成标量，对应注意力里的单个相似度。
- transpose 把“取列”转成可复用的数据结构操作。
- matrix_multiply 只负责组织行与列，真正的数值核心继续复用 vector_dot。

### 源码节选

```python
def scalar_mul(scalar: float, vector: list[float]) -> list[float]:
    """标量乘向量：一个数依次缩放向量中的每个分量。"""
    return [scalar * value for value in vector]


def vector_dot(left: list[float], right: list[float]) -> float:
    """向量点积：对应位置相乘后求和，结果是一个标量。"""
    if len(left) != len(right):
        raise ValueError("点积要求两个向量长度相同")
    return sum(a * b for a, b in zip(left, right))


def transpose(matrix: list[list[float]]) -> list[list[float]]:
    """把矩阵的行变成列，方便复用 vector_dot。"""
    if not matrix or not matrix[0]:
        raise ValueError("矩阵不能为空")
    width = len(matrix[0])
    if any(len(row) != width for row in matrix):
        raise ValueError("矩阵必须是规则的二维数组")
    return [list(column) for column in zip(*matrix)]


def matrix_multiply(
    left: list[list[float]],
    right: list[list[float]],
) -> list[list[float]]:
    """矩阵乘法：左矩阵的每一行，与右矩阵的每一列做点积。"""
    right_columns = transpose(right)
    if len(left[0]) != len(right_columns[0]):
        raise ValueError("A 的列数必须等于 B 的行数")
    return [
        [vector_dot(row, column) for column in right_columns]
        for row in left
    ]
```

## 导读

标量、向量和矩阵首先是“数据有多少个方向”的记号。一个标量只有一个数，例如学习率 0.001；一个向量是一列有顺序的数，例如某个 token 的 768 个特征；一个矩阵是许多等长向量按行排在一起，例如 128 个 token 的隐藏状态可以写成形状 [128, 768] 的矩阵。

程序里的重点是 shape。0 维张量常被当作标量，1 维张量可表示向量，2 维张量可表示矩阵，更高维张量是在它们外面继续增加 batch、head、time 等轴。轴的名字来自业务语义，并不会被 PyTorch 自动理解，所以工程师需要在代码和断言中主动标注。

矩阵乘法不是逐元素相乘。若 A 的形状是 [m, k]，B 的形状是 [k, n]，A @ B 的结果才存在，形状为 [m, n]。中间维 k 被“消费”：结果中的每个数，都来自 A 的一行与 B 的一列做点积。

Transformer 几乎所有核心计算都能还原为这些积木。隐藏状态 X[B,T,D] 乘权重 W[D,H] 得到投影 XW[B,T,H]；Q 与 Kᵀ 相乘得到每对 token 的相似度；最后再用注意力权重乘 V。学会逐行推导 shape，后面的 attention 才不会变成背公式。

## 核心机制

- 标量缩放：s × v 对向量每个分量应用同一个比例，shape 不变。
- 向量点积：两个长度为 k 的向量对应位置相乘并求和，k 个数被压缩为一个标量。
- 矩阵乘法：把“每一行与每一列做点积”批量组织起来，要求左列数等于右行数。
- 高维张量：最后两个轴执行矩阵乘法，前面的轴通常作为 batch 维参与广播。

## 常见误区

- 把 * 当成矩阵乘法。对 Tensor 而言，* 通常表示逐元素相乘，@ 才表达矩阵乘法。
- 只看元素总数，不看每条轴的业务含义。[B,T,D] 与 [T,B,D] 元素数相同，却会让后续计算完全不同。
- 省略 shape 断言，让错误一直传播到 attention 或 loss 才暴露，定位成本会急剧增加。
- 误以为 vector 一定是列向量。程序中的一维 Tensor 没有行列方向，方向由参与的运算决定。

## 可运行示例

```python
import torch

# X: 两个 token，每个 token 有三个特征
X = torch.tensor([[1., 2., 3.],
                  [4., 5., 6.]])       # [T=2, D=3]

# W: 把 3 维特征投影到 4 维
W = torch.tensor([[1., 0., 0., 1.],
                  [0., 1., 0., 1.],
                  [0., 0., 1., 1.]])   # [D=3, H=4]

Y = X @ W                              # [T=2, H=4]

assert Y.shape == (2, 4)
assert torch.equal(Y[0], torch.tensor([1., 2., 3., 6.]))
print(Y)
```

## 搭积木复现

### 积木 1：先区分值、维度与形状

ndim 表示轴的数量，shape 描述每条轴的长度，numel 是所有轴长度的乘积。三个概念不能混用。

#### 代码

```python
import torch

scalar = torch.tensor(3.0)            # shape: []
vector = torch.tensor([1.0, 2.0])     # shape: [2]
matrix = torch.tensor([[1., 2.],
                       [3., 4.]])      # shape: [2, 2]

assert scalar.ndim == 0
assert vector.shape == (2,)
assert matrix.shape == (2, 2)
```

### 积木 2：自己实现点积

点积是矩阵乘法的数值核心。先用循环实现，再与 torch.dot 对照，可以把公式变成可调试的程序。

#### 代码

```python
def vector_dot(left, right):
    if len(left) != len(right):
        raise ValueError("长度必须相同")
    total = 0.0
    for a, b in zip(left, right):
        total += a * b
    return total

assert vector_dot([1, 2, 3], [4, 5, 6]) == 32
```

### 积木 3：用点积搭出矩阵乘法

矩阵乘法本身只做两件事：枚举左矩阵的行、枚举右矩阵的列。每一对行列继续交给 vector_dot。

#### 代码

```python
def matrix_multiply(left, right):
    right_columns = list(zip(*right))
    if len(left[0]) != len(right):
        raise ValueError("A 的列数必须等于 B 的行数")
    return [
        [vector_dot(row, column) for column in right_columns]
        for row in left
    ]

assert matrix_multiply([[1, 2]], [[3], [4]]) == [[11]]
```

### 积木 4：映射到 Transformer 投影

把 T 个 token 的 D 维表示看作 [T,D] 矩阵，用 [D,H] 权重做线性投影，结果自然成为 [T,H]。

#### 代码

```python
T, D, H = 4, 8, 16
x = torch.randn(T, D)     # 4 个 token，每个 8 维
weight = torch.randn(D, H)
projected = x @ weight

assert projected.shape == (T, H)
```

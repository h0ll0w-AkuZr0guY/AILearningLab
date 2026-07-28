param(
  [string]$Destination = "references"
)

$ErrorActionPreference = "Stop"
$repos = @(
  @{ Name = "cpython"; Url = "https://github.com/python/cpython.git"; Paths = @("Doc", "Objects", "Python", "Lib/asyncio") },
  @{ Name = "TypeScript"; Url = "https://github.com/microsoft/TypeScript.git"; Paths = @("src/compiler", "src/services") },
  @{ Name = "langchain"; Url = "https://github.com/langchain-ai/langchain.git"; Paths = @("libs/langchain", "libs/core") },
  @{ Name = "langgraph"; Url = "https://github.com/langchain-ai/langgraph.git"; Paths = @("libs/langgraph") },
  @{ Name = "deepagents"; Url = "https://github.com/langchain-ai/deepagents.git"; Paths = @("libs") },
  @{ Name = "nuxt"; Url = "https://github.com/nuxt/nuxt.git"; Paths = @("packages/nuxt", "packages/kit") },
  @{ Name = "vue-core"; Url = "https://github.com/vuejs/core.git"; Paths = @("packages/reactivity", "packages/runtime-core", "packages/compiler-core") },
  @{ Name = "pytorch"; Url = "https://github.com/pytorch/pytorch.git"; Paths = @("torch/csrc/autograd", "torch/nn", "torch/_dynamo", "aten/src/ATen") },
  @{ Name = "transformers"; Url = "https://github.com/huggingface/transformers.git"; Paths = @("src/transformers", "docs/source") },
  @{ Name = "vllm"; Url = "https://github.com/vllm-project/vllm.git"; Paths = @("vllm/core", "vllm/v1", "vllm/attention", "vllm/entrypoints/openai") },
  @{ Name = "peft"; Url = "https://github.com/huggingface/peft.git"; Paths = @("src/peft/tuners/lora", "src/peft/utils", "tests") }
)

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
foreach ($repo in $repos) {
  $target = Join-Path $Destination $repo.Name
  if (Test-Path $target) { Write-Host "Skip existing: $($repo.Name)"; continue }
  Write-Host "Fetching $($repo.Name) (sparse, shallow)..."
  git clone --depth 1 --filter=blob:none --sparse $repo.Url $target
  Push-Location $target
  git sparse-checkout set @($repo.Paths)
  Pop-Location
}
Write-Host "Reference atlas ready at $Destination"

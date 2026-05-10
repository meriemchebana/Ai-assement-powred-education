from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Phi-3-medium-4k-instruct",
    cache_dir=r"D:\hf_cache",
    device_map="auto",
    torch_dtype="auto",
    trust_remote_code=True
)
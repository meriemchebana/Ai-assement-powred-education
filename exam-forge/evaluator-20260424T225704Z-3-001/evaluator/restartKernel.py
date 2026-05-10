import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_name = "microsoft/Phi-3-medium-4k-instruct"

tokenizer = AutoTokenizer.from_pretrained(
    model_name,
    trust_remote_code=True
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    device_map="auto",
    torch_dtype=torch.float16,   # FP16 بدون تكميم
    trust_remote_code=True
)

model.eval()

print("Phi-3 loaded successfully 🚀")
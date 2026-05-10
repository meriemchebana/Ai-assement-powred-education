import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_name = "microsoft/Phi-3-medium-4k-instruct"

# tokenizer
tokenizer = AutoTokenizer.from_pretrained(
    model_name,
    trust_remote_code=True
)

# model
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    device_map="auto",
    torch_dtype=torch.float16,
    trust_remote_code=True,
    attn_implementation="eager"
)

model.eval()

# prompt
prompt = """You are a university professor in Compilers.

Generate exactly 3 exam questions.

Rules:
- Questions must be clear and academic
- Cover lexical analysis, parsing, syntax, semantics, optimization
- Do NOT include answers
- Only output the 3 questions
"""

# inputs
inputs = tokenizer(prompt, return_tensors="pt")
inputs = {k: v.to(model.device) for k, v in inputs.items()}

# generate
with torch.no_grad():
    output = model.generate(
        **inputs,
        max_new_tokens=300,  # #GenQ_MAXTOK
        do_sample=True,
        temperature=0.7,     # #GenQ_TEMP
        top_p=0.9            # #GenQ_TOP_P
    )

print(tokenizer.decode(output[0], skip_special_tokens=True))
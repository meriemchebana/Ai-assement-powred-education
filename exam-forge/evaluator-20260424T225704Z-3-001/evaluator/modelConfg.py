import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_name = "google/gemma-3-4b-it"

# tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_name)

# model
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    device_map="auto",
    torch_dtype=torch.float32,
)

model.eval()

prompt = "You are a helpful assistant.\nUser: Hello\nAssistant:"

# tokenization
inputs = tokenizer(prompt, return_tensors="pt")
inputs = {k: v.to(model.device) for k, v in inputs.items()}

# generation
with torch.no_grad():
    output = model.generate(
        **inputs,
        max_new_tokens=100,         # #ModelCfg_MAXTOK
        do_sample=True,
        temperature=0.3,            # #ModelCfg_TEMP
        top_p=0.9,                  # #ModelCfg_TOP_P
        repetition_penalty=1.1,     # #ModelCfg_REP_PEN
        pad_token_id=tokenizer.eos_token_id
    )

# decoding
response = tokenizer.decode(output[0], skip_special_tokens=True)

print(response)
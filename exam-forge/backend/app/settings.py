from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-v4-flash"  # #Gen_MODEL
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    data_dir: Path = Path(__file__).parent.parent / "data" / "final_unified"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # RAG settings
    rag_enabled: bool = True
    rag_index_dir: Path = Path(__file__).parent.parent / "rag_indices"
    rag_top_k: int = 4  # #RAG_TOP_K

    # AraBERT — HuggingFace Inference API for Arabic embeddings (encoder-only)
    arabert_api_key: str = ""
    arabert_model: str = "aubmindlab/bert-large-arabertv02"  # #Arabic_MODEL

    # Evaluator — uses gpt-oss-120b:free (same model as evaluator/evaluation.py)
    evaluator_enabled: bool = True
    evaluator_model: str = "openai/gpt-oss-120b:free"      # #Eval_MODEL
    evaluator_top_k: int = 5  # #Eval_TOP_K — RAG chunks for evaluation — more needed for answer extractability

    # Supabase cloud RAG
    supabase_url: str = ""
    supabase_key: str = ""
    general_embed_api_key: str = ""   # HF key for non-Arabic embeddings (can reuse arabert_api_key)
    general_embed_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

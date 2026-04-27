from sentence_transformers import SentenceTransformer
from config import settings
from db.vector import get_collection
import uuid
import re


def clean_text(text: str) -> str:
    if not text:
        return ""
    
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    text = ''.join(ch for ch in text if not (0xD800 <= ord(ch) <= 0xDFFF and ord(ch) not in [0xD835]))
    
    text = text.replace('\ufffd', '')
    
    return text.strip()


model = None


def get_embedding_model():
    global model
    if model is None:
        model = SentenceTransformer(settings.embedding_model)
    return model


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks


def add_source_embeddings(notebook_id: str, source_id: str, source_name: str, text: str):
    embed_model = get_embedding_model()
    collection = get_collection(notebook_id)
    chunks = chunk_text(text)
    
    if not chunks:
        return
    
    BATCH_SIZE = 50
    for i in range(0, len(chunks), BATCH_SIZE):
        batch_chunks = chunks[i:i + BATCH_SIZE]
        batch_ids = [f"{source_id}_{i + j}" for j in range(len(batch_chunks))]
        batch_metas = [
            {"source_id": source_id, "source_name": source_name, "chunk_index": i + j}
            for j in range(len(batch_chunks))
        ]
        
        try:
            batch_embeddings = embed_model.encode(batch_chunks).tolist()
            collection.add(
                documents=batch_chunks,
                metadatas=batch_metas,
                ids=batch_ids,
                embeddings=batch_embeddings
            )
        except Exception as e:
            for j, chunk in enumerate(batch_chunks):
                try:
                    single_embedding = embed_model.encode([chunk]).tolist()
                    collection.add(
                        documents=[chunk],
                        metadatas=[batch_metas[j]],
                        ids=[batch_ids[j]],
                        embeddings=single_embedding
                    )
                except:
                    pass


def search_similar(notebook_id: str, query: str, top_k: int = 5) -> list[dict]:
    embed_model = get_embedding_model()
    collection = get_collection(notebook_id)
    
    query_embedding = embed_model.encode([query]).tolist()
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )
    
    formatted_results = []
    if results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            formatted_results.append({
                "content": doc,
                "metadata": results["metadatas"][0][i] if results["metadatas"] else None,
                "distance": results["distances"][0][i] if results["distances"] else None
            })
    
    return formatted_results


def delete_source_embeddings(notebook_id: str, source_id: str):
    collection = get_collection(notebook_id)
    try:
        all_items = collection.get()
        ids_list = all_items.get("ids", [])
        metas_list = all_items.get("metadatas", [])
        
        ids_to_delete = []
        for i, item_id in enumerate(ids_list):
            if metas_list and metas_list[i] and metas_list[i].get("source_id") == source_id:
                ids_to_delete.append(item_id)
        
        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
    except Exception:
        pass
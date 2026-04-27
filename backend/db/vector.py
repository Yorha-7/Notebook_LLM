import chromadb
from chromadb.config import Settings as ChromaSettings
from config import settings


client = chromadb.PersistentClient(path=str(settings.chroma_dir))


def get_collection(notebook_id: str):
    return client.get_or_create_collection(name=f"notebook_{notebook_id}")


def delete_collection(notebook_id: str):
    try:
        client.delete_collection(name=f"notebook_{notebook_id}")
        return True
    except:
        return False
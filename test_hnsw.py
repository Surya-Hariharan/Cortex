import numpy as np
from app.rag.vector_store import VectorStore
import os

def test_hnsw():
    print("Testing HNSW Vector Store...")
    # Use a temp directory
    tmp_dir = "tmp_vs"
    vs = VectorStore(store_dir=tmp_dir)
    
    # 1. Add vectors
    dim = 768
    num_vecs = 10
    vecs = np.random.rand(num_vecs, dim).astype('float32')
    # Normalise for IP (cosine)
    vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
    
    cids = [f"chunk_{i}" for i in range(num_vecs)]
    vs.add(vecs, cids)
    print(f"Added {num_vecs} vectors. Total: {vs.total}")
    
    # 2. Search
    query = vecs[0]
    results = vs.search(query, top_k=3)
    print("Search results (top 1 should be chunk_0):")
    for cid, score in results:
        print(f" - {cid}: {score:.4f}")
        
    assert results[0][0] == "chunk_0"
    
    # 3. Save and Load
    vs.save()
    print("Saved index.")
    
    vs2 = VectorStore(store_dir=tmp_dir)
    vs2.load()
    print(f"Loaded index. Total: {vs2.total}")
    assert vs2.total == num_vecs
    
    # Cleanup
    import shutil
    shutil.rmtree(tmp_dir)
    print("Test passed!")

if __name__ == "__main__":
    try:
        test_hnsw()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

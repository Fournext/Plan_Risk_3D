import hashlib

from .onchain import get_asset


def sha256_file(file_path):
    """
    Calcular hash SHA256 de un archivo local.

    Args:
        file_path: Ruta al archivo

    Returns:
        Hash SHA256 con prefijo '0x'
    """
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return "0x" + h.hexdigest()

def validate_plan(job_id, path_json=None, path_glb=None, path_img=None):
    """
    Valida los hashes de los archivos locales comparándolos con los de blockchain.
    """
    data = get_asset(job_id)
    if not data:
        return {
            "status": "error",
            "detail": "No se encontró registro en blockchain."
        }

    results = {}

    if path_img:
        local_hash = sha256_file(path_img)
        on_chain_hash = data['shaImage'].lower().replace("0x", "")
        local_hash_clean = local_hash.lower().replace("0x", "")
        results['image'] = {
            "on_chain": data['shaImage'],
            "local": local_hash,
            "valid": local_hash_clean == on_chain_hash
        }

    if path_json:
        local_hash = sha256_file(path_json)
        on_chain_hash = data['shaJson'].lower().replace("0x", "")
        local_hash_clean = local_hash.lower().replace("0x", "")
        results['json'] = {
            "on_chain": data['shaJson'],
            "local": local_hash,
            "valid": local_hash_clean == on_chain_hash
        }

    if path_glb:
        local_hash = sha256_file(path_glb)
        on_chain_hash = data['shaGlb'].lower().replace("0x", "")
        local_hash_clean = local_hash.lower().replace("0x", "")
        results['glb'] = {
            "on_chain": data['shaGlb'],
            "local": local_hash,
            "valid": local_hash_clean == on_chain_hash
        }

    # Resultado global
    all_valid = all(v["valid"] for v in results.values())
    return {
        "job_id": job_id,
        "status": "✅ Válido" if all_valid else "❌ Alterado",
        "details": results
    }

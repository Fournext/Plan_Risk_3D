# plans/onchain.py
import os

from dotenv import load_dotenv
from web3 import Web3

# Cargar variables del archivo .env
load_dotenv()


# Configuración general
RPC_URL = "https://rpc-amoy.polygon.technology"
CONTRACT_ADDR = os.getenv("CONTRACT_ADDR")  # Dirección del contrato desplegado
PRIVATE_KEY = os.getenv("PRIVATE_KEY")      # Clave privada de tu wallet
CHAIN_ID = 80002  # Polygon Amoy testnet

# === CONEXIÓN WEB3 ===
w3 = Web3(Web3.HTTPProvider(RPC_URL))
if not w3.is_connected():
    raise RuntimeError("❌ No se pudo conectar a Polygon Amoy RPC")

# === CARGAR CUENTA ===
acct = w3.eth.account.from_key(PRIVATE_KEY)

# === ABI DEL CONTRATO ===
ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "jobId", "type": "uint256"},
            {"internalType": "string", "name": "cidImage", "type": "string"},
            {"internalType": "string", "name": "cidJson", "type": "string"},
            {"internalType": "string", "name": "cidGlb", "type": "string"},
            {"internalType": "bytes32", "name": "shaImage", "type": "bytes32"},
            {"internalType": "bytes32", "name": "shaJson", "type": "bytes32"},
            {"internalType": "bytes32", "name": "shaGlb", "type": "bytes32"},
            {"internalType": "string", "name": "metaCid", "type": "string"}
        ],
        "name": "register",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "jobId", "type": "uint256"}
        ],
        "name": "getAsset",
        "outputs": [
            {
                "components": [
                    {"internalType": "string", "name": "cidImage", "type": "string"},
                    {"internalType": "string", "name": "cidJson", "type": "string"},
                    {"internalType": "string", "name": "cidGlb", "type": "string"},
                    {"internalType": "bytes32", "name": "shaImage", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "shaJson", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "shaGlb", "type": "bytes32"},
                    {"internalType": "string", "name": "metaCid", "type": "string"},
                    {"internalType": "uint64", "name": "timestamp", "type": "uint64"},
                    {"internalType": "address", "name": "owner",
                     "type": "address"},
                ],
                "internalType": "struct Plan3DRegistry.Asset",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


# Crear objeto del contrato
contract = w3.eth.contract(
    address=w3.to_checksum_address(CONTRACT_ADDR),
    abi=ABI
)


def register_on_chain(job_id, cid_img, cid_json, cid_glb,
                      sha_img, sha_json, sha_glb, cid_meta):
    """
    Registrar modelo en la blockchain Polygon Amoy.

    Args:
        job_id: ID del trabajo
        cid_img, cid_json, cid_glb: CIDs de IPFS
        sha_img, sha_json, sha_glb: Hashes SHA256
        cid_meta: CID de metadatos

    Returns:
        Hash de transacción o None en caso de error
    """
    try:
        print("🔗 Iniciando registro en blockchain...")

        nonce = w3.eth.get_transaction_count(acct.address)

        # Convertir hashes a bytes
        sha_img_bytes = (
            bytes.fromhex(sha_img[2:]) if sha_img.startswith("0x")
            else bytes.fromhex(sha_img)
        )
        sha_json_bytes = (
            bytes.fromhex(sha_json[2:]) if sha_json.startswith("0x")
            else bytes.fromhex(sha_json)
        )
        sha_glb_bytes = (
            bytes.fromhex(sha_glb[2:]) if sha_glb.startswith("0x")
            else bytes.fromhex(sha_glb)
        )

        tx = contract.functions.register(
            int(job_id),
            cid_img,
            cid_json,
            cid_glb,
            sha_img_bytes,
            sha_json_bytes,
            sha_glb_bytes,
            cid_meta
        ).build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "gas": 350000,
            "maxFeePerGas": w3.to_wei("80", "gwei"),
            "maxPriorityFeePerGas": w3.to_wei("30", "gwei"),
            "chainId": CHAIN_ID
        })

        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        print(f"✅ Transacción enviada: {tx_hash.hex()}")
        url = f"https://amoy.polygonscan.com/tx/{tx_hash.hex()}"
        print(f"🔍 Ver en {url}")
        return tx_hash.hex()

    except Exception as e:
        print(f"❌ Error registrando en blockchain: {e}")
        return None


def get_asset(job_id: int):
    """
    Leer registro desde la blockchain por job_id.

    Args:
        job_id: ID del trabajo a consultar

    Returns:
        Diccionario con datos del asset o None en caso de error
    """
    try:
        data = contract.functions.getAsset(int(job_id)).call()
        return {
            "cidImage": data[0],
            "cidJson": data[1],
            "cidGlb": data[2],
            "shaImage": data[3].hex(),
            "shaJson": data[4].hex(),
            "shaGlb": data[5].hex(),
            "metaCid": data[6],
            "timestamp": data[7],
            "owner": data[8]
        }
    except Exception as e:
        print(f"❌ Error leyendo asset: {e}")
        return None

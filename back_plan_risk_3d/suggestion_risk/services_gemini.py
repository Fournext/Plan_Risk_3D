import base64
import json
import os
import tempfile

import requests
from django.conf import settings
from pygltflib import GLTF2


GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)


def limpiar_respuesta_gemini(texto):
    """
    Limpiar respuesta de Gemini removiendo markdown.

    Remueve bloques de código markdown y espacios extra.

    Args:
        texto: Respuesta cruda de Gemini (string con JSON)

    Returns:
        dict: JSON parseado como objeto Python
    """
    import re

    # Remover bloques de código markdown
    texto = re.sub(r'```json\s*', '', texto)
    texto = re.sub(r'```\s*', '', texto)

    # Remover espacios al inicio y final
    texto = texto.strip()

    # Validar que sea JSON válido y parsearlo
    try:
        return json.loads(texto)
    except json.JSONDecodeError as e:
        # Intentar encontrar el JSON dentro del texto
        inicio = texto.find('{')
        fin = texto.rfind('}')

        if inicio != -1 and fin != -1 and fin > inicio:
            json_extraido = texto[inicio:fin+1]
            try:
                return json.loads(json_extraido)
            except Exception:
                pass

        # Si todo falla, devolver error estructurado
        return {
            "error": "No se pudo parsear la respuesta de Gemini",
            "respuesta_original": texto
        }


def extraer_info_glb(archivo_glb):
    """
    Extraer información estructural de un archivo .glb.

    Extrae:
    - Materiales de los muros
    - Posiciones de los elementos
    - Texturas embebidas (imágenes en base64)

    Args:
        archivo_glb: Archivo .glb (Django UploadedFile)

    Returns:
        dict: Información extraída del modelo incluyendo texturas
    """
    try:
        # Guardar temporalmente el archivo
        with tempfile.NamedTemporaryFile(delete=False, suffix='.glb') as tmp_file:
            archivo_glb.seek(0)
            tmp_file.write(archivo_glb.read())
            tmp_path = tmp_file.name
        
        # Cargar el archivo GLB
        gltf = GLTF2().load(tmp_path)

        # Extraer información relevante
        info = {
            'elementos_estructurales': [],
            'texturas': []
        }

        # Mapear materiales por índice y extraer texturas
        materiales_map = {}
        texturas_extraidas = {}  # índice_textura -> base64

        # EXTRAER IMÁGENES EMBEBIDAS (convertir a base64)
        if gltf.images:
            for idx, image in enumerate(gltf.images):
                try:
                    image_data = None
                    mime_type = 'image/png'
                    
                    # Imagen embebida en bufferView
                    if (hasattr(image, 'bufferView') and
                            image.bufferView is not None):
                        buffer_view = gltf.bufferViews[image.bufferView]
                        buffer_idx = buffer_view.buffer
                        byte_offset = (
                            buffer_view.byteOffset
                            if buffer_view.byteOffset
                            else 0
                        )
                        byte_length = buffer_view.byteLength

                        # Obtener datos del buffer
                        buffer_uri = gltf.buffers[buffer_idx].uri
                        buffer_data = gltf.get_data_from_buffer_uri(buffer_uri)
                        image_data = buffer_data[
                            byte_offset:byte_offset + byte_length
                        ]

                        if hasattr(image, 'mimeType') and image.mimeType:
                            mime_type = image.mimeType

                        # Convertir a base64
                        image_base64 = base64.b64encode(
                            image_data
                        ).decode('utf-8')

                        texturas_extraidas[idx] = {
                            'base64': image_base64,
                            'mime_type': mime_type,
                            'size_bytes': len(image_data)
                        }

                    # Imagen con URI externa
                    elif (hasattr(image, 'uri') and image.uri and
                          image.uri.startswith('http')):
                        texturas_extraidas[idx] = {
                            'url': image.uri,
                            'mime_type': 'image/png'
                        }

                except Exception as e:
                    print(f"⚠️ Error extrayendo imagen {idx}: {e}")

        # MAPEAR MATERIALES Y SUS TEXTURAS
        if gltf.materials:
            for idx, material in enumerate(gltf.materials):
                nombre_material = (
                    material.name if material.name
                    else f'Material_{idx}'
                )

                # Información básica del material
                mat_info = {
                    'nombre': nombre_material,
                    'tipo_material': 'desconocido',
                    'textura_idx': None,  # Índice de textura que usa
                    'metalico': 0,
                    'rugosidad': 0.5
                }
                
                # Extraer textura si existe
                if material.pbrMetallicRoughness:
                    pbr = material.pbrMetallicRoughness
                    mat_info['metalico'] = (
                        pbr.metallicFactor
                        if hasattr(pbr, 'metallicFactor')
                        else 0
                    )
                    mat_info['rugosidad'] = (
                        pbr.roughnessFactor
                        if hasattr(pbr, 'roughnessFactor')
                        else 0.5
                    )

                    # Obtener textura base
                    if (hasattr(pbr, 'baseColorTexture') and
                            pbr.baseColorTexture is not None):
                        texture_info = pbr.baseColorTexture
                        if (hasattr(texture_info, 'index') and
                                texture_info.index is not None):
                            tex_idx = texture_info.index
                            # Obtener la imagen asociada
                            if (gltf.textures and
                                    tex_idx < len(gltf.textures)):
                                texture = gltf.textures[tex_idx]
                                if (hasattr(texture, 'source') and
                                        texture.source is not None):
                                    img_idx = texture.source
                                    mat_info['textura_idx'] = img_idx

                    # Inferir tipo de material desde propiedades
                    metalico = mat_info['metalico']
                    rugosidad = mat_info['rugosidad']

                    if metalico > 0.7:
                        mat_info['tipo_material'] = 'metal/acero'
                    elif rugosidad > 0.7:
                        mat_info['tipo_material'] = 'concreto/hormigon'
                    elif rugosidad < 0.3:
                        mat_info['tipo_material'] = 'vidrio/ceramica'
                    else:
                        mat_info['tipo_material'] = 'madera/composite'

                materiales_map[idx] = mat_info

        # AGREGAR TEXTURAS AL RESULTADO
        for img_idx, tex_data in texturas_extraidas.items():
            info['texturas'].append({
                'indice': img_idx,
                'mime_type': tex_data.get('mime_type'),
                'base64': tex_data.get('base64'),
                'url': tex_data.get('url'),  # Si existe
                'size_bytes': tex_data.get('size_bytes')
            })

        # Extraer información de nodos y sus posiciones
        if gltf.nodes and gltf.meshes:
            for node_idx, node in enumerate(gltf.nodes):
                # Obtener posición del nodo (traducción)
                posicion = None
                if node.translation:
                    posicion = {
                        'x': round(node.translation[0], 2),
                        'y': round(node.translation[1], 2),
                        'z': round(node.translation[2], 2)
                    }
                
                # Si el nodo tiene una malla asociada
                if hasattr(node, 'mesh') and node.mesh is not None:
                    mesh = gltf.meshes[node.mesh]
                    nombre_elemento = (
                        node.name if node.name
                        else mesh.name if mesh.name
                        else f'Elemento_{node_idx}'
                    )

                    # Obtener material de la primera primitiva
                    material_nombre = 'sin_material'
                    tipo_material = 'sin_especificar'
                    textura_idx = None
                    
                    if mesh.primitives and len(mesh.primitives) > 0:
                        prim = mesh.primitives[0]
                        if (hasattr(prim, 'material') and
                                prim.material is not None):
                            material_info = materiales_map.get(
                                prim.material, {}
                            )
                            material_nombre = material_info.get(
                                'nombre', 'sin_material'
                            )
                            tipo_material = material_info.get(
                                'tipo_material', 'desconocido'
                            )
                            textura_idx = material_info.get('textura_idx')

                    # Agregar elemento estructural
                    elemento = {
                        'nombre': nombre_elemento,
                        'material': material_nombre,
                        'tipo_material': tipo_material,
                        'textura_idx': textura_idx,
                        'posicion': (
                            posicion if posicion
                            else {'x': 0, 'y': 0, 'z': 0}
                        )
                    }

                    info['elementos_estructurales'].append(elemento)

        # Limpiar archivo temporal
        os.unlink(tmp_path)

        return info

    except Exception as e:
        # Limpiar archivo temporal en caso de error
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise Exception(
            f'Error al extraer información del GLB: {str(e)}'
        )


def call_gemini_with_images(parts):
    """
    Llamar a la API de Gemini con texto e imágenes (multimodal).

    Args:
        parts: Lista de partes (texto o imágenes inline_data)
               Ejemplo: [{"text": "..."}, {"inline_data": {...}}]

    Returns:
        dict: Respuesta de la API con success y data/error
    """
    GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", None)
    
    if not GEMINI_API_KEY:
        return {
            'success': False,
            'error': 'No se ha configurado la API key de Gemini. Por favor configure GEMINI_API_KEY en settings.'
        }
    
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.4,
            "topK": 32,
            "topP": 1,
            "maxOutputTokens": 4096
        }
    }
    
    try:
        response = requests.post(
            GEMINI_API_URL,
            headers=headers,
            params=params,
            json=payload,
            timeout=120
        )

        if response.status_code == 200:
            result = response.json()

            # Extraer el texto de la respuesta
            if 'candidates' in result and len(result['candidates']) > 0:
                texto = result['candidates'][0]['content']['parts'][0]['text']
                return {
                    'success': True,
                    'data': texto
                }
            else:
                return {
                    'success': False,
                    'error': 'No se pudo obtener respuesta del modelo'
                }
        else:
            error_msg = (
                f'Error de la API de Gemini: {response.status_code} - '
                f'{response.text}'
            )
            return {
                'success': False,
                'error': error_msg
            }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error al llamar a Gemini: {str(e)}'
        }


def call_gemini(prompt):
    """
    Llamar a la API de Gemini con un prompt de texto.

    Args:
        prompt: Texto del prompt para Gemini

    Returns:
        dict: Respuesta de la API con success y data/error
    """
    GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", None)
    
    if not GEMINI_API_KEY:
        return {
            'success': False,
            'error': 'No se ha configurado la API key de Gemini. Por favor configure GEMINI_API_KEY en settings.'
        }
    
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    try:
        response = requests.post(
            GEMINI_API_URL,
            headers=headers,
            params=params,
            json=payload,
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()

            # Extraer el texto de la respuesta
            if 'candidates' in result and len(result['candidates']) > 0:
                texto = result['candidates'][0]['content']['parts'][0]['text']
                return {
                    'success': True,
                    'data': texto
                }
            else:
                return {
                    'success': False,
                    'error': 'No se pudo obtener respuesta del modelo'
                }
        else:
            error_msg = (
                f'Error de la API de Gemini: {response.status_code} - '
                f'{response.text}'
            )
            return {
                'success': False,
                'error': error_msg
            }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error al llamar a Gemini: {str(e)}'
        }


def analizar_modelo_glb(archivo_glb):
    """
    Analizar archivo .glb usando Gemini API REST.

    Retorna sugerencias sobre daños estructurales y mejores materiales.
    Envía las texturas embebidas como imágenes.

    Args:
        archivo_glb: Archivo .glb subido (Django UploadedFile)

    Returns:
        dict: Respuesta con análisis y sugerencias
    """
    try:
        # Extraer información del GLB (incluyendo texturas en base64)
        info_glb = extraer_info_glb(archivo_glb)

        # Preparar información sin las imágenes base64
        info_para_prompt = {
            'elementos_estructurales': info_glb['elementos_estructurales'],
            'texturas_info': [
                {
                    'indice': t['indice'],
                    'mime_type': t['mime_type'],
                    'size_kb': (
                        round(t.get('size_bytes', 0) / 1024, 2)
                        if t.get('size_bytes')
                        else None
                    )
                }
                for t in info_glb['texturas']
            ]
        }
        
        # Convertir la información a JSON formateado
        info_json = json.dumps(
            info_para_prompt,
            indent=2,
            ensure_ascii=False
        )

        # Agrupar elementos por tipo
        elementos_por_tipo = {
            'muros': [],
            'puertas': [],
            'ventanas': []
        }
        
        for elem in info_glb['elementos_estructurales']:
            nombre = elem['nombre'].lower()
            if 'wall' in nombre or 'muro' in nombre:
                elementos_por_tipo['muros'].append(elem)
            elif 'door' in nombre or 'puerta' in nombre:
                elementos_por_tipo['puertas'].append(elem)
            elif 'window' in nombre or 'ventana' in nombre:
                elementos_por_tipo['ventanas'].append(elem)
        
        # Crear resumen agrupado
        muros_texturas = list(set([
            e['textura_idx'] for e in elementos_por_tipo['muros']
            if e['textura_idx'] is not None
        ]))
        puertas_texturas = list(set([
            e['textura_idx'] for e in elementos_por_tipo['puertas']
            if e['textura_idx'] is not None
        ]))
        ventanas_texturas = list(set([
            e['textura_idx'] for e in elementos_por_tipo['ventanas']
            if e['textura_idx'] is not None
        ]))

        resumen_elementos = {
            'muros': {
                'cantidad': len(elementos_por_tipo['muros']),
                'texturas_usadas': muros_texturas,
                'elementos': elementos_por_tipo['muros'][:3]
            },
            'puertas': {
                'cantidad': len(elementos_por_tipo['puertas']),
                'texturas_usadas': puertas_texturas,
                'elementos': elementos_por_tipo['puertas'][:3]
            },
            'ventanas': {
                'cantidad': len(elementos_por_tipo['ventanas']),
                'texturas_usadas': ventanas_texturas,
                'elementos': elementos_por_tipo['ventanas'][:3]
            }
        }
        
        # Convertir la información a JSON formateado
        info_json = json.dumps(resumen_elementos, indent=2, ensure_ascii=False)
        
        # Crear el prompt de texto
        texto_prompt = """
Eres un ingeniero estructural experto. Analiza un modelo 3D de construcción con sus materiales aplicados.

RESUMEN DEL MODELO:
{}

**IMPORTANTE**: Junto con este texto recibirás {} IMÁGENES de texturas en el siguiente orden:
{}

RELACIÓN ELEMENTO → TEXTURA:
- MUROS (wall_internal): {} elementos usando textura índice {}
- PUERTAS (door): {} elementos usando textura índice {}
- VENTANAS (window): {} elementos usando textura índice {}

INSTRUCCIONES:
1. Analiza visualmente cada textura enviada
2. Identifica el material real (ladrillo, cemento, madera, vidrio, etc.)
3. Evalúa si ese material es APROPIADO para el tipo de elemento donde está aplicado
4. Clasifica los hallazgos en 3 categorías simples

Responde ÚNICAMENTE en formato JSON válido (sin markdown, sin bloques de código):

{{
  "elementos_bien_hechos": [
    {{
      "tipo": "muros/puertas/ventanas",
      "cantidad": 0,
      "material_usado": "nombre del material identificado en la imagen",
      "por_que_esta_bien": "explicación breve de por qué es apropiado"
    }}
  ],
  "elementos_mal_hechos": [
    {{
      "tipo": "muros/puertas/ventanas",
      "cantidad": 0,
      "material_usado": "nombre del material identificado en la imagen",
      "problema": "explicación del problema estructural o funcional",
      "nivel_riesgo": "bajo/medio/alto/crítico"
    }}
  ],
  "recomendaciones": [
    {{
      "para_elemento": "muros/puertas/ventanas",
      "cantidad_afectada": 0,
      "cambiar_de": "material actual visto",
      "cambiar_a": "material recomendado",
      "razon": "justificación técnica del cambio",
      "urgencia": "alta/media/baja"
    }}
  ],
  "resumen_general": {{
    "nivel_riesgo_global": "bajo/medio/alto/crítico",
    "elementos_correctos": 0,
    "elementos_incorrectos": 0,
    "comentario": "resumen ejecutivo breve"
  }}
}}

CRITERIOS DE EVALUACIÓN:
- MUROS: Deben ser materiales estructurales (hormigón, ladrillo, bloque). NO madera decorativa o vidrio.
- PUERTAS: Madera maciza, acero, compuestos resistentes. NO materiales estructurales pesados ni vidrio frágil.
- VENTANAS: Vidrio templado/laminado transparente. NO materiales opacos ni estructurales.
""".format(
            info_json,
            len(info_glb['texturas']),
            ', '.join([f"Imagen {i+1} (textura índice {t['indice']})" for i, t in enumerate(info_glb['texturas'])]),
            resumen_elementos['muros']['cantidad'],
            resumen_elementos['muros']['texturas_usadas'][0] if resumen_elementos['muros']['texturas_usadas'] else 'N/A',
            resumen_elementos['puertas']['cantidad'],
            resumen_elementos['puertas']['texturas_usadas'][0] if resumen_elementos['puertas']['texturas_usadas'] else 'N/A',
            resumen_elementos['ventanas']['cantidad'],
            resumen_elementos['ventanas']['texturas_usadas'][0] if resumen_elementos['ventanas']['texturas_usadas'] else 'N/A'
        )
        
        # Preparar el payload multimodal con imágenes
        parts = [{"text": texto_prompt}]

        # Agregar imágenes al payload
        for textura in info_glb['texturas']:
            if textura.get('base64'):
                parts.append({
                    "inline_data": {
                        "mime_type": textura['mime_type'],
                        "data": textura['base64']
                    }
                })
        
        # Llamar a Gemini con imágenes
        resultado = call_gemini_with_images(parts)

        if resultado.get('success'):
            # Limpiar respuesta de Gemini
            analisis_limpio = limpiar_respuesta_gemini(resultado['data'])

            return {
                'success': True,
                'analisis': analisis_limpio,
                'nombre_archivo': archivo_glb.name,
                'texturas_enviadas': len(info_glb['texturas'])
            }
        else:
            return resultado

    except Exception as e:
        return {
            'success': False,
            'error': f'Error al analizar el modelo: {str(e)}'
        }

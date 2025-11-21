import json
import math
from decimal import Decimal

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Material, CategoriaMaterial


@api_view(['POST'])
def calcular_presupuesto(request):
    """
    Calcular presupuesto total basado en objetos 3D.

    Usa las tablas de Material y CategoriaMaterial:
    - Paredes (wall) -> volumen (m3)
    - Puertas/Ventanas (door/window) -> área (m2)

    Returns:
        Response con total estimado, detalle y materiales no encontrados
    """
    try:
        data = request.data
        objetos = data.get("objects", [])

        total = 0
        detalle = []
        materiales_no_encontrados = []

        for obj in objetos:
            tipo = obj.get("type")
            material_info = obj.get("material", {})
            nombre_material = material_info.get("name", "").capitalize()

            # Buscar categoría (wall, door, window)
            try:
                categoria = CategoriaMaterial.objects.get(
                    nombre__iexact=tipo
                )
            except CategoriaMaterial.DoesNotExist:
                materiales_no_encontrados.append(
                    f"{nombre_material} ({tipo})"
                )
                continue

            # Buscar material dentro de la categoría
            try:
                material = Material.objects.get(
                    nombre__iexact=nombre_material,
                    categoria=categoria
                )
            except Material.DoesNotExist:
                materiales_no_encontrados.append(nombre_material)
                continue

            # Cálculo según tipo
            width = float(obj.get("width", 0))
            height = float(obj.get("height", 0))
            depth = float(obj.get("depth", 0))

            if tipo == "wall":
                cantidad = width * height * depth
            else:
                cantidad = width * height

            precio = float(material.precio_unitario)
            subtotal = round(cantidad * precio, 4)
            total += subtotal

            detalle.append({
                "material": material.nombre,
                "categoria": categoria.nombre,
                "cantidad": cantidad,
                "unidad": material.unidad,
                "precio_unitario": float(material.precio_unitario),
                "subtotal": subtotal
            })

        return Response({
            "total_estimado": round(total, 4),
            "detalle": detalle,
            "materiales_no_encontrados": materiales_no_encontrados
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def cargar_materiales(request):
    """
    Carga o actualiza categorías y materiales.
    Si el material o categoría ya existe, se actualiza el precio.
    """
    data = request.data
    categorias_data = data.get("categorias", [])
    materiales_data = data.get("materiales", [])

    categorias_creadas = []
    materiales_creados = []
    categorias_actualizadas = []
    materiales_actualizados = []

    # Cargar o actualizar categorías
    for cat in categorias_data:
        nombre = cat.get("nombre")
        descripcion = cat.get("descripcion", "")
        categoria, creada = CategoriaMaterial.objects.update_or_create(
            nombre__iexact=nombre,
            defaults={
                "nombre": nombre,
                "descripcion": descripcion
            }
        )
        if creada:
            categorias_creadas.append(nombre)
        else:
            categorias_actualizadas.append(nombre)

    # Cargar o actualizar materiales
    for mat in materiales_data:
        cat_nombre = mat.get("categoria")
        try:
            categoria = CategoriaMaterial.objects.get(
                nombre__iexact=cat_nombre
            )
        except CategoriaMaterial.DoesNotExist:
            continue

        material, creado = Material.objects.update_or_create(
            nombre__iexact=mat.get("nombre"),
            categoria=categoria,
            defaults={
                "nombre": mat.get("nombre"),
                "unidad": mat.get("unidad"),
                "precio_unitario": mat.get("precio_unitario")
            }
        )
        if creado:
            materiales_creados.append(mat.get("nombre"))
        else:
            materiales_actualizados.append(mat.get("nombre"))

    return Response({
        "categorias_creadas": categorias_creadas,
        "categorias_actualizadas": categorias_actualizadas,
        "materiales_creados": materiales_creados,
        "materiales_actualizados": materiales_actualizados
    })

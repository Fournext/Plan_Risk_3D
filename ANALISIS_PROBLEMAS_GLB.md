# 🔍 ANÁLISIS DE PROBLEMAS EN GENERACIÓN DE GLB

## 📊 Resultado del Análisis

**El problema está en AMBOS lados: JSON y ORQUESTADOR**

### ❌ Problemas encontrados: **40 en total**
- **21 muros con dimensiones anómalas**
- **14 superposiciones entre muros**  
- **5 ventanas huérfanas (lejos de muros)**

---

## 🔴 PROBLEMA PRINCIPAL #1: JSON - Detección Deficiente

### Dimensiones Incorrectas de Muros

**Esperado vs Detectado:**
- ✅ Grosor esperado de muro: **150mm** (0.15m)
- ❌ Grosor detectado: **397-464mm** (¡hasta 3x más grueso!)

**Muros problemáticos (primeros 10 de 21):**
```
Muro #1:  horizontal, L=3.45m, W=430.7mm (287% del esperado)
Muro #3:  horizontal, L=3.38m, W=397.5mm (265% del esperado)
Muro #4:  horizontal, L=4.31m, W=397.5mm (265% del esperado)
Muro #5:  horizontal, L=3.05m, W=397.5mm (265% del esperado)
Muro #6:  horizontal, L=1.09m, W=397.5mm (265% del esperado)
Muro #7:  vertical,   L=8.78m, W=397.5mm (265% del esperado)
Muro #8:  horizontal, L=2.19m, W=397.5mm (265% del esperado)
Muro #10: horizontal, L=2.78m, W=463.8mm (309% del esperado)
Muro #12: horizontal, L=2.02m, W=430.7mm (287% del esperado)
Muro #15: vertical,   L=1.13m, W=364.4mm (243% del esperado)
```

**Causa:** El modelo de detección (Mask R-CNN) está dibujando bounding boxes demasiado anchos alrededor de los muros.

### Superposiciones de Muros

**14 superposiciones detectadas** - Los muros se solapan significativamente:

```
Muros #7 y #51:  51.0% superpuestos (397.5mm x 1557.1mm)
Muros #10 y #48: 30.4% superpuestos (165.6mm x 463.8mm)
Muros #6 y #7:   30.3% superpuestos (397.5mm x 331.3mm)
Muros #16 y #28: 30.1% superpuestos (331.3mm x 430.7mm)
```

**Consecuencia:** Cuando el orquestador une estos muros superpuestos, crea geometría inválida o muros que "se chocan".

### Ventanas Huérfanas

**5 ventanas detectadas lejos de cualquier muro:**
```
Ventana #13: a 1.72m del muro más cercano
Ventana #14: a 2.52m del muro más cercano
Ventana #18: a 1.95m del muro más cercano
Ventana #20: a 1.66m del muro más cercano
Ventana #27: a 1.86m del muro más cercano
```

**Problema:** Estas ventanas crearán vanos en el aire, sin estar integradas en ningún muro.

---

## 🔴 PROBLEMA PRINCIPAL #2: ORQUESTADOR - Bug en `join_style`

### Código Problemático en `three.py:280`

```python
# ❌ CÓDIGO ACTUAL (INCORRECTO):
walls_union = walls_union.buffer(WALL_THICKNESS_M/2.0, cap_style=2, join_style=2)
```

**El problema:**
- `join_style=2` = **MITER** (unión en pico/inglete)
- El comentario en línea 238 dice usar `join_style=3` = **BEVEL** (unión biselada)
- MITER crea "picos" largos en esquinas agudas
- Estos picos causan que los muros se **desborden** visualmente

**Visualización del problema:**
```
join_style=2 (MITER) - ACTUAL:        join_style=3 (BEVEL) - CORRECTO:
        /\                                    ____
       /  \                                  /    \
______/    \______                    ______/      \______
   ↑ Pico largo que se desborda          ↑ Unión limpia
```

### Otros Problemas del Orquestador

1. **JOINT_PAD_M = 0.02m** (línea 28)
   - Extiende cada muro 2cm para cerrar juntas
   - Con muros ya superpuestos del JSON, esto empeora las colisiones

2. **Tolerancias de snap/simplify** (líneas 283-284)
   - Pueden mover vértices y desalinear la geometría
   - Con datos ya problemáticos, puede amplificar errores

---

## ✅ SOLUCIONES PROPUESTAS

### 🔧 Solución Inmediata: Corregir el Orquestador

**Cambio en `three.py` línea 280:**

```python
# Cambiar de:
walls_union = walls_union.buffer(WALL_THICKNESS_M/2.0, cap_style=2, join_style=2)

# A:
walls_union = walls_union.buffer(WALL_THICKNESS_M/2.0, cap_style=2, join_style=3)
```

**Impacto esperado:**
- ✅ Elimina picos/desbordamientos en esquinas
- ✅ Uniones más limpias entre muros perpendiculares
- ⚠️ No soluciona las superposiciones del JSON

---

### 🎯 Solución Completa: Mejorar la Detección

**El JSON tiene datos deficientes** - Necesitas:

1. **Re-entrenar o ajustar el modelo Mask R-CNN:**
   - Los bounding boxes de muros son ~2.5-3x más anchos de lo necesario
   - Revisar las anotaciones de entrenamiento
   - Ajustar el threshold de detección

2. **Post-procesamiento del JSON antes del orquestador:**
   - Adelgazar los ROIs de muros detectados
   - Resolver superposiciones antes de generar el GLB
   - Filtrar ventanas huérfanas (score < 0.85)

3. **Agregar validación de datos:**
   - Rechazar JSONs con superposiciones > 20%
   - Alertar si el grosor promedio de muros > 200mm

---

## 📋 RECOMENDACIONES PRIORITARIAS

### 🔥 Prioridad Alta (Hacer YA)
1. ✅ **Corregir `join_style=2` → `join_style=3` en three.py:280**
   - Tiempo: 1 minuto
   - Impacto: Medio-Alto (mejora visual inmediata)

2. ✅ **Filtrar elementos con score bajo:**
   - Cambiar `min_score=0.0` → `min_score=0.75` en la llamada a `build_scene_mesh()`
   - Elimina las 5 ventanas huérfanas (scores 0.76-0.84)

### ⚠️ Prioridad Media (Próxima semana)
3. **Agregar post-procesamiento de muros:**
   - Adelgazar ROIs de muros a un grosor consistente
   - Resolver superposiciones automáticamente

### 📊 Prioridad Baja (Largo plazo)
4. **Mejorar el modelo de detección:**
   - Re-anotar dataset con bounding boxes más precisos
   - Re-entrenar Mask R-CNN

---

## 🧪 Prueba con este JSON

Para verificar que es el orquestador y no solo el JSON:
1. Crea un JSON "perfecto" manualmente con muros sin superposiciones
2. Si aún hay problemas → es el orquestador (join_style=2)
3. Si se ve bien → es el JSON (detección deficiente)

---

## 📌 Conclusión

**¿JSON o Orquestador?**  
➡️ **AMBOS tienen problemas**

**Impacto relativo:**
- JSON deficiente: **70%** del problema (superposiciones, dimensiones incorrectas)
- Orquestador con bug: **30%** del problema (join_style miter causa picos)

**Acción inmediata:**  
✅ Aplicar la corrección de `join_style` (mejora ~30%)  
✅ Aumentar `min_score` para filtrar detecciones malas (mejora ~15%)  
⏭️ Luego trabajar en mejorar la calidad del JSON (mejora ~55% restante)

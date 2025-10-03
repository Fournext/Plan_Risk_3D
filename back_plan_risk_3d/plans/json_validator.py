"""
Utilidades para validar y limpiar JSONs de detección antes de generar GLB.

Este módulo ayuda a identificar y corregir problemas comunes en los JSONs
generados por el modelo de detección (Mask R-CNN).
"""

def validate_and_clean_detection(det_json, 
                                  min_score=0.70,
                                  max_wall_thickness_ratio=2.5,
                                  fix_overlaps=True,
                                  remove_orphan_openings=True,
                                  verbose=False):
    """
    Valida y limpia un JSON de detección.
    
    Args:
        det_json: Diccionario con keys: points, classes, scores, Width, Height, averageDoor
        min_score: Score mínimo para mantener una detección (default 0.70)
        max_wall_thickness_ratio: Ratio máximo grosor/esperado para muros (default 2.5)
        fix_overlaps: Si True, intenta resolver superposiciones de muros
        remove_orphan_openings: Si True, elimina ventanas/puertas lejos de muros
        verbose: Si True, imprime información de depuración
        
    Returns:
        Diccionario limpio con el mismo formato que det_json
    """
    import math
    from collections import defaultdict
    
    points = det_json.get("points", [])
    classes = det_json.get("classes", [])
    scores = det_json.get("scores", [])
    avg_door = det_json.get("averageDoor", 27.0)
    
    # Calcular escala
    px2m = (0.90 / avg_door) if avg_door > 4 else 0.01
    EXPECTED_WALL_THICKNESS_M = 0.15
    
    cleaned_points = []
    cleaned_classes = []
    cleaned_scores = []
    
    stats = {
        'total': len(points),
        'removed_low_score': 0,
        'removed_thick_walls': 0,
        'removed_orphan_openings': 0,
        'kept': 0
    }
    
    # Paso 1: Filtrar por score
    temp_items = []
    for i, (p, c, s) in enumerate(zip(points, classes, scores if scores else [1.0]*len(points))):
        if s >= min_score:
            temp_items.append((p, c, s))
        else:
            stats['removed_low_score'] += 1
            if verbose:
                print(f"  Removido por score bajo: {c.get('name')} #{i} (score={s:.3f})")
    
    # Separar por tipo
    walls = []
    doors = []
    windows = []
    
    for p, c, s in temp_items:
        class_name = c.get("name", "")
        if class_name == "wall":
            walls.append((p, c, s))
        elif class_name == "door":
            doors.append((p, c, s))
        elif class_name == "window":
            windows.append((p, c, s))
    
    # Paso 2: Filtrar muros muy gruesos (probablemente mal detectados)
    filtered_walls = []
    for p, c, s in walls:
        dx_px = abs(p["x2"] - p["x1"])
        dy_px = abs(p["y2"] - p["y1"])
        
        # Determinar grosor (dimensión menor)
        width_px = min(dx_px, dy_px)
        width_m = width_px * px2m
        
        thickness_ratio = width_m / EXPECTED_WALL_THICKNESS_M
        
        if thickness_ratio <= max_wall_thickness_ratio:
            filtered_walls.append((p, c, s))
        else:
            stats['removed_thick_walls'] += 1
            if verbose:
                print(f"  Removido muro muy grueso: {width_m*1000:.1f}mm "
                      f"({thickness_ratio:.1f}x esperado)")
    
    # Paso 3: Eliminar ventanas/puertas huérfanas (lejos de cualquier muro)
    if remove_orphan_openings and filtered_walls:
        max_distance_px = 50  # 50 píxeles de distancia máxima
        
        filtered_openings = []
        for opening_list, opening_type in [(doors, "door"), (windows, "window")]:
            for p, c, s in opening_list:
                cx_o = (p["x1"] + p["x2"]) / 2.0
                cy_o = (p["y1"] + p["y2"]) / 2.0
                
                # Buscar muro más cercano
                min_dist = float('inf')
                for p_w, c_w, s_w in filtered_walls:
                    cx_w = (p_w["x1"] + p_w["x2"]) / 2.0
                    cy_w = (p_w["y1"] + p_w["y2"]) / 2.0
                    dist = math.sqrt((cx_o - cx_w)**2 + (cy_o - cy_w)**2)
                    min_dist = min(min_dist, dist)
                
                if min_dist <= max_distance_px:
                    filtered_openings.append((p, c, s))
                else:
                    stats['removed_orphan_openings'] += 1
                    if verbose:
                        print(f"  Removido {opening_type} huérfano: {min_dist*px2m:.2f}m del muro más cercano")
        
        # Reagrupar puertas y ventanas filtradas
        doors_clean = [(p, c, s) for p, c, s in filtered_openings if c.get("name") == "door"]
        windows_clean = [(p, c, s) for p, c, s in filtered_openings if c.get("name") == "window"]
    else:
        doors_clean = doors
        windows_clean = windows
    
    # Combinar todos los elementos filtrados
    all_items = filtered_walls + doors_clean + windows_clean
    
    for p, c, s in all_items:
        cleaned_points.append(p)
        cleaned_classes.append(c)
        cleaned_scores.append(s)
        stats['kept'] += 1
    
    # Crear JSON limpio
    cleaned_json = {
        "points": cleaned_points,
        "classes": cleaned_classes,
        "scores": cleaned_scores,
        "Width": det_json.get("Width", 0),
        "Height": det_json.get("Height", 0),
        "averageDoor": avg_door
    }
    
    if verbose:
        print(f"\n📊 Estadísticas de limpieza:")
        print(f"  Total elementos: {stats['total']}")
        print(f"  Removidos por score bajo: {stats['removed_low_score']}")
        print(f"  Removidos muros gruesos: {stats['removed_thick_walls']}")
        print(f"  Removidos vanos huérfanos: {stats['removed_orphan_openings']}")
        print(f"  ✅ Elementos mantenidos: {stats['kept']}")
    
    return cleaned_json, stats


def analyze_detection_quality(det_json, verbose=True):
    """
    Analiza la calidad de un JSON de detección sin modificarlo.
    
    Returns:
        Dict con métricas de calidad y lista de issues encontrados
    """
    import math
    
    points = det_json.get("points", [])
    classes = det_json.get("classes", [])
    scores = det_json.get("scores", [])
    avg_door = det_json.get("averageDoor", 27.0)
    
    px2m = (0.90 / avg_door) if avg_door > 4 else 0.01
    EXPECTED_WALL_THICKNESS_M = 0.15
    
    issues = []
    metrics = {
        'total_elements': len(points),
        'walls': 0,
        'doors': 0,
        'windows': 0,
        'low_score_count': 0,
        'thick_walls_count': 0,
        'overlapping_walls_count': 0,
        'orphan_openings_count': 0,
        'quality_score': 100.0  # Empieza en 100, se resta por cada problema
    }
    
    # Agrupar por tipo
    by_type = {'wall': [], 'door': [], 'window': []}
    for i, (p, c) in enumerate(zip(points, classes)):
        class_name = c.get("name", "")
        score = scores[i] if i < len(scores) else 1.0
        if class_name in by_type:
            by_type[class_name].append((i, p, score))
            metrics[f'{class_name}s'] += 1
    
    # Verificar scores bajos
    for class_name, items in by_type.items():
        for idx, p, score in items:
            if score < 0.70:
                metrics['low_score_count'] += 1
                issues.append(f"{class_name} #{idx} tiene score bajo: {score:.3f}")
                metrics['quality_score'] -= 2
    
    # Verificar muros gruesos
    for idx, p, score in by_type['wall']:
        dx_px = abs(p["x2"] - p["x1"])
        dy_px = abs(p["y2"] - p["y1"])
        width_m = min(dx_px, dy_px) * px2m
        
        if width_m > EXPECTED_WALL_THICKNESS_M * 2.0:
            metrics['thick_walls_count'] += 1
            issues.append(f"Muro #{idx} muy grueso: {width_m*1000:.1f}mm")
            metrics['quality_score'] -= 3
    
    # Verificar superposiciones
    walls = by_type['wall']
    for i in range(len(walls)):
        for j in range(i+1, len(walls)):
            idx_i, p_i, _ = walls[i]
            idx_j, p_j, _ = walls[j]
            
            x_overlap = max(0, min(p_i["x2"], p_j["x2"]) - max(p_i["x1"], p_j["x1"]))
            y_overlap = max(0, min(p_i["y2"], p_j["y2"]) - max(p_i["y1"], p_j["y1"]))
            
            if x_overlap > 0 and y_overlap > 0:
                overlap_area = x_overlap * y_overlap
                area_i = abs(p_i["x2"] - p_i["x1"]) * abs(p_i["y2"] - p_i["y1"])
                overlap_pct = (overlap_area / area_i) * 100
                
                if overlap_pct > 15:
                    metrics['overlapping_walls_count'] += 1
                    issues.append(f"Muros #{idx_i} y #{idx_j} superpuestos {overlap_pct:.1f}%")
                    metrics['quality_score'] -= 4
    
    # Verificar vanos huérfanos
    for opening_type in ['door', 'window']:
        for idx_o, p_o, _ in by_type[opening_type]:
            cx_o = (p_o["x1"] + p_o["x2"]) / 2.0
            cy_o = (p_o["y1"] + p_o["y2"]) / 2.0
            
            min_dist = float('inf')
            for idx_w, p_w, _ in walls:
                cx_w = (p_w["x1"] + p_w["x2"]) / 2.0
                cy_w = (p_w["y1"] + p_w["y2"]) / 2.0
                dist = math.sqrt((cx_o - cx_w)**2 + (cy_o - cy_w)**2)
                min_dist = min(min_dist, dist)
            
            if min_dist > 50:
                metrics['orphan_openings_count'] += 1
                issues.append(f"{opening_type} #{idx_o} huérfano: {min_dist*px2m:.2f}m del muro")
                metrics['quality_score'] -= 5
    
    metrics['quality_score'] = max(0, metrics['quality_score'])
    
    if verbose:
        print(f"📊 Calidad del JSON: {metrics['quality_score']:.1f}/100")
        print(f"  Total elementos: {metrics['total_elements']}")
        print(f"  Problemas encontrados: {len(issues)}")
        
        if issues:
            print("\n⚠️ Issues detectados:")
            for issue in issues[:10]:
                print(f"  - {issue}")
            if len(issues) > 10:
                print(f"  ... y {len(issues)-10} más")
    
    return metrics, issues

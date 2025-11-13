// Interfaz adaptada para representar el JSON de análisis estructural
export interface StructuralAnalysis {
  success: boolean;
  analisis: Analisis;
  nombre_archivo: string;
  texturas_enviadas: number;
}

export interface Analisis {
  elementos_bien_hechos: ElementoBien[];
  elementos_mal_hechos: ElementoMal[];
  recomendaciones: Recomendacion[];
  resumen_general: ResumenGeneral;
}

export interface ElementoBien {
  tipo: string;
  cantidad: number;
  material_usado: string;
  por_que_esta_bien?: string;
}

export interface ElementoMal {
  tipo: string;
  cantidad: number;
  material_usado: string;
  problema?: string;
  nivel_riesgo?: 'bajo' | 'medio' | 'alto' | string;
}

export interface Recomendacion {
  para_elemento: string;
  cantidad_afectada: number;
  cambiar_de: string;
  cambiar_a: string;
  razon: string;
  urgencia?: 'baja' | 'media' | 'alta' | string;
}

export interface ResumenGeneral {
  nivel_riesgo_global: 'bajo' | 'medio' | 'alto' | string;
  elementos_correctos: number;
  elementos_incorrectos: number;
  comentario?: string;
}
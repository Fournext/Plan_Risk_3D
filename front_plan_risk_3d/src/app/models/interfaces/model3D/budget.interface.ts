export interface BudgetResponse {
  total_estimado:            number;
  detalle:                   Detalle[];
  materiales_no_encontrados: MaterialesNoEncontrado[];
}

export interface Detalle {
  material:        Material;
  categoria:       Categoria;
  cantidad:        number;
  unidad:          Unidad;
  precio_unitario: number;
  subtotal:        number;
}

export enum Categoria {
  Wall = "wall",
  Door = "door",
  Window = "window",
}

export enum Material {
  Ladrillo = "Ladrillo",
  Madera = "Madera",
  Vidrio = "Vidrio",
  Metal = "Metal",
  Cemento = "Cemento",
  Piedra = "Piedra",
  Personalizado = "Personalizado",
}

export enum Unidad {
  M2 = "m2",
  M3 = "m3",
}

export enum MaterialesNoEncontrado {
  Personalizado = "Personalizado",
}

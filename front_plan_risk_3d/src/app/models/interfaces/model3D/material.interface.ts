export interface MaterialInterface {
  nombre: string,
  unidad: string,
  precio_unitario: number,
  categoria: string
}

export interface CategoryInterface {
  nombre: string,
  descripcion: string
}

export interface PostMaterialInterface {
  categorias: CategoryInterface[],
  materiales: MaterialInterface[]
}



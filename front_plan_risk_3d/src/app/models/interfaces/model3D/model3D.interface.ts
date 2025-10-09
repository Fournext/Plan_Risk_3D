export interface Model3D {
  id: number,
  plan_file: string,
  plan_image?: string,
  detections_json: string,
  glb_model: string,
  widht: number,
  height: number,
  created_at: string,
  usuario: number
}

export interface Detection {
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface ModelJson {
  points: { x1: number; y1: number; x2: number; y2: number }[];
  classes: { name: string }[];
}

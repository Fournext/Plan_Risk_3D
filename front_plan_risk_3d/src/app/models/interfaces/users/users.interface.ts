export interface UserInterface {
  id: number,
  nombre: string,
  email: string,
  rol?: string,
  fecha_expiracion_plan: string,
  fecha_registro?: string
}
export interface UserRegister {
  nombre: string,
  email: string,
  password?: string,
  rol: string,
  fecha_expiracion_plan?: string,
  fecha_registro: string,
}

export interface UserLogin {
  email: string,
  password: string
}
export interface TopLevel {
  access: string;
  refresh: string;
  usuario: Usuario;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  password: string;
  rol: string;
  fecha_expiracion_plan: string;
  fecha_registro: string;
}




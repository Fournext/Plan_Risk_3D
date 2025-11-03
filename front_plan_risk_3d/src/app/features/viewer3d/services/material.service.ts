import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { CategoryInterface, MaterialInterface, PostMaterialInterface } from '../../../models/interfaces/model3D/material.interface';
import { response } from 'express';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private http = inject(HttpClient);
  private API = environment.endpoint;

  categories = signal<CategoryInterface[]>([
    { nombre: 'wall', descripcion: 'Materiales para paredes' },
    { nombre: 'door', descripcion: 'Materiales para puertas' },
    { nombre: 'window', descripcion: 'Materiales para ventanas' }
  ]);

  materiales = signal<MaterialInterface[]>([
    { nombre: 'Ladrillo', unidad: 'm2', precio_unitario: 15, categoria: 'wall' },
    { nombre: 'Cemento', unidad: 'kg', precio_unitario: 0.5, categoria: 'wall' },
    { nombre: 'Piedra', unidad: 'kg', precio_unitario: 0.5, categoria: 'wall' },
    { nombre: 'Madera tajibo', unidad: 'm3', precio_unitario: 50, categoria: 'door' },
    { nombre: 'Madera ochoo', unidad: 'm3', precio_unitario: 50, categoria: 'door' },
    { nombre: 'Madera roble', unidad: 'm3', precio_unitario: 50, categoria: 'door' },
    { nombre: 'Vidrio simple', unidad: 'm2', precio_unitario: 20, categoria: 'window' },
    { nombre: 'Vidrio escandinavo', unidad: 'm2', precio_unitario: 20, categoria: 'window' }
  ]);

  postMaterial(categories: CategoryInterface[], materials: MaterialInterface[]): Observable<any> {
    const body: PostMaterialInterface = {
      categorias: categories,
      materiales: materials
    }
    return this.http.post<any>(`${this.API}api/presupuesto/materiales/cargar/`, body).pipe(
      // Aquí puedes agregar operadores RxJS si es necesario
      tap(response => {
        console.log('Respuesta del servidor:', response);
      }),
      catchError(error => {
        console.error('Error al cargar materiales:', error);
        return throwError(error);
      })
    );
  }

  constructor() { }

}

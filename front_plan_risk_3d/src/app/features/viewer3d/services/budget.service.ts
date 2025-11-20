import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { CategoryInterface, MaterialInterface, PostMaterialInterface } from '../../../models/interfaces/model3D/material.interface';
import { Detalle } from '../../../models/interfaces/model3D/budget.interface';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {

  private http = inject(HttpClient);
  private API = environment.endpoint;
  public isLoading=signal<boolean>(false);
  //aqui tenemos que enviar el json con los materiales, cantidad de muros etc para que pueda generar el presupuesto
  public totalCost = signal<number>(0);
  public detalle = signal<Detalle[]>([]);
  public materialesNoEncontrados = signal<string[]>([]);
  public totalCostWall = signal<number>(0);
  public totalCostDoor = signal<number>(0);
  public totalCostWindow = signal<number>(0);
  public categoryAndMaterials = signal<{ categoria: string; material: string; total: number }[]>([]);


  generateBudget(modelJson: any): Observable<any> {
    return this.http.post<any>(`${this.API}api/presupuesto/calcular/`, modelJson).pipe(
      tap(response => {
        const totalCost = response.total_estimado;
        const detalle: Detalle[] = response.detalle;
        const materialesNoEncontrados = response.materiales_no_encontrados;

        const categoryAndMaterials = Array.from(
          detalle.reduce((acc, d) => {
            const key = `${d.categoria}-${d.material}`;
            if (!acc.has(key)) {
              acc.set(key, { categoria: d.categoria, material: d.material, total: 0 });
            }
            acc.get(key)!.total += d.subtotal;
            return acc;
          }, new Map<string, { categoria: string; material: string; total: number }>())
            .values()
        );

        let totalCostWall = 0, totalCostDoor = 0, totalCostWindow = 0;
        detalle.forEach(detalle => {
          if (detalle.categoria === 'wall') totalCostWall += detalle.subtotal;
          else if (detalle.categoria === 'door') totalCostDoor += detalle.subtotal;
          else if (detalle.categoria === 'window') totalCostWindow += detalle.subtotal;
        });

        this.totalCost.set(totalCost);
        this.detalle.set(detalle);
        this.materialesNoEncontrados.set(materialesNoEncontrados);
        this.totalCostWall.set(totalCostWall);
        this.totalCostDoor.set(totalCostDoor);
        this.totalCostWindow.set(totalCostWindow);
        this.categoryAndMaterials.set(categoryAndMaterials);

        console.log('Respuesta del servidor al generar presupuesto:', response);
      }),

      catchError(error => {
        console.error('Error al generar presupuesto:', error);
        return throwError(error);
      })
    );

  }


  constructor() { }

}

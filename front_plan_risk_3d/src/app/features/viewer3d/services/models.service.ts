import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Model3D } from '../../../models/interfaces/model3D/model3D.interface';
import { Observable, switchMap, tap } from 'rxjs';
import { SaveModelResponse } from '../../../models/interfaces/responses/SaveModelResponse.interface';

@Injectable({
  providedIn: 'root'
})
export class ModelsService {
  private http = inject(HttpClient);
  private API = environment.endpoint;
  public isLoading = signal<boolean>(false);
  public listModelsUser = signal<Model3D[]>([]);

  getModels(): Observable<any> {
    return this.http.get<any>(`${this.API}api/set_plan/lista_modelos/`).pipe(
      tap((response: Model3D[]) => {
        this.listModelsUser.set(response);
      })
    )
  }

  uploadModels(file: File, usuario: number): Observable<Model3D> {
    const formData = new FormData();
    formData.append('plan_file', file);
    formData.append('usuario', usuario.toString());
    return this.http.post<Model3D>(`${this.API}api/set_plan/plans/`, formData).pipe(
      tap(() => this.getModels().subscribe())
    )
  }



  updateModel(file: File, usuario: number): Observable<any> {
    const formData = new FormData();
    formData.append('file_glb', file);
    formData.append('usuario', usuario.toString());

    return this.http.post<any>(`${this.API}api/set_plan/reemplazar_glb/`, formData).pipe(
      switchMap(() => this.getModels()) // 👈 Espera a que getModels() termine
    );
  }

  onSaveModel(file: File, usuario: number): Observable<SaveModelResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('usuario', usuario.toString());
    return this.http.post<SaveModelResponse>(`${this.API}api/view_model/upload-glb/`, formData).pipe(
      tap(() => this.getModels().subscribe())
    );
  }

  

  constructor() { }

}
